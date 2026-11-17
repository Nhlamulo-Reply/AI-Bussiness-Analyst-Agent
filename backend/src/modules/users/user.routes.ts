import { Router } from "express";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate, requireRoles } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { validateBody } from "../../common/middleware/validation";
import { updateUserRolesBodySchema } from "../domain/domain.schemas";

export function createUserRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

  router.patch(
    "/:id/roles",
    requireRoles("admin"),
    validateBody(updateUserRolesBodySchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const userId = getRouteParam(request, "id");
        if (actor.id === userId) {
          throw new AppError(400, "VALIDATION_ERROR", "Administrators cannot change their own roles.");
        }
        const { roles } = updateUserRolesBodySchema.parse(request.body);
        const user = await storage.updateUserRoles(userId, roles);
        if (!user) {
          throw new AppError(404, "NOT_FOUND", "User not found.");
        }
        response.status(200).json({
          success: true,
          data: { id: user.id, email: user.email, roles: user.roles },
          requestId: request.id
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
