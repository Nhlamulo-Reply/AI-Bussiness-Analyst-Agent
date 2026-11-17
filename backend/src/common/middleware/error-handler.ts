import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, "NOT_FOUND", "The requested resource was not found."));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const parserError = isRequestParserError(error);
  const appError = error instanceof AppError
    ? error
    : parserError
      ? new AppError(
        parserError === "too_large" ? 413 : 400,
        parserError === "too_large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
        parserError === "too_large" ? "The request payload is too large." : "The request body is malformed."
      )
      : new AppError(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");

  if (appError.statusCode >= 500) {
    request.log?.error({ err: error, requestId: request.id }, "Request failed");
  }

  response.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: request.id
    }
  });
};

function isRequestParserError(error: unknown): "malformed" | "too_large" | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return undefined;
  }
  if (error.type === "entity.parse.failed") {
    return "malformed";
  }
  if (error.type === "entity.too.large") {
    return "too_large";
  }
  return undefined;
}
