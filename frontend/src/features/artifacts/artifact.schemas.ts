import { z } from "zod";

export const artifactTypes = [
  "epic",
  "story",
  "acceptance_criteria",
  "business_rule",
  "risk",
  "dependency",
  "implementation_plan",
] as const;
export const artifactStatuses = [
  "draft",
  "reviewed",
  "approved",
  "rejected",
] as const;

export const artifactTypeSchema = z.enum(artifactTypes);
export const artifactStatusSchema = z.enum(artifactStatuses);

export const artifactSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    type: artifactTypeSchema,
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000),
    status: artifactStatusSchema,
    requirementIds: z.array(z.string().min(1)).max(100),
    data: z.record(z.string(), z.unknown()),
    version: z.number().int().positive(),
    createdByUserId: z.string().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const artifactPageSchema = z
  .object({
    items: z.array(artifactSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const artifactVersionSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    artifactType: z.enum(["requirement", ...artifactTypes]),
    artifactId: z.string().min(1),
    version: z.number().int().positive(),
    snapshot: z.record(z.string(), z.unknown()),
    actorUserId: z.string().min(1),
    reason: z.string().trim().max(1000),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const artifactVersionListSchema = z.array(artifactVersionSchema);

export const createArtifactSchema = z
  .object({
    type: artifactTypeSchema,
    title: z.string().trim().min(1, "Enter an artifact title.").max(240),
    description: z.string().trim().max(8000),
    requirementIds: z.array(z.string().min(1)).max(100),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

export const patchArtifactSchema = createArtifactSchema
  .omit({ type: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Change at least one editable field.",
  });

export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactPage = z.infer<typeof artifactPageSchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;
export type ArtifactVersion = z.infer<typeof artifactVersionSchema>;
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;
export type PatchArtifactInput = z.infer<typeof patchArtifactSchema>;
