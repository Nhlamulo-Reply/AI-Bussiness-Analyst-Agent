import { z } from "zod";
import { artifactSchema, artifactTypes } from "../artifacts/artifact.schemas";
import { requirementSchema } from "../requirements/requirement.schemas";

export const approvalArtifactTypeSchema = z.enum([
  "requirement",
  ...artifactTypes,
]);
export const approvalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "changes_requested",
]);

export const approvalSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    artifactType: approvalArtifactTypeSchema,
    artifactId: z.string().min(1),
    submittedByUserId: z.string().min(1),
    reviewerUserId: z.string().min(1).optional(),
    decision: approvalStatusSchema,
    comments: z.string().trim().max(4000),
    reviewerComments: z.string().trim().max(4000).optional(),
    deliveryFeedback: z
      .array(
        z
          .object({
            reviewerUserId: z.string().min(1),
            comments: z.string().trim().min(1).max(4000),
            createdAt: z.iso.datetime(),
          })
          .strict(),
      )
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const approvalPageSchema = z
  .object({
    items: z.array(approvalSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const deliveryReviewItemSchema = z
  .object({
    approval: approvalSchema,
    resource: artifactSchema,
  })
  .strict();

export const deliveryReviewPageSchema = z
  .object({
    items: z.array(deliveryReviewItemSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const approvalDetailSchema = z
  .object({
    approval: approvalSchema,
    resource: z.union([requirementSchema, artifactSchema]),
  })
  .strict();

export const approvalHistorySchema = z
  .object({ items: z.array(approvalSchema) })
  .strict();

export const approvalDecisionSchema = z.enum([
  "approved",
  "rejected",
  "changes_requested",
]);

export const decideApprovalInputSchema = z
  .object({
    decision: approvalDecisionSchema,
    reviewerComments: z.string().trim().max(4000),
  })
  .strict();

export const createApprovalInputSchema = z
  .object({
    projectId: z.string().min(1).max(128),
    artifactType: approvalArtifactTypeSchema,
    artifactId: z.string().min(1).max(128),
    comments: z.string().trim().max(4000),
  })
  .strict();

export type Approval = z.infer<typeof approvalSchema>;
export type ApprovalPage = z.infer<typeof approvalPageSchema>;
export type ApprovalHistory = z.infer<typeof approvalHistorySchema>;
export type DeliveryReviewItem = z.infer<typeof deliveryReviewItemSchema>;
export type DeliveryReviewPage = z.infer<typeof deliveryReviewPageSchema>;
export type ApprovalDetail = z.infer<typeof approvalDetailSchema>;
export type ApprovalArtifactType = z.infer<typeof approvalArtifactTypeSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalInputSchema>;
export type CreateApprovalInput = z.infer<typeof createApprovalInputSchema>;

export function getApprovalSubmitterComments(approval: Approval): string {
  if (
    approval.reviewerComments === undefined &&
    approval.decision !== "pending"
  ) {
    return "";
  }
  return approval.comments;
}

export function getApprovalReviewerComments(
  approval: Approval,
): string | undefined {
  if (approval.reviewerComments !== undefined) {
    return approval.reviewerComments || undefined;
  }
  return approval.decision === "pending"
    ? undefined
    : approval.comments || undefined;
}
