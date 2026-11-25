import { Router } from "express";
import { z } from "zod";
import {
  TrashConflictError,
  TrashRetentionError,
  type Storage,
  type TrashResourceType,
} from "../../config/storage";
import { hasPermission } from "../../common/authorization/permissions";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import {
  getAuthenticatedUser,
  getRouteParam,
} from "../../common/middleware/current-user";
import { requirePermission } from "../../common/middleware/authorization";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";

const resourceTypeSchema = z.enum([
  "project",
  "document",
  "requirement",
  "artifact",
]);

const purgeBodySchema = z
  .object({
    confirmation: z.string().trim().min(1).max(240),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();

export function createTrashRouter(storage: Storage, jwtSecret: string): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.get(
    "/",
    requirePermission("project.read", "admin.trash"),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const { page, limit } = parsePagination(request.query);
        const items = await storage.listTrash(
          user.id,
          hasPermission(user.roles, "admin.trash"),
          page,
          limit,
        );
        const isAdmin = hasPermission(user.roles, "admin.trash");
        const responseItems = await Promise.all(
          items.items.map(async (item) => {
            const record = await storage.getTrashedResource(
              item.resourceType,
              item.id,
            );
            return {
              ...item,
              canRestore: Boolean(
                isAdmin ||
                  item.trashedByUserId === user.id ||
                  record?.ownerUserId === user.id,
              ),
              canPurge:
                hasPermission(user.roles, "admin.trash.purge") &&
                Date.now() >= Date.parse(item.purgeAfter),
            };
          }),
        );
        response
          .status(200)
          .json({
            success: true,
            data: { ...items, items: responseItems },
            requestId: request.id,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:resourceType/:id", async (request, response, next) => {
    try {
      const resourceType = parseResourceType(getRouteParam(request, "resourceType"));
      const resourceId = getRouteParam(request, "id");
      const user = getAuthenticatedUser(request);
      const isAdmin = hasPermission(user.roles, "admin.trash");

      if (resourceType === "project") {
        const project = await storage.getProject(resourceId);
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        if (!isAdmin && project.ownerUserId !== user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the project owner can move this project to Trash.",
          );
        }
      } else if (resourceType === "document") {
        const document = await storage.getDocument(resourceId);
        const project = document
          ? await storage.getProject(document.projectId)
          : null;
        if (!document || !project) {
          throw new AppError(404, "NOT_FOUND", "Document not found.");
        }
        if (!isAdmin && project.ownerUserId !== user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the project owner can move this document to Trash.",
          );
        }
      } else {
        if (!hasPermission(user.roles, "analysis.prepare")) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "You do not have permission to move drafts to Trash.",
          );
        }
        const record =
          resourceType === "requirement"
            ? await storage.getRequirement(resourceId)
            : await storage.getArtifactById(resourceId);
        if (!record || !(await storage.userCanAccessProject(record.projectId, user.id))) {
          throw new AppError(404, "NOT_FOUND", "Draft not found.");
        }
        if (record.createdByUserId !== user.id || record.status !== "draft") {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the author can move their unsubmitted draft to Trash.",
          );
        }
      }

      const item = await storage.trashResource(
        resourceType,
        resourceId,
        user.id,
      );
      if (!item) {
        throw new AppError(404, "NOT_FOUND", "Record not found.");
      }
      response
        .status(200)
        .json({ success: true, data: item, requestId: request.id });
    } catch (error) {
      next(mapTrashError(error));
    }
  });

  router.patch(
    "/:resourceType/:id/restore",
    async (request, response, next) => {
      try {
        const resourceType = parseResourceType(
          getRouteParam(request, "resourceType"),
        );
        const resourceId = getRouteParam(request, "id");
        const user = getAuthenticatedUser(request);
        const item = await storage.getTrashedResource(resourceType, resourceId);
        if (!item) {
          throw new AppError(404, "NOT_FOUND", "Trashed record not found.");
        }
        if (
          item.trashedByUserId !== user.id &&
          item.ownerUserId !== user.id &&
          !hasPermission(user.roles, "admin.trash")
        ) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the person who moved this record to Trash, its project owner, or an administrator can restore it.",
          );
        }
        const restored = await storage.restoreTrashResource(
          resourceType,
          resourceId,
          user.id,
        );
        if (!restored) {
          throw new AppError(404, "NOT_FOUND", "Trashed record not found.");
        }
        response
          .status(200)
          .json({ success: true, data: restored, requestId: request.id });
      } catch (error) {
        next(mapTrashError(error));
      }
    },
  );

  router.delete(
    "/:resourceType/:id/purge",
    requirePermission("admin.trash.purge"),
    validateBody(purgeBodySchema),
    async (request, response, next) => {
      try {
        const resourceType = parseResourceType(
          getRouteParam(request, "resourceType"),
        );
        const resourceId = getRouteParam(request, "id");
        const item = await storage.getTrashedResource(resourceType, resourceId);
        if (!item) {
          throw new AppError(404, "NOT_FOUND", "Trashed record not found.");
        }
        if (request.body.confirmation !== item.label) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Type the record name exactly to confirm permanent deletion.",
          );
        }
        const purged = await storage.purgeTrashResource(
          resourceType,
          resourceId,
          getAuthenticatedUser(request).id,
          request.body.reason,
        );
        if (!purged) {
          throw new AppError(404, "NOT_FOUND", "Trashed record not found.");
        }
        response
          .status(200)
          .json({ success: true, data: purged, requestId: request.id });
      } catch (error) {
        next(mapTrashError(error));
      }
    },
  );

  return router;
}

function parseResourceType(value: string): TrashResourceType {
  const parsed = resourceTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(404, "NOT_FOUND", "Trash record not found.");
  }
  return parsed.data;
}

function mapTrashError(error: unknown): unknown {
  if (error instanceof TrashRetentionError) {
    return new AppError(
      409,
      "CONFLICT",
      "Permanent deletion is available only after the 30-day retention period.",
    );
  }
  if (error instanceof TrashConflictError) {
    return new AppError(409, "CONFLICT", error.message);
  }
  return error;
}
