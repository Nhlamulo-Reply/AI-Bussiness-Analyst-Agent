import { z } from "zod";
import { clearSession, getSession } from "./auth-store";

const successEnvelopeSchema = z
  .object({
    success: z.literal(true),
    data: z.unknown(),
    requestId: z.string().optional(),
  })
  .passthrough();

const errorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z
          .array(
            z
              .object({
                field: z.string(),
                reason: z.string(),
              })
              .strict(),
          )
          .default([]),
        requestId: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details: Array<{ field: string; reason: string }>;
  readonly retryAfterMs?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details: Array<{ field: string; reason: string }> = [],
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.retryAfterMs = retryAfterMs;
  }
}

export function getApiErrorPresentation(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return { message: fallback, requestId: undefined };
  }

  let message = error.message;
  if (error.status === 401) {
    message = "Your session has expired. Sign in again to continue.";
  } else if (error.status === 403) {
    message = "You don't have access to this project.";
  } else if (error.status === 404) {
    message =
      "The project could not be found or is no longer available to you.";
  } else if (error.status >= 500) {
    message = "The service is temporarily unavailable. Please try again.";
  }

  return { message, requestId: error.requestId };
}

export interface ApiRequestOptions<T> extends Omit<RequestInit, "body"> {
  schema: z.ZodType<T>;
  auth?: "none" | "required";
  json?: unknown;
  accessToken?: string;
}

export interface ApiUploadOptions<T> {
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export interface ApiDownloadOptions {
  auth?: "none" | "required";
  fallbackFilename: string;
  signal?: AbortSignal;
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

const requestTimeoutMs = 15_000;
const uploadTimeoutMs = 60_000;

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions<T>,
): Promise<T> {
  const {
    schema,
    auth = "none",
    json,
    accessToken,
    headers: initialHeaders,
    signal: externalSignal,
    ...requestOptions
  } = options;
  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const token =
    accessToken ??
    (auth === "required" ? getSession()?.accessToken : undefined);
  if (auth === "required" && !token) {
    throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const requestUrl = getRequestUrl(path);

  let response: Response;
  let responseBody: unknown;
  try {
    response = await fetch(requestUrl, {
      ...requestOptions,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (
      response.status === 401 &&
      auth === "required" &&
      token === getSession()?.accessToken
    ) {
      clearSession();
    }
    responseBody = await readResponseBody(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new ApiError(0, "REQUEST_ABORTED", "The request was cancelled.");
      }
      throw new ApiError(
        0,
        "REQUEST_TIMEOUT",
        "The service took too long to respond. Please try again.",
      );
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Could not reach the service. Check your connection and try again.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }

  return parseApiResponse(
    response.status,
    responseBody,
    response.headers.get("x-request-id"),
    schema,
    response.headers.get("retry-after"),
  );
}

export async function apiDownload(
  path: string,
  options: ApiDownloadOptions,
): Promise<DownloadedFile> {
  const { auth = "none", fallbackFilename, signal: externalSignal } = options;
  const headers = new Headers({ Accept: "*/*" });
  const token = auth === "required" ? getSession()?.accessToken : undefined;
  if (auth === "required" && !token) {
    throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(getRequestUrl(path), {
      method: "GET",
      headers,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (
      response.status === 401 &&
      auth === "required" &&
      token === getSession()?.accessToken
    ) {
      clearSession();
    }

    if (!response.ok) {
      const responseBody = await readResponseBody(response);
      parseApiResponse(
        response.status,
        responseBody,
        response.headers.get("x-request-id"),
        z.unknown(),
        response.headers.get("retry-after"),
      );
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "The service returned an unexpected response. Please try again.",
      );
    }

    return {
      blob: await response.blob(),
      filename: getAttachmentFilename(
        response.headers.get("content-disposition"),
        fallbackFilename,
      ),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new ApiError(0, "REQUEST_ABORTED", "The request was cancelled.");
      }
      throw new ApiError(
        0,
        "REQUEST_TIMEOUT",
        "The service took too long to respond. Please try again.",
      );
    }
    if (error instanceof TypeError) {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Could not reach the service. Check your connection and try again.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export function apiUpload<T>(
  path: string,
  formData: FormData,
  options: ApiUploadOptions<T>,
): Promise<T> {
  const token = getSession()?.accessToken;
  if (!token) {
    return Promise.reject(
      new ApiError(401, "UNAUTHORIZED", "Please sign in to continue."),
    );
  }
  if (options.signal?.aborted) {
    return Promise.reject(
      new ApiError(0, "REQUEST_ABORTED", "The request was cancelled."),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => {
      options.signal?.removeEventListener("abort", abortRequest);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const resolveOnce = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const abortRequest = () => xhr.abort();

    xhr.open("POST", getRequestUrl(path));
    xhr.timeout = uploadTimeoutMs;
    xhr.withCredentials = false;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
      }
    };
    xhr.onload = () => {
      if (xhr.status === 401 && token === getSession()?.accessToken) {
        clearSession();
      }
      try {
        resolveOnce(
          parseApiResponse(
            xhr.status,
            readXhrResponseBody(xhr),
            xhr.getResponseHeader("x-request-id"),
            options.schema,
            xhr.getResponseHeader("retry-after"),
          ),
        );
      } catch (error) {
        rejectOnce(error);
      }
    };
    xhr.onerror = () => {
      rejectOnce(
        new ApiError(
          0,
          "NETWORK_ERROR",
          "Could not reach the service. Check your connection and try again.",
        ),
      );
    };
    xhr.ontimeout = () => {
      rejectOnce(
        new ApiError(
          0,
          "REQUEST_TIMEOUT",
          "The upload took too long to respond. Please try again.",
        ),
      );
    };
    xhr.onabort = () => {
      rejectOnce(
        new ApiError(0, "REQUEST_ABORTED", "The request was cancelled."),
      );
    };

    options.signal?.addEventListener("abort", abortRequest, { once: true });
    if (options.signal?.aborted) {
      abortRequest();
      return;
    }

    try {
      xhr.send(formData);
    } catch (error) {
      rejectOnce(error);
    }
  });
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "The service returned an unexpected response. Please try again.",
      response.headers.get("x-request-id") ?? undefined,
      [],
      retryAfterMs,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "The service returned an unreadable response. Please try again.",
        response.headers.get("x-request-id") ?? undefined,
        [],
        retryAfterMs,
      );
    }
    throw error;
  }
}

function readXhrResponseBody(xhr: XMLHttpRequest): unknown {
  const contentType = xhr.getResponseHeader("content-type") ?? "";
  const retryAfterMs = parseRetryAfterMs(xhr.getResponseHeader("retry-after"));
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      xhr.status,
      "INVALID_RESPONSE",
      "The service returned an unexpected response. Please try again.",
      xhr.getResponseHeader("x-request-id") ?? undefined,
      [],
      retryAfterMs,
    );
  }

  try {
    const responseBody: unknown = JSON.parse(xhr.responseText);
    return responseBody;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(
        xhr.status,
        "INVALID_RESPONSE",
        "The service returned an unreadable response. Please try again.",
        xhr.getResponseHeader("x-request-id") ?? undefined,
        [],
        retryAfterMs,
      );
    }
    throw error;
  }
}

function parseApiResponse<T>(
  status: number,
  responseBody: unknown,
  headerRequestId: string | null,
  schema: z.ZodType<T>,
  retryAfterHeader?: string | null,
): T {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
  if (status < 200 || status >= 300) {
    const parsedError = errorEnvelopeSchema.safeParse(responseBody);
    if (parsedError.success) {
      const { code, message, details, requestId } = parsedError.data.error;
      throw new ApiError(
        status,
        code,
        message,
        requestId ?? headerRequestId ?? undefined,
        details,
        retryAfterMs,
      );
    }

    throw new ApiError(
      status,
      `HTTP_${status}`,
      getStatusMessage(status),
      headerRequestId ?? undefined,
      [],
      retryAfterMs,
    );
  }

  const envelope = successEnvelopeSchema.safeParse(responseBody);
  if (!envelope.success) {
    throw new ApiError(
      status,
      "INVALID_RESPONSE",
      "The service returned an unexpected response. Please try again.",
    );
  }

  const result = schema.safeParse(envelope.data.data);
  if (!result.success) {
    throw new ApiError(
      status,
      "INVALID_RESPONSE",
      "The service returned data in an unexpected format. Please try again.",
      envelope.data.requestId,
    );
  }

  return result.data;
}

function getRequestUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function getAttachmentFilename(
  contentDisposition: string | null,
  fallbackFilename: string,
) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  if (!match) return fallbackFilename;
  const filename = match[1]
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .split("")
    .filter((character) => {
      const codePoint = character.charCodeAt(0);
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .replace(/^\.+/, "");
  return filename || fallbackFilename;
}

function getStatusMessage(status: number) {
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (status >= 500) return "The service is temporarily unavailable.";
  return "The request could not be completed.";
}

function parseRetryAfterMs(
  value: string | null | undefined,
): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  const seconds = Number(normalized);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp)
    ? undefined
    : Math.max(0, timestamp - Date.now());
}
