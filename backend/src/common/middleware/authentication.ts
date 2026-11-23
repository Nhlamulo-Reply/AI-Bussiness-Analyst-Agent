import { verify } from "jsonwebtoken";
import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error";
import type { UserRepository, UserRole } from "../../modules/auth/user.repository";

const tokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  sessionVersion: z.number().int().nonnegative().optional(),
  roles: z.array(z.enum([
    "business_analyst",
    "product_owner",
    "delivery_lead",
    "admin",
  ]))
});

export function authenticate(
  jwtSecret: string,
  users: Pick<UserRepository, "findById">,
): RequestHandler {
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
      void users.findById(claims.data.sub).then(
        (user) => {
          const currentRoles = user?.roles ?? [];
          const tokenRolesAreCurrent =
            currentRoles.length === claims.data.roles.length &&
            currentRoles.every((role) => claims.data.roles.includes(role));
          if (
            !user ||
            !user.active ||
            user.email !== claims.data.email ||
            (claims.data.sessionVersion ?? 0) !== (user.sessionVersion ?? 0) ||
            !tokenRolesAreCurrent
          ) {
            next(
              new AppError(
                401,
                "UNAUTHORIZED",
                "The access token is no longer valid.",
              ),
            );
            return;
          }
          request.user = {
            id: user.id,
            email: user.email,
            roles: user.roles,
          };
          next();
        },
        next,
      );
    } catch {
      next(new AppError(401, "UNAUTHORIZED", "The access token is invalid or expired."));
    }
  };
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
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
