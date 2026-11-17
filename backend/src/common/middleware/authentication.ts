import { verify } from "jsonwebtoken";
import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error";

const tokenClaimsSchema = z.object({
  sub: z.string().min(1),
  roles: z.array(z.enum(["user", "reviewer", "admin", "project_owner"]))
});

export function authenticate(jwtSecret: string): RequestHandler {
  return (request, _response, next) => {
    const authorization = request.header("authorization");
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
      return;
    }

    try {
      const claims = tokenClaimsSchema.safeParse(verify(token, jwtSecret));
      if (!claims.success) {
        throw new Error("Invalid token claims");
      }
      request.user = { id: claims.data.sub, roles: claims.data.roles };
      next();
    } catch {
      next(new AppError(401, "UNAUTHORIZED", "The access token is invalid or expired."));
    }
  };
}

export function requireRoles(...roles: Array<"user" | "reviewer" | "admin" | "project_owner">): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
      return;
    }
    if (!roles.some((role) => request.user?.roles.includes(role))) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
      return;
    }
    next();
  };
}
