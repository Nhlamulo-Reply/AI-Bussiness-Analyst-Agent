import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { validateBody } from "../../common/middleware/validation";
import {
  ProjectMembershipInviteeIneligibleError,
  ProjectMembershipInvitationTransitionError,
  type Storage,
} from "../../config/storage";

const responseSchema = z
  .object({ decision: z.enum(["accepted", "rejected"]) })
  .strict();

export function createProjectMembershipInvitationRouter(
  storage: Storage,
  jwtSecret: string,
): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.get("/:id", async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const invitation = await storage.getProjectMembershipInvitation(
        getRouteParam(request, "id"),
      );
      if (!invitation || invitation.invitedUserId !== user.id) {
        throw new AppError(404, "NOT_FOUND", "Invitation not found.");
      }
      const project = await storage.getProject(invitation.projectId);
      if (!project) {
        throw new AppError(404, "NOT_FOUND", "Invitation not found.");
      }
      response.status(200).json({
        success: true,
        data: {
          invitation,
          project: { id: project.id, name: project.name },
        },
        requestId: request.id,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/respond",
    validateBody(responseSchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const invitationId = getRouteParam(request, "id");
        const updated = await storage.respondToProjectMembershipInvitation(
          invitationId,
          user.id,
          request.body.decision,
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Invitation not found.");
        }
        response.status(200).json({
          success: true,
          data: { invitation: updated },
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof ProjectMembershipInvitationTransitionError) {
          next(
            new AppError(
              409,
              "CONFLICT",
              "This project invitation is no longer available.",
            ),
          );
          return;
        }
        if (error instanceof ProjectMembershipInviteeIneligibleError) {
          next(
            new AppError(
              403,
              "FORBIDDEN",
              "Your account no longer qualifies for project membership.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
