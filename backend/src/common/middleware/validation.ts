import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new AppError(
        400,
        "VALIDATION_ERROR",
        "The request payload is invalid.",
        result.error.issues.map((issue) => ({
          field: issue.path.join(".") || "body",
          reason: issue.message
        }))
      ));
      return;
    }
    request.body = result.data;
    next();
  };
}
