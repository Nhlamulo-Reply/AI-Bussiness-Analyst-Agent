import type { Request } from "express";
import { AppError } from "../errors/app-error";

export function getAuthenticatedUser(request: Request): NonNullable<Request["user"]> {
  if (!request.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication is required.");
  }
  return request.user;
}

export function getRouteParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", `Route parameter '${name}' is invalid.`, [
      { field: name, reason: "Expected a single non-empty value" }
    ]);
  }
  return value;
}
