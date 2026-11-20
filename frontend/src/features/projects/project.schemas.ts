import { z } from "zod";

const timestampSchema = z.iso.datetime();

export const projectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4000),
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
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;
export type ProjectPage = z.infer<typeof projectPageSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
