import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  ApprovalSubmissionError,
  ApprovalTransitionError,
  type Storage,
} from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { requirePermission } from "../../common/middleware/authorization";
import {
  getAuthenticatedUser,
  getRouteParam,
} from "../../common/middleware/current-user";
import { requireProjectAccess } from "../../common/middleware/project-access";
import {
  hasPermission,
  type Permission,
} from "../../common/authorization/permissions";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";
import {
  createApprovalBodySchema,
  createDeliveryFeedbackBodySchema,
  deliveryArtifactTypes,
  patchApprovalBodySchema,
  artifactTypes,
} from "../domain/domain.schemas";

const approvalDecisions = [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
] as const;
const approvalDecisionSchema = z.enum(approvalDecisions).optional();
const approvalArtifactTypeSchema = z.enum(["requirement", ...artifactTypes]);
const approvalReadPermissions: Record<
  z.infer<typeof approvalArtifactTypeSchema>,
  readonly Permission[]
> = {
  requirement: ["project.business.read"],
  epic: ["project.business.read"],
  story: ["project.business.read"],
  acceptance_criteria: ["project.business.read"],
  business_rule: ["project.business.read"],
  risk: ["project.delivery.read", "approval.decide_business"],
  dependency: ["project.delivery.read", "approval.decide_business"],
  implementation_plan: ["project.delivery.read", "approval.decide_business"],
};

export function createProjectApprovalRouter(
  storage: Storage,
  jwtSecret: string,
): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.get(
    "/:projectId/delivery-reviews",
    requirePermission("delivery.review"),
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const { page, limit } = parsePagination(request.query);
        const approvals = await storage.listApprovals(
          getRouteParam(request, "projectId"),
          page,
          limit,
          undefined,
          [...deliveryArtifactTypes],
        );
        const items = await Promise.all(
          approvals.items.map(async (approval) => {
            const resource = await storage.getArtifact(
              approval.artifactType,
              approval.artifactId,
            );
            if (!resource || resource.projectId !== approval.projectId) {
              throw new AppError(
                409,
                "CONFLICT",
                "A delivery review resource is unavailable.",
              );
            }
            return { approval, resource };
          }),
        );
        response.status(200).json({
          success: true,
          data: { ...approvals, items },
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:projectId/approvals",
    requirePermission("approval.decide_business"),
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const parsedDecision = approvalDecisionSchema.safeParse(
          request.query.decision,
        );
        if (!parsedDecision.success) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "The approval decision filter is invalid.",
            parsedDecision.error.issues.map((issue) => ({
              field: "decision",
              reason: issue.message,
            })),
          );
        }
        const { page, limit } = parsePagination(request.query);
        const approvals = await storage.listApprovals(
          getRouteParam(request, "projectId"),
          page,
          limit,
          parsedDecision.data,
        );
        response
          .status(200)
          .json({ success: true, data: approvals, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function createApprovalRouter(
  storage: Storage,
  jwtSecret: string,
): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.get("/artifact/:type/:artifactId", async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const parsedType = approvalArtifactTypeSchema.safeParse(
        getRouteParam(request, "type"),
      );
      if (!parsedType.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Specify a valid artifact type.",
          [{ field: "type", reason: "A supported artifact type is required" }],
        );
      }
      const artifactId = getRouteParam(request, "artifactId");
      const resource =
        parsedType.data === "requirement"
          ? await storage.getRequirement(artifactId)
          : await storage.getArtifact(parsedType.data, artifactId);
      if (
        !resource ||
        !(await storage.userCanAccessProject(resource.projectId, user.id))
      ) {
        throw new AppError(404, "NOT_FOUND", "Artifact not found.");
      }
      if (
        !approvalReadPermissions[parsedType.data].some((permission) =>
          hasPermission(user.roles, permission),
        )
      ) {
        throw new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to view this review history.",
        );
      }
      const approvals = await storage.listApprovalsForArtifact(
        parsedType.data,
        artifactId,
      );
      response.status(200).json({
        success: true,
        data: { items: approvals },
        requestId: request.id,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/",
    requirePermission("analysis.submit"),
    validateBody(createApprovalBodySchema),
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const artifact = await storage.getArtifact(
          request.body.artifactType,
          request.body.artifactId,
        );
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
          deliveryFeedback: [],
          createdAt: now,
          updatedAt: now,
        });
        response
          .status(201)
          .json({ success: true, data: approval, requestId: request.id });
      } catch (error) {
        next(
          error instanceof ApprovalSubmissionError
            ? new AppError(
                409,
                "CONFLICT",
                "Only draft artifacts without a pending approval can be submitted for review.",
              )
            : error,
        );
      }
    },
  );

  router.get(
    "/:id",
    requirePermission("approval.decide_business"),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const approval = await storage.getApproval(
          getRouteParam(request, "id"),
        );
        if (
          !approval ||
          !(await storage.userCanAccessProject(approval.projectId, user.id))
        ) {
          throw new AppError(404, "NOT_FOUND", "Approval not found.");
        }
        const resource = await storage.getArtifact(
          approval.artifactType,
          approval.artifactId,
        );
        if (!resource || resource.projectId !== approval.projectId) {
          throw new AppError(404, "NOT_FOUND", "Approval not found.");
        }
        response.status(200).json({
          success: true,
          data: { approval, resource },
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/delivery-feedback",
    requirePermission("delivery.review"),
    validateBody(createDeliveryFeedbackBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const approvalId = getRouteParam(request, "id");
        const approval = await storage.getApproval(approvalId);
        if (
          !approval ||
          !(await storage.userCanAccessProject(approval.projectId, user.id))
        ) {
          throw new AppError(404, "NOT_FOUND", "Approval not found.");
        }
        if (
          !deliveryArtifactTypes.some((type) => type === approval.artifactType)
        ) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Delivery feedback is only available for delivery artifacts.",
          );
        }
        const updated = await storage.addDeliveryFeedback(
          approvalId,
          user.id,
          request.body.comments,
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Approval not found.");
        }
        response.status(200).json({
          success: true,
          data: updated,
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id",
    requirePermission("approval.decide_business"),
    validateBody(patchApprovalBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const approvalId = getRouteParam(request, "id");
        const approval = await storage.getApproval(approvalId);
        if (
          !approval ||
          !(await storage.userCanAccessProject(approval.projectId, user.id))
        ) {
          throw new AppError(404, "NOT_FOUND", "Approval not found.");
        }
        if (approval.submittedByUserId === user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Reviewers cannot decide their own approval submissions.",
          );
        }

        const updated = await storage.decideApproval(
          approval.id,
          user.id,
          request.body.decision,
          request.body.reviewerComments ?? request.body.comments,
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Approval artifact not found.");
        }
        response
          .status(200)
          .json({ success: true, data: updated, requestId: request.id });
      } catch (error) {
        next(
          error instanceof ApprovalTransitionError
            ? new AppError(
                409,
                "CONFLICT",
                "This approval has already been decided.",
              )
            : error,
        );
      }
    },
  );

  return router;
}
