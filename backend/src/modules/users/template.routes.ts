import { Router } from "express";
import { z } from "zod";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import { templateTypeSchema } from "../domain/domain.schemas";

const templateQuerySchema = z
  .object({ type: templateTypeSchema.optional() })
  .strict();

export function createTemplateRouter(
  storage: Storage,
  jwtSecret: string,
): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.get("/", async (request, response, next) => {
    try {
      const query = templateQuerySchema.safeParse(request.query);
      if (!query.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "The template type is invalid.",
          query.error.issues.map((issue) => ({
            field: issue.path.join("."),
            reason: issue.message,
          })),
        );
      }
      const templates = await storage.listTemplates(true, query.data.type);
      response
        .status(200)
        .json({ success: true, data: templates, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
