import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  DuplicateTemplateError,
  LastActiveAdminError,
  type Storage,
} from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import {
  authenticate,
  requireRoles,
} from "../../common/middleware/authentication";
import {
  getAuthenticatedUser,
  getRouteParam,
} from "../../common/middleware/current-user";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";
import { templateTypeSchema } from "../domain/domain.schemas";

const activeStatusSchema = z.object({ active: z.boolean() }).strict();
const createTemplateSchema = z
  .object({
    type: templateTypeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
    instructions: z.string().trim().min(1).max(10000),
  })
  .strict();
const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    instructions: z.string().trim().min(1).max(10000).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Provide at least one template field to update.",
  });

export function createAdminRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage), requireRoles("admin"));

  router.get("/users", async (request, response, next) => {
    try {
      const { page, limit } = parsePagination(request.query);
      const users = await storage.listUsers(page, limit);
      response
        .status(200)
        .json({ success: true, data: users, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/users/:id/active",
    validateBody(activeStatusSchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const userId = getRouteParam(request, "id");
        if (actor.id === userId && request.body.active === false) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Administrators cannot deactivate their own account.",
          );
        }
        const user = await storage.updateUserActiveStatus(
          userId,
          request.body.active,
          actor.id,
        );
        if (!user) {
          throw new AppError(404, "NOT_FOUND", "User not found.");
        }
        response.status(200).json({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            active: user.active,
          },
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof LastActiveAdminError) {
          next(new AppError(409, "CONFLICT", error.message));
          return;
        }
        next(error);
      }
    },
  );

  router.get("/templates", async (request, response, next) => {
    try {
      const templates = await storage.listTemplates();
      response
        .status(200)
        .json({ success: true, data: templates, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/templates",
    validateBody(createTemplateSchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const now = new Date().toISOString();
        const template = await storage.createTemplate({
          id: randomUUID(),
          ...request.body,
          status: "active",
          createdByUserId: actor.id,
          createdAt: now,
          updatedAt: now,
        });
        response
          .status(201)
          .json({ success: true, data: template, requestId: request.id });
      } catch (error) {
        if (error instanceof DuplicateTemplateError) {
          next(new AppError(409, "CONFLICT", error.message));
          return;
        }
        next(error);
      }
    },
  );

  router.patch(
    "/templates/:id",
    validateBody(updateTemplateSchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const template = await storage.updateTemplate(
          getRouteParam(request, "id"),
          actor.id,
          request.body,
        );
        if (!template) {
          throw new AppError(404, "NOT_FOUND", "Template not found.");
        }
        response
          .status(200)
          .json({ success: true, data: template, requestId: request.id });
      } catch (error) {
        if (error instanceof DuplicateTemplateError) {
          next(new AppError(409, "CONFLICT", error.message));
          return;
        }
        next(error);
      }
    },
  );

  router.get("/audit-events/export", async (request, response, next) => {
    try {
      const format = request.query.format ?? "json";
      if (format !== "json" && format !== "csv") {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Export format must be json or csv.",
        );
      }
      const actor = getAuthenticatedUser(request);
      const events = await storage.exportAuditEvents(actor.id);
      if (format === "csv") {
        response
          .status(200)
          .type("text/csv")
          .attachment("audit-events.csv")
          .send(renderAuditCsv(events));
        return;
      }
      response
        .status(200)
        .type("application/json")
        .attachment("audit-events.json")
        .send(JSON.stringify(events, null, 2));
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit-events", async (request, response, next) => {
    try {
      const { page, limit } = parsePagination(request.query);
      const events = await storage.listAuditEvents(page, limit);
      response
        .status(200)
        .json({ success: true, data: events, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function renderAuditCsv(events: Awaited<ReturnType<Storage["exportAuditEvents"]>>) {
  const columns = [
    "id",
    "actorUserId",
    "action",
    "resourceType",
    "resourceId",
    "projectId",
    "before",
    "after",
    "createdAt",
  ] as const;
  const rows = events.map((event) =>
    columns.map((column) => csvCell(event[column])),
  );
  return [columns.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}

function csvCell(value: unknown): string {
  let text =
    value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  if (/^[\s]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
