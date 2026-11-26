import { z } from "zod";

const timestampSchema = z.iso.datetime();

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

export const projectPageSchema = z
  .object({
    items: z.array(projectSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
  })
  .strict();

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a project name.").max(160),
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
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;
export type ProjectPage = z.infer<typeof projectPageSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export function hasProjectContext(project: Project): boolean {
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

export function getProjectSummary(project: Project): string {
  return (
    project.businessObjective ||
    project.description ||
    project.inScope ||
    "No project context has been added."
  );
}
