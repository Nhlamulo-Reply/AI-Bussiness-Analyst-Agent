import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuthUser } from "../features/auth/auth.schemas";
import { apiRequest, apiUpload } from "./api-client";
import { clearSession, getSession, setSession } from "./auth-store";
import { documentMetadataSchema } from "../features/documents/document.schemas";

const responseSchema = z.object({ value: z.string() });
const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

describe("apiRequest", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    vi.stubGlobal("fetch", vi.fn());
    clearSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends a protected request with the in-memory bearer token", async () => {
    setSession({ accessToken: "memory-only-token", user });
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        data: { value: "private" },
        requestId: "request-1",
      }),
    );

    await expect(
      apiRequest("/private", {
        auth: "required",
        schema: responseSchema,
      }),
    ).resolves.toEqual({ value: "private" });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer memory-only-token",
    );
    expect(options?.credentials).toBe("omit");
  });

  it("does not attach a bearer token to a public request", async () => {
    setSession({ accessToken: "memory-only-token", user });
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        data: { value: "public" },
        requestId: "request-2",
      }),
    );

    await apiRequest("/public", { schema: responseSchema });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
  });

  it("clears the in-memory session when a protected request receives 401", async () => {
    setSession({ accessToken: "expired-token", user });
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired token.",
            details: [],
            requestId: "request-3",
          },
        },
        { status: 401 },
      ),
    );

    await expect(
      apiRequest("/private", {
        auth: "required",
        schema: responseSchema,
      }),
    ).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(getSession()).toBeNull();
  });

  it("does not clear the session when access is forbidden", async () => {
    const session = { accessToken: "valid-token", user };
    setSession(session);
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission.",
            details: [],
            requestId: "request-4",
          },
        },
        { status: 403 },
      ),
    );

    await expect(
      apiRequest("/restricted", {
        auth: "required",
        schema: responseSchema,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(getSession()).toBe(session);
  });

  it("preserves Retry-After from an API error for bounded polling", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests.",
            details: [],
          },
        },
        { status: 429, headers: { "Retry-After": "3" } },
      ),
    );

    await expect(
      apiRequest("/executions/execution-1", { schema: responseSchema }),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterMs: 3000,
    });
  });

  it("preserves Retry-After when a rate-limit response is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Temporarily rate limited.", {
        status: 429,
        headers: { "Retry-After": "4", "Content-Type": "text/plain" },
      }),
    );

    await expect(
      apiRequest("/executions/execution-1", { schema: responseSchema }),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterMs: 4000,
    });
  });

  it("rejects a request when the service does not respond before the timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(
      (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const request = apiRequest("/slow", { schema: responseSchema });
    const assertion = expect(request).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it("uploads multipart data with progress without overriding the browser boundary", async () => {
    setSession({ accessToken: "memory-only-token", user });
    const document = {
      id: "document-1",
      projectId: "project-1",
      uploadedByUserId: user.id,
      fileName: "brief.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      status: "uploaded",
      createdAt: "2026-03-04T05:06:07.000Z",
    };
    const xhrInstances: MockUploadRequest[] = [];
    class MockUploadRequest {
      upload = {
        onprogress: null as ((event: ProgressEvent) => void) | null,
      };
      status = 201;
      responseText = JSON.stringify({
        success: true,
        data: document,
        requestId: "request-upload",
      });
      timeout = 0;
      withCredentials = true;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      onabort: (() => void) | null = null;
      requestHeaders = new Map<string, string>();
      requestBody: XMLHttpRequestBodyInit | null = null;
      requestUrl = "";

      constructor() {
        xhrInstances.push(this);
      }

      open(_method: string, url: string) {
        this.requestUrl = url;
      }

      setRequestHeader(name: string, value: string) {
        this.requestHeaders.set(name.toLowerCase(), value);
      }

      getResponseHeader(name: string) {
        return name.toLowerCase() === "content-type"
          ? "application/json"
          : null;
      }

      send(body: XMLHttpRequestBodyInit | null) {
        this.requestBody = body;
        this.upload.onprogress?.(
          new ProgressEvent("progress", {
            lengthComputable: true,
            loaded: 3,
            total: 5,
          }),
        );
        this.onload?.();
      }

      abort() {
        this.onabort?.();
      }
    }

    vi.stubGlobal("XMLHttpRequest", MockUploadRequest);
    const formData = new FormData();
    formData.append(
      "file",
      new File(["brief"], "brief.txt", { type: "text/plain" }),
    );
    const onProgress = vi.fn();

    await expect(
      apiUpload("/projects/project-1/documents", formData, {
        schema: documentMetadataSchema,
        onProgress,
      }),
    ).resolves.toEqual(document);

    const xhr = xhrInstances[0];
    expect(xhr?.requestUrl).toBe("/api/v1/projects/project-1/documents");
    expect(xhr?.requestHeaders.get("authorization")).toBe(
      "Bearer memory-only-token",
    );
    expect(xhr?.requestHeaders.has("content-type")).toBe(false);
    expect(xhr?.withCredentials).toBe(false);
    expect(xhr?.requestBody).toBe(formData);
    expect(onProgress).toHaveBeenCalledWith(60);
  });
});
