import { z } from "zod";

export const workflowNames = [
  "requirements-analysis",
  "requirements-extraction",
  "story-generation",
  "acceptance-criteria-generation",
  "requirements-validation",
  "risk-analysis",
  "roadmap-generation",
] as const;

export const workflowNameSchema = z.enum(workflowNames);
export const executionStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const workflowJobSchema = z
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
        message: "Confirm document sharing before submitting this workflow.",
      });
    }
    if (!includesDocuments && request.shareDocumentContent === true) {
      context.addIssue({
        code: "custom",
        path: ["shareDocumentContent"],
        message: "Document-sharing confirmation requires selected documents.",
      });
    }
  });

export const workflowArtifactSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    type: z.enum([
      "epic",
      "story",
      "acceptance_criteria",
      "business_rule",
      "risk",
      "dependency",
      "implementation_plan",
    ]),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000),
    status: z.enum([
      "draft",
      "submitted",
      "changes_requested",
      "reviewed",
      "approved",
      "rejected",
    ]),
    requirementIds: z.array(z.string().min(1)).max(100),
    data: z.record(z.string(), z.unknown()),
    version: z.number().int().positive(),
    createdByUserId: z.string().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const workflowArtifactPageSchema = z
  .object({
    items: z.array(workflowArtifactSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const executionSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    workflowName: workflowNameSchema,
    status: executionStatusSchema,
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
          startedAt: z.iso.datetime().optional(),
          completedAt: z.iso.datetime().optional(),
          error: z.string().max(1000).optional(),
        })
        .strict(),
    ),
    result: z.record(z.string(), z.unknown()).optional(),
    error: z.string().max(1000).optional(),
    startedAt: z.iso.datetime().optional(),
    completedAt: z.iso.datetime().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    createdByUserId: z.string().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const workflowResultSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    requirementIds: z.array(z.string().min(1)).max(100),
    artifactIds: z.array(z.string().min(1)).max(100),
    stakeholders: z.array(z.string().min(1)).max(30).default([]),
    assumptions: z
      .array(z.string().trim().min(1).max(1000))
      .max(30)
      .default([]),
    openQuestions: z
      .array(z.string().trim().min(1).max(1000))
      .max(60)
      .default([]),
    recommendations: z
      .array(z.string().trim().min(1).max(1000))
      .max(20)
      .default([]),
    uncertainties: z
      .array(z.string().trim().min(1).max(1000))
      .max(30)
      .default([]),
    clarificationRequired: z.boolean().default(false),
    findings: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
  })
  .strict();

export type WorkflowName = z.infer<typeof workflowNameSchema>;
export type WorkflowJob = z.infer<typeof workflowJobSchema>;
export type WorkflowArtifact = z.infer<typeof workflowArtifactSchema>;
export type WorkflowArtifactPage = z.infer<typeof workflowArtifactPageSchema>;
export type Execution = z.infer<typeof executionSchema>;
export type WorkflowResult = z.infer<typeof workflowResultSchema>;
