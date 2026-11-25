import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";
import {
  hasPermission,
  type Permission,
} from "../authorization/permissions";

export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
      return;
    }
    if (
      !permissions.some((permission) =>
        hasPermission(request.user?.roles ?? [], permission),
      )
    ) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action.",
        ),
      );
      return;
    }
    next();
  };
}
