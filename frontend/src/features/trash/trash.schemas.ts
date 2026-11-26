import { z } from "zod";

const timestampSchema = z.iso.datetime();

export const trashResourceTypeSchema = z.enum([
  "project",
  "document",
  "requirement",
  "artifact",
]);

export const trashResourceSchema = z
  .object({
    id: z.string().min(1),
    resourceType: trashResourceTypeSchema,
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    label: z.string().min(1),
    trashedAt: timestampSchema,
    purgeAfter: timestampSchema,
    trashedByUserId: z.string().min(1),
  })
  .strict();

export const trashItemSchema = trashResourceSchema
  .extend({
    canRestore: z.boolean(),
    canPurge: z.boolean(),
  })
  .strict();

export const trashPageSchema = z
  .object({
    items: z.array(trashItemSchema),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export type TrashItem = z.infer<typeof trashItemSchema>;
export type TrashResourceType = z.infer<typeof trashResourceTypeSchema>;
