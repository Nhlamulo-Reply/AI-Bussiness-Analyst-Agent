import { Router } from "express";
import { z } from "zod";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { artifactTypes } from "../domain/domain.schemas";

export function createArtifactRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

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
