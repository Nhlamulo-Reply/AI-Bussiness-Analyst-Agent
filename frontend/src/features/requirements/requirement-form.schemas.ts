import { z } from "zod";
import {
  requirementPrioritySchema,
  requirementTypeSchema,
} from "./requirement.schemas";

const listFieldSchema = z
  .string()
  .transform((value) =>
    value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(1).max(2000)).max(100));

export const requirementFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a requirement title.").max(240),
    description: z.string().trim().max(8000),
    type: requirementTypeSchema,
    priority: requirementPrioritySchema,
    sourceFacts: listFieldSchema,
    assumptions: listFieldSchema,
    openQuestions: listFieldSchema,
    documentIds: z.array(z.string().min(1)).max(100),
  })
  .strict();

export type RequirementFormInput = z.input<typeof requirementFormSchema>;
export type RequirementFormValues = z.output<typeof requirementFormSchema>;
