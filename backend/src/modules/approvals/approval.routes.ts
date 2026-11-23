import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { ApprovalSubmissionError, ApprovalTransitionError, type Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate, requireRoles } from "../../common/middleware/authentication";
import { getAuthenticatedUser, getRouteParam } from "../../common/middleware/current-user";
import { requireProjectAccess } from "../../common/middleware/project-access";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";
import { createApprovalBodySchema, patchApprovalBodySchema } from "../domain/domain.schemas";

const approvalDecisions = ["pending", "approved", "rejected", "changes_requested"] as const;
const approvalDecisionSchema = z.enum(approvalDecisions).optional();

export function createProjectApprovalRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

  router.get(
    "/:projectId/approvals",
    requireRoles("reviewer", "admin"),
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const parsedDecision = approvalDecisionSchema.safeParse(request.query.decision);
        if (!parsedDecision.success) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "The approval decision filter is invalid.",
            parsedDecision.error.issues.map((issue) => ({
              field: "decision",
              reason: issue.message
            }))
          );
        }
        const { page, limit } = parsePagination(request.query);
        const approvals = await storage.listApprovals(getRouteParam(request, "projectId"), page, limit, parsedDecision.data);
        response.status(200).json({ success: true, data: approvals, requestId: request.id });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export function createApprovalRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret));

  router.post("/", validateBody(createApprovalBodySchema), requireProjectAccess(storage), async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const artifact = await storage.getArtifact(request.body.artifactType, request.body.artifactId);
      if (!artifact || artifact.projectId !== request.body.projectId) {
        throw new AppError(404, "NOT_FOUND", "Artifact not found.");
      }
      const now = new Date().toISOString();
      const approval = await storage.createApproval({
        id: randomUUID(),
        projectId: request.body.projectId,
        artifactType: request.body.artifactType,
        artifactId: request.body.artifactId,
        submittedByUserId: user.id,
        decision: "pending",
        comments: request.body.comments,
        createdAt: now,
        updatedAt: now
      });
      response.status(201).json({ success: true, data: approval, requestId: request.id });
    } catch (error) {
      next(error instanceof ApprovalSubmissionError
        ? new AppError(409, "CONFLICT", "Only draft artifacts without a pending approval can be submitted for review.")
        : error);
    }
  });

  router.get("/:id", requireRoles("reviewer", "admin"), async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const approval = await storage.getApproval(getRouteParam(request, "id"));
      if (!approval || !(await storage.userCanAccessProject(approval.projectId, user.id))) {
        throw new AppError(404, "NOT_FOUND", "Approval not found.");
      }
      const resource = await storage.getArtifact(approval.artifactType, approval.artifactId);
      if (!resource || resource.projectId !== approval.projectId) {
        throw new AppError(404, "NOT_FOUND", "Approval not found.");
      }
      response.status(200).json({
        success: true,
        data: { approval, resource },
        requestId: request.id
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:id",
    requireRoles("reviewer", "admin"),
    validateBody(patchApprovalBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const approvalId = getRouteParam(request, "id");
        const approval = await storage.getApproval(approvalId);
        if (!approval || !(await storage.userCanAccessProject(approval.projectId, user.id))) {
          throw new AppError(404, "NOT_FOUND", "Approval not found.");
        }
        if (approval.submittedByUserId === user.id) {
          throw new AppError(403, "FORBIDDEN", "Reviewers cannot decide their own approval submissions.");
        }

        const updated = await storage.decideApproval(
          approval.id,
          user.id,
          request.body.decision,
          request.body.comments
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Approval artifact not found.");
        }
        response.status(200).json({ success: true, data: updated, requestId: request.id });
      } catch (error) {
        next(error instanceof ApprovalTransitionError
          ? new AppError(409, "CONFLICT", "This approval has already been decided.")
          : error);
      }
    }
  );

  return router;
}
