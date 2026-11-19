import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { requireProjectAccess } from "../../common/middleware/project-access";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";
import { createRequirementBodySchema, patchRequirementBodySchema } from "../domain/domain.schemas";

export function createRequirementRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

  router.post(
    "/projects/:projectId/requirements",
    requireProjectAccess(storage),
    validateBody(createRequirementBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "projectId");
        const body = request.body as {
          title: string;
          description: string;
          type: "business" | "functional" | "non_functional";
          priority: "low" | "medium" | "high" | "critical";
          sourceFacts: string[];
          assumptions: string[];
          openQuestions: string[];
          documentIds: string[];
        };
        for (const documentId of body.documentIds) {
          const document = await storage.getDocument(documentId);
          if (!document || document.projectId !== projectId) {
            throw new AppError(400, "VALIDATION_ERROR", "A source document does not belong to this project.", [
              { field: "documentIds", reason: "Document is missing or belongs to another project" }
            ]);
          }
        }

        const now = new Date().toISOString();
        const requirement = await storage.createRequirement({
          id: randomUUID(),
          projectId,
          title: body.title,
          description: body.description,
          type: body.type,
          status: "draft",
          priority: body.priority,
          sourceFacts: body.sourceFacts,
          assumptions: body.assumptions,
          openQuestions: body.openQuestions,
          traceability: { documentIds: body.documentIds },
          version: 1,
          createdByUserId: user.id,
          createdAt: now,
          updatedAt: now
        });
        response.status(201).json({ success: true, data: requirement, requestId: request.id });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/projects/:projectId/requirements",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const { page, limit } = parsePagination(request.query);
        const requirements = await storage.listRequirements(getRouteParam(request, "projectId"), page, limit);
        response.status(200).json({ success: true, data: requirements, requestId: request.id });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/requirements/:id",
    validateBody(patchRequirementBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const requirement = await storage.getRequirement(getRouteParam(request, "id"));
        if (!requirement || !(await storage.userCanAccessProject(requirement.projectId, user.id))) {
          throw new AppError(404, "NOT_FOUND", "Requirement not found.");
        }

        const updated = await storage.reviseRequirement(requirement.id, user.id, request.body);
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Requirement not found.");
        }
        response.status(200).json({ success: true, data: updated, requestId: request.id });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/requirements/:id/versions", async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const requirementId = getRouteParam(request, "id");
      const requirement = await storage.getRequirement(requirementId);
      if (!requirement || !(await storage.userCanAccessProject(requirement.projectId, user.id))) {
        throw new AppError(404, "NOT_FOUND", "Requirement not found.");
      }
      const versions = await storage.listVersions("requirement", requirementId);
      response.status(200).json({ success: true, data: versions, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
