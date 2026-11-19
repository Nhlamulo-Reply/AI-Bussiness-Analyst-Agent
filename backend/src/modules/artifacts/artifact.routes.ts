import { Router } from "express";
import { z } from "zod";
import { ArtifactReviewConflictError, type Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { validateBody } from "../../common/middleware/validation";
import { artifactTypes, patchArtifactBodySchema } from "../domain/domain.schemas";

export function createArtifactRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

  router.patch("/:id", validateBody(patchArtifactBodySchema), async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const artifactId = getRouteParam(request, "id");
      const artifact = await storage.getArtifactById(artifactId);
      if (!artifact || !(await storage.userCanAccessProject(artifact.projectId, user.id))) {
        throw new AppError(404, "NOT_FOUND", "Artifact not found.");
      }
      for (const requirementId of request.body.requirementIds ?? []) {
        const requirement = await storage.getRequirement(requirementId);
        if (!requirement || requirement.projectId !== artifact.projectId) {
          throw new AppError(400, "VALIDATION_ERROR", "A linked requirement does not belong to this project.", [
            { field: "requirementIds", reason: "Requirement is missing or belongs to another project" }
          ]);
        }
      }

      const updated = await storage.reviseArtifact(artifactId, user.id, request.body);
      if (!updated) {
        throw new AppError(404, "NOT_FOUND", "Artifact not found.");
      }
      response.status(200).json({ success: true, data: updated, requestId: request.id });
    } catch (error) {
      next(error instanceof ArtifactReviewConflictError
        ? new AppError(409, "CONFLICT", "An artifact cannot be edited while its approval is pending.")
        : error);
    }
  });

  router.get("/:id/versions", async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const artifactType = z.enum(artifactTypes).safeParse(request.query.type);
      if (!artifactType.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Specify a valid artifact type.", [
          { field: "type", reason: "A supported artifact type is required" }
        ]);
      }
      const artifactId = getRouteParam(request, "id");
      const artifact = await storage.getArtifact(artifactType.data, artifactId);
      if (!artifact || !(await storage.userCanAccessProject(artifact.projectId, user.id))) {
        throw new AppError(404, "NOT_FOUND", "Artifact not found.");
      }
      const versions = await storage.listVersions(artifactType.data, artifactId);
      response.status(200).json({ success: true, data: versions, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
