import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { requirePermission } from "../../common/middleware/authorization";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { requireProjectAccess } from "../../common/middleware/project-access";
import { validateBody } from "../../common/middleware/validation";
import { workflowJobBodySchema } from "../domain/domain.schemas";
import type { WorkflowName } from "../../workflows/workflow-graph";
import { WorkflowService } from "../../workflows/workflow-service";

const workflowRoutes: Array<[string, WorkflowName]> = [
  ["/requirements/analyze", "requirements-analysis"],
  ["/requirements/extract", "requirements-extraction"],
  ["/stories/generate", "story-generation"],
  ["/acceptance-criteria/generate", "acceptance-criteria-generation"],
  ["/requirements/validate", "requirements-validation"],
  ["/risks/analyze", "risk-analysis"],
  ["/roadmap/generate", "roadmap-generation"]
];

export function createWorkflowRouter(storage: Storage, jwtSecret: string, workflowService: WorkflowService): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  const workflowLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many workflow submissions.",
          details: [],
          requestId: request.id
        }
      });
    }
  });

  for (const [path, workflowName] of workflowRoutes) {
    router.post(
      path,
      requirePermission("analysis.prepare"),
      validateBody(workflowJobBodySchema),
      requireProjectAccess(storage),
      workflowLimiter,
      async (request, response, next) => {
        try {
          const user = getAuthenticatedUser(request);
          const job = workflowJobBodySchema.parse(request.body);
          const execution = await workflowService.start(workflowName, user.id, job);
          response.status(202).json({ success: true, data: execution, requestId: request.id });
        } catch (error) {
          next(error);
        }
      }
    );
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
