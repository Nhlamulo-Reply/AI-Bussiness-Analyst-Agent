import { z } from "zod";

const timestampSchema = z.iso.datetime();
const requirementTypes = ["business", "functional", "non_functional"] as const;
const requirementStatuses = [
  "draft",
  "reviewed",
  "approved",
  "rejected",
] as const;
const requirementPriorities = ["low", "medium", "high", "critical"] as const;
const requirementStringListSchema = z
  .array(z.string().trim().min(1).max(2000))
  .max(100);

export const requirementTypeSchema = z.enum(requirementTypes);
export const requirementStatusSchema = z.enum(requirementStatuses);
export const requirementPrioritySchema = z.enum(requirementPriorities);

export const requirementSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000),
    type: requirementTypeSchema,
    status: requirementStatusSchema,
    priority: requirementPrioritySchema,
    confidence: z.number().min(0).max(1).optional(),
    sourceFacts: requirementStringListSchema,
    assumptions: requirementStringListSchema,
    openQuestions: requirementStringListSchema,
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

export const requirementPageSchema = z
  .object({
    items: z.array(requirementSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const requirementVersionSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    artifactType: z.literal("requirement"),
    artifactId: z.string().min(1),
    version: z.number().int().positive(),
    snapshot: z.record(z.string(), z.unknown()),
    actorUserId: z.string().min(1),
    reason: z.string().trim().max(1000),
    createdAt: timestampSchema,
  })
  .strict();

export const requirementVersionListSchema = z.array(requirementVersionSchema);

export const createRequirementSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a requirement title.").max(240),
    description: z.string().trim().max(8000),
    type: requirementTypeSchema,
    priority: requirementPrioritySchema,
    sourceFacts: requirementStringListSchema,
    assumptions: requirementStringListSchema,
    openQuestions: requirementStringListSchema,
    documentIds: z.array(z.string().min(1)).max(100),
  })
  .strict();

export const patchRequirementSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(8000).optional(),
    type: requirementTypeSchema.optional(),
    priority: requirementPrioritySchema.optional(),
    sourceFacts: requirementStringListSchema.optional(),
    assumptions: requirementStringListSchema.optional(),
    openQuestions: requirementStringListSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Change at least one editable field.",
  });

export type Requirement = z.infer<typeof requirementSchema>;
export type RequirementPage = z.infer<typeof requirementPageSchema>;
export type RequirementVersion = z.infer<typeof requirementVersionSchema>;
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type PatchRequirementInput = z.infer<typeof patchRequirementSchema>;
