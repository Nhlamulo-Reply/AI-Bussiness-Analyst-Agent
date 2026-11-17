import { z } from "zod";
import { AppError } from "../errors/app-error";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export function parsePagination(query: unknown): { page: number; limit: number } {
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "The pagination query is invalid.",
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "query",
        reason: issue.message
      }))
    );
  }
  return parsed.data;
}
