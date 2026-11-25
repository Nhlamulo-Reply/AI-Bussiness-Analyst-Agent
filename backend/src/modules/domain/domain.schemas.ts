import { z } from "zod";
import { userRoles } from "../auth/user.repository";

export const artifactTypes = [
  "epic",
  "story",
  "acceptance_criteria",
  "business_rule",
  "risk",
  "dependency",
  "implementation_plan",
] as const;

export const businessArtifactTypes = [
  "epic",
  "story",
  "acceptance_criteria",
  "business_rule",
] as const;

export const deliveryArtifactTypes = [
  "risk",
  "dependency",
  "implementation_plan",
] as const;

export const artifactStatuses = [
  "draft",
  "submitted",
  "changes_requested",
  "reviewed",
  "approved",
  "rejected",
] as const;

const timestampSchema = z.iso.datetime();
const stringArraySchema = z.array(z.string().trim().min(1).max(2000)).max(100);

export const projectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000),
    businessObjective: z.string().trim().max(4000).default(""),
    inScope: z.string().trim().max(4000).default(""),
    outOfScope: z.string().trim().max(4000).default(""),
    stakeholders: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .default([]),
    constraints: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
    desiredOutputs: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .default([]),
    intakeTemplateId: z.string().min(1).optional(),
    ownerUserId: z.string().min(1),
    members: z.array(z.string().min(1)),
    status: z.enum(["active", "archived"]),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const templateTypeSchema = z.enum([
  "project_intake",
  "requirements",
  "epics_stories",
  "acceptance_criteria",
  "risks_roadmaps",
]);

export const templateSchema = z
  .object({
    id: z.string().min(1),
    type: templateTypeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    instructions: z.string().trim().min(1).max(10000),
    status: z.enum(["active", "inactive"]),
    createdByUserId: z.string().min(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const documentRecordSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    uploadedByUserId: z.string().min(1),
    fileName: z.string().min(1).max(255),
    mimeType: z.enum([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]),
    sizeBytes: z.number().int().positive(),
    contentBase64: z.string().min(1),
    status: z.enum(["uploaded", "archived"]),
    archivedAt: timestampSchema.optional(),
    archivedByUserId: z.string().min(1).optional(),
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((document, context) => {
    const isArchived = document.status === "archived";
    const hasArchiveAt = document.archivedAt !== undefined;
    const hasArchiveActor = document.archivedByUserId !== undefined;
    if (
      (isArchived && !(hasArchiveAt && hasArchiveActor)) ||
      (!isArchived && (hasArchiveAt || hasArchiveActor))
    ) {
      context.addIssue({
        code: "custom",
        path: ["archivedAt"],
        message:
          "Archived documents require archive metadata and active documents must not retain it.",
      });
    }
  });

export const requirementSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000),
    type: z.enum(["business", "functional", "non_functional"]),
    status: z.enum(artifactStatuses),
    priority: z.enum(["low", "medium", "high", "critical"]),
    confidence: z.number().min(0).max(1).optional(),
    sourceFacts: stringArraySchema,
    assumptions: stringArraySchema,
    openQuestions: stringArraySchema,
    traceability: z
      .object({
        documentIds: z.array(z.string().min(1)).max(100),
        sourceFactReferences: z
          .array(
            z
              .object({
                documentId: z.string().min(1),
                text: z.string().trim().min(1).max(2000),
              })
              .strict(),
          )
          .max(100)
          .optional(),
        projectDescription: z.boolean().optional(),
        projectContext: z.boolean().optional(),
        executionId: z.string().min(1).optional(),
      })
      .strict(),
    version: z.number().int().positive(),
    createdByUserId: z.string().min(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const artifactSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    type: z.enum(artifactTypes),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000),
    status: z.enum(artifactStatuses),
    requirementIds: z.array(z.string().min(1)).max(100),
    data: z.record(z.string(), z.unknown()),
    version: z.number().int().positive(),
    createdByUserId: z.string().min(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const approvalSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    artifactType: z.enum(["requirement", ...artifactTypes]),
    artifactId: z.string().min(1),
    submittedByUserId: z.string().min(1),
    reviewerUserId: z.string().min(1).optional(),
    decision: z.enum(["pending", "approved", "rejected", "changes_requested"]),
    comments: z.string().trim().max(4000),
    reviewerComments: z.string().trim().max(4000).optional(),
    deliveryFeedback: z
      .array(
        z
          .object({
            reviewerUserId: z.string().min(1),
            comments: z.string().trim().min(1).max(4000),
            createdAt: timestampSchema,
          })
          .strict(),
      )
      .optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const versionSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    artifactType: z.enum(["requirement", ...artifactTypes]),
    artifactId: z.string().min(1),
    version: z.number().int().positive(),
    snapshot: z.record(z.string(), z.unknown()),
    actorUserId: z.string().min(1),
    reason: z.string().trim().max(1000),
    createdAt: timestampSchema,
  })
  .strict();

export const auditEventSchema = z
  .object({
    id: z.string().min(1),
    actorUserId: z.string().min(1),
    action: z.enum([
      "admin.bootstrap",
      "user.registered",
      "user.invited",
      "user.invitation_resent",
      "user.invitation_accepted",
      "user.roles_changed",
      "user.deactivated",
      "user.reactivated",
      "audit.exported",
      "project.created",
      "project.exported",
      "project.updated",
      "project.members_changed",
      "document.uploaded",
      "document.archived",
      "document.restored",
      "requirement.created",
      "requirement.updated",
      "artifact.created",
      "artifact.updated",
      "workflow.started",
      "template.created",
      "template.updated",
      "template.activated",
      "template.deactivated",
      "approval.submitted",
      "approval.decided",
      "delivery.feedback_added",
      "password_reset.requested",
      "password_reset.completed",
      "google.login",
      "google.account_created",
    ]),
    resourceType: z.enum([
      "user",
      "project",
      "document",
      "requirement",
      "artifact",
      "execution",
      "approval",
      "template",
      "audit_event",
    ]),
    resourceId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    before: z.record(z.string(), z.unknown()).optional(),
    after: z.record(z.string(), z.unknown()).optional(),
    createdAt: timestampSchema,
  })
  .strict();

export const executionSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    workflowName: z.string().min(1).max(120),
    status: z.enum(["queued", "running", "completed", "failed"]),
    model: z.string().min(1).max(100).optional(),
    usage: z
      .object({
        requestCount: z.number().int().nonnegative(),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    nodeStates: z.array(
      z
        .object({
          node: z.string().min(1),
          status: z.enum(["pending", "running", "completed", "failed"]),
          startedAt: timestampSchema.optional(),
          completedAt: timestampSchema.optional(),
          error: z.string().max(1000).optional(),
        })
        .strict(),
    ),
    result: z.record(z.string(), z.unknown()).optional(),
    error: z.string().max(1000).optional(),
    startedAt: timestampSchema.optional(),
    completedAt: timestampSchema.optional(),
    durationMs: z.number().int().nonnegative().optional(),
    createdByUserId: z.string().min(1),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000).default(""),
    businessObjective: z.string().trim().max(4000).default(""),
    inScope: z.string().trim().max(4000).default(""),
    outOfScope: z.string().trim().max(4000).default(""),
    stakeholders: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .default([]),
    constraints: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
    desiredOutputs: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .default([]),
    intakeTemplateId: z.string().min(1).optional(),
  })
  .strict();

export const patchProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).optional(),
    businessObjective: z.string().trim().max(4000).optional(),
    inScope: z.string().trim().max(4000).optional(),
    outOfScope: z.string().trim().max(4000).optional(),
    stakeholders: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    constraints: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
    desiredOutputs: z
      .array(z.string().trim().min(1).max(200))
      .max(50)
      .optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one project field to update.",
  });

export const projectMembersBodySchema = z
  .object({
    memberIds: z
      .array(z.string().min(1).max(128))
      .max(100)
      .refine(
        (memberIds) => new Set(memberIds).size === memberIds.length,
        "Member IDs must be unique.",
      ),
  })
  .strict();

export const updateUserRolesBodySchema = z
  .object({
    roles: z
      .array(z.enum(userRoles))
      .max(userRoles.length)
      .refine(
        (roles) => new Set(roles).size === roles.length,
        "Roles must be unique.",
      ),
  })
  .strict()
  .refine(
    ({ roles }) => !roles.includes("admin") || roles.length === 1,
    "Administrator accounts cannot be combined with project roles.",
  );

export const createArtifactBodySchema = z
  .object({
    type: z.enum(artifactTypes),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000).default(""),
    requirementIds: z.array(z.string().min(1)).max(100).default([]),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const bootstrapAdminBodySchema = z
  .object({
    token: z.string().min(32).max(256),
  })
  .strict();

export const createRequirementBodySchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000).default(""),
    type: z.enum(["business", "functional", "non_functional"]),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    sourceFacts: stringArraySchema.default([]),
    assumptions: stringArraySchema.default([]),
    openQuestions: stringArraySchema.default([]),
    documentIds: z.array(z.string().min(1)).max(100).default([]),
  })
  .strict();

export const patchRequirementBodySchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(8000).optional(),
    type: z.enum(["business", "functional", "non_functional"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    sourceFacts: stringArraySchema.optional(),
    assumptions: stringArraySchema.optional(),
    openQuestions: stringArraySchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const patchArtifactBodySchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(8000).optional(),
    requirementIds: z.array(z.string().min(1)).max(100).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field to update.",
  );

export const createApprovalBodySchema = z
  .object({
    projectId: z.string().min(1).max(128),
    artifactType: z.enum(["requirement", ...artifactTypes]),
    artifactId: z.string().min(1).max(128),
    comments: z.string().trim().max(4000).default(""),
  })
  .strict();

export const patchApprovalBodySchema = z
  .object({
    decision: z.enum(["approved", "rejected", "changes_requested"]),
    comments: z.string().trim().max(4000).default(""),
    reviewerComments: z.string().trim().max(4000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.reviewerComments === undefined || value.comments.length === 0,
    "Use either comments or reviewerComments, not both.",
  );

export const createDeliveryFeedbackBodySchema = z
  .object({
    comments: z.string().trim().min(1).max(4000),
  })
  .strict();

export const projectJobBodySchema = z
  .object({
    projectId: z.string().min(1).max(128),
    documentIds: z.array(z.string().min(1)).max(100).optional(),
    requirementIds: z.array(z.string().min(1)).max(100).optional(),
    storyId: z.string().min(1).optional(),
  })
  .strict();

export const workflowJobBodySchema = z
  .object({
    projectId: z.string().min(1).max(128),
    documentIds: z.array(z.string().min(1)).max(10).optional(),
    shareDocumentContent: z.boolean().optional(),
    requirementIds: z.array(z.string().min(1)).min(1).max(100).optional(),
    storyId: z.string().min(1).max(128).optional(),
    templateIds: z.array(z.string().min(1).max(128)).max(10).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (
      request.templateIds &&
      new Set(request.templateIds).size !== request.templateIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["templateIds"],
        message: "Template IDs must be unique.",
      });
    }
    const includesDocuments = (request.documentIds?.length ?? 0) > 0;
    if (includesDocuments && request.shareDocumentContent !== true) {
      context.addIssue({
        code: "custom",
        path: ["shareDocumentContent"],
        message:
          "Explicit confirmation is required when sharing document content.",
      });
    }
    if (!includesDocuments && request.shareDocumentContent === true) {
      context.addIssue({
        code: "custom",
        path: ["shareDocumentContent"],
        message:
          "Document-sharing confirmation requires at least one selected document.",
      });
    }
  });

export type ProjectRecord = z.infer<typeof projectSchema>;
export function hasProjectContext(project: ProjectRecord): boolean {
  return Boolean(
    project.description.trim() ||
    project.businessObjective.trim() ||
    project.inScope.trim() ||
    project.outOfScope.trim() ||
    project.stakeholders.length > 0 ||
    project.constraints.length > 0 ||
    project.desiredOutputs.length > 0,
  );
}
export type DocumentRecord = z.infer<typeof documentRecordSchema>;
export type RequirementRecord = z.infer<typeof requirementSchema>;
export type ArtifactRecord = z.infer<typeof artifactSchema>;
export type TemplateRecord = z.infer<typeof templateSchema>;
export type TemplateType = z.infer<typeof templateTypeSchema>;
export type ApprovalRecord = z.infer<typeof approvalSchema>;
export type VersionRecord = z.infer<typeof versionSchema>;
export type AuditEventRecord = z.infer<typeof auditEventSchema>;
export type ExecutionRecord = z.infer<typeof executionSchema>;
export type ArtifactType = (typeof artifactTypes)[number];
export type ApprovalArtifactType = "requirement" | ArtifactType;
export type ApprovalDecision =
  "pending" | "approved" | "rejected" | "changes_requested";
