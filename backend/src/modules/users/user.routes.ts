import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { AppConfig } from "../../config/env";
import {
  LastActiveAdminError,
  type Storage,
} from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { requirePermission } from "../../common/middleware/authorization";
import {
  getAuthenticatedUser,
  getRouteParam,
} from "../../common/middleware/current-user";
import { validateBody } from "../../common/middleware/validation";
import {
  bootstrapAdminBodySchema,
  updateUserRolesBodySchema,
} from "../domain/domain.schemas";
import type { ApplicationEmailNotifications } from "../../integrations/email/application-email-notifications";

export function createUserRouter(
  storage: Storage,
  jwtSecret: string,
  adminBootstrapToken?: AppConfig["adminBootstrapToken"],
  emailNotifications?: ApplicationEmailNotifications,
): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.post(
    "/bootstrap-admin",
    validateBody(bootstrapAdminBodySchema),
    async (request, response, next) => {
      try {
        if (!adminBootstrapToken) {
          throw new AppError(
            404,
            "NOT_FOUND",
            "First-admin bootstrap is not enabled.",
          );
        }
        const submittedToken = createHash("sha256")
          .update(request.body.token)
          .digest();
        const configuredToken = createHash("sha256")
          .update(adminBootstrapToken)
          .digest();
        if (!timingSafeEqual(submittedToken, configuredToken)) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "The bootstrap token is invalid.",
          );
        }

        const user = getAuthenticatedUser(request);
        const result = await storage.bootstrapFirstAdmin(user.id);
        if (result.status === "user_not_found") {
          throw new AppError(404, "NOT_FOUND", "User not found.");
        }
        if (result.status === "already_configured") {
          throw new AppError(
            409,
            "CONFLICT",
            "An administrator is already configured.",
          );
        }
        response.status(200).json({
          success: true,
          data: {
            id: result.user.id,
            email: result.user.email,
            roles: result.user.roles,
            requiresLogin: true,
          },
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/roles",
    requirePermission("admin.users"),
    validateBody(updateUserRolesBodySchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const userId = getRouteParam(request, "id");
        if (actor.id === userId) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Administrators cannot change their own roles.",
          );
        }
        const { roles } = updateUserRolesBodySchema.parse(request.body);
        const previousUser = await storage.findById(userId);
        const user = await storage.updateUserRoles(userId, roles, actor.id);
        if (!user) {
          throw new AppError(404, "NOT_FOUND", "User not found.");
        }
        if (
          previousUser?.active &&
          previousUser.roles.length === 0 &&
          user.roles.length > 0
        ) {
          await emailNotifications?.accountAccessGranted(user);
        }
        response.status(200).json({
          success: true,
          data: { id: user.id, email: user.email, roles: user.roles },
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof LastActiveAdminError) {
          next(new AppError(409, "CONFLICT", error.message));
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
