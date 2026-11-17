import { Router } from "express";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { requireProjectAccess } from "../../common/middleware/project-access";
import { validateBody } from "../../common/middleware/validation";
import { projectJobBodySchema } from "../domain/domain.schemas";

const notImplemented = () => new AppError(
  501,
  "NOT_IMPLEMENTED",
  "This AI workflow will be implemented in Phase 5; no results were generated."
);

export function createWorkflowPlaceholderRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

  const jobRoutes = [
    "/requirements/analyze",
    "/requirements/extract",
    "/stories/generate",
    "/acceptance-criteria/generate",
    "/requirements/validate",
    "/risks/analyze",
    "/roadmap/generate"
  ];
  for (const path of jobRoutes) {
    router.post(path, validateBody(projectJobBodySchema), requireProjectAccess(storage), (_request, _response, next) => {
      next(notImplemented());
    });
  }

  router.get("/executions/:id", async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const execution = await storage.getExecution(getRouteParam(request, "id"));
      if (!execution || !(await storage.userCanAccessProject(execution.projectId, user.id))) {
        throw new AppError(404, "NOT_FOUND", "Execution not found.");
      }
      response.status(200).json({ success: true, data: execution, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
