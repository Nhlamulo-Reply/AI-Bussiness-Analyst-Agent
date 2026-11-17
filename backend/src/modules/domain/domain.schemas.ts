import { z } from "zod";
import { userRoles } from "../auth/user.repository";

export const artifactTypes = [
  "epic",
  "story",
  "acceptance_criteria",
  "business_rule",
  "risk",
  "dependency",
  "implementation_plan"
] as const;

export const artifactStatuses = ["draft", "reviewed", "approved", "rejected"] as const;

const timestampSchema = z.iso.datetime();
const stringArraySchema = z.array(z.string().trim().min(1).max(2000)).max(100);

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000),
  ownerUserId: z.string().min(1),
  members: z.array(z.string().min(1)),
  status: z.enum(["active", "archived"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const documentRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  uploadedByUserId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]),
  sizeBytes: z.number().int().positive(),
  contentBase64: z.string().min(1),
  status: z.literal("uploaded"),
  createdAt: timestampSchema
}).strict();

export const requirementSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(8000),
  type: z.enum(["business", "functional", "non_functional"]),
  status: z.enum(artifactStatuses),
  priority: z.enum(["low", "medium", "high", "critical"]),
  sourceFacts: stringArraySchema,
  assumptions: stringArraySchema,
  openQuestions: stringArraySchema,
  traceability: z.object({
    documentIds: z.array(z.string().min(1)).max(100),
    executionId: z.string().min(1).optional()
  }).strict(),
  version: z.number().int().positive(),
  createdByUserId: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const artifactSchema = z.object({
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
  updatedAt: timestampSchema
}).strict();

export const approvalSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  artifactType: z.enum(["requirement", ...artifactTypes]),
  artifactId: z.string().min(1),
  submittedByUserId: z.string().min(1),
  reviewerUserId: z.string().min(1).optional(),
  decision: z.enum(["pending", "approved", "rejected", "changes_requested"]),
  comments: z.string().trim().max(4000),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const versionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  artifactType: z.enum(["requirement", ...artifactTypes]),
  artifactId: z.string().min(1),
  version: z.number().int().positive(),
  snapshot: z.record(z.string(), z.unknown()),
  actorUserId: z.string().min(1),
  reason: z.string().trim().max(1000),
  createdAt: timestampSchema
}).strict();

export const executionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  workflowName: z.string().min(1).max(120),
  status: z.enum(["queued", "running", "completed", "failed"]),
  nodeStates: z.array(z.object({
    node: z.string().min(1),
    status: z.enum(["pending", "running", "completed", "failed"]),
    startedAt: timestampSchema.optional(),
    completedAt: timestampSchema.optional(),
    error: z.string().max(1000).optional()
  }).strict()),
  createdByUserId: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default("")
}).strict();

export const projectMembersBodySchema = z.object({
  memberIds: z.array(z.string().min(1).max(128)).max(100).refine(
    (memberIds) => new Set(memberIds).size === memberIds.length,
    "Member IDs must be unique."
  )
}).strict();

export const updateUserRolesBodySchema = z.object({
  roles: z.array(z.enum(userRoles)).min(1).max(4).refine(
    (roles) => new Set(roles).size === roles.length,
    "Roles must be unique."
  )
}).strict();

export const createArtifactBodySchema = z.object({
  type: z.enum(artifactTypes),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(8000).default(""),
  requirementIds: z.array(z.string().min(1)).max(100).default([]),
  data: z.record(z.string(), z.unknown()).default({})
}).strict();

export const createRequirementBodySchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(8000).default(""),
  type: z.enum(["business", "functional", "non_functional"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  sourceFacts: stringArraySchema.default([]),
  assumptions: stringArraySchema.default([]),
  openQuestions: stringArraySchema.default([]),
  documentIds: z.array(z.string().min(1)).max(100).default([])
}).strict();

export const patchRequirementBodySchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(8000).optional(),
  type: z.enum(["business", "functional", "non_functional"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  sourceFacts: stringArraySchema.optional(),
  assumptions: stringArraySchema.optional(),
  openQuestions: stringArraySchema.optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const createApprovalBodySchema = z.object({
  projectId: z.string().min(1).max(128),
  artifactType: z.enum(["requirement", ...artifactTypes]),
  artifactId: z.string().min(1).max(128),
  comments: z.string().trim().max(4000).default("")
}).strict();

export const patchApprovalBodySchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  comments: z.string().trim().max(4000).default("")
}).strict();

export const projectJobBodySchema = z.object({
  projectId: z.string().min(1).max(128),
  documentIds: z.array(z.string().min(1)).max(100).optional(),
  requirementIds: z.array(z.string().min(1)).max(100).optional(),
  storyId: z.string().min(1).optional()
}).strict();

export type ProjectRecord = z.infer<typeof projectSchema>;
export type DocumentRecord = z.infer<typeof documentRecordSchema>;
export type RequirementRecord = z.infer<typeof requirementSchema>;
export type ArtifactRecord = z.infer<typeof artifactSchema>;
export type ApprovalRecord = z.infer<typeof approvalSchema>;
export type VersionRecord = z.infer<typeof versionSchema>;
export type ExecutionRecord = z.infer<typeof executionSchema>;
export type ArtifactType = typeof artifactTypes[number];
export type ApprovalArtifactType = "requirement" | ArtifactType;
export type ApprovalDecision = "pending" | "approved" | "rejected" | "changes_requested";
