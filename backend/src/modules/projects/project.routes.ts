import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { TextDecoder } from "node:util";
import { Router, type RequestHandler } from "express";
import multer, { MulterError } from "multer";
import { z } from "zod";
import type { Storage } from "../../config/storage";
import { AppError } from "../../common/errors/app-error";
import {
  getAuthenticatedUser,
  getRouteParam,
} from "../../common/middleware/current-user";
import { authenticate } from "../../common/middleware/authentication";
import { requirePermission } from "../../common/middleware/authorization";
import { requireProjectAccess } from "../../common/middleware/project-access";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";
import {
  createArtifactBodySchema,
  createProjectBodySchema,
  patchProjectBodySchema,
  projectMembersBodySchema,
} from "../domain/domain.schemas";
import { renderProjectExport } from "../exports/project-exporter";

const maxDocumentSizeBytes = 5 * 1024 * 1024;
const allowedFormats = new Map([
  [".pdf", "application/pdf"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [".txt", "text/plain"],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxDocumentSizeBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    if (allowedFormats.get(extension) !== file.mimetype) {
      callback(
        new AppError(
          400,
          "UNSUPPORTED_FILE_TYPE",
          "Upload a PDF, DOCX, or plain-text file.",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

export function createProjectRouter(
  storage: Storage,
  jwtSecret: string,
): Router {
  const router = Router();
  router.use(authenticate(jwtSecret, storage));

  router.post(
    "/",
    requirePermission("project.create"),
    validateBody(createProjectBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        if (request.body.intakeTemplateId) {
          const template = await storage.getTemplate(
            request.body.intakeTemplateId,
          );
          if (
            !template ||
            template.status !== "active" ||
            template.type !== "project_intake"
          ) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              "The selected project intake template is unavailable.",
            );
          }
        }
        const now = new Date().toISOString();
        const project = await storage.createProject({
          id: randomUUID(),
          ...request.body,
          ownerUserId: user.id,
          members: [],
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        response
          .status(201)
          .json({ success: true, data: project, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/", async (request, response, next) => {
    try {
      const user = getAuthenticatedUser(request);
      const { page, limit } = parsePagination(request.query);
      const result = await storage.listProjectsForUser(user.id, page, limit);
      response
        .status(200)
        .json({ success: true, data: result, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:id",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const project = await storage.getProject(getRouteParam(request, "id"));
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        response
          .status(200)
          .json({ success: true, data: project, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id",
    requireProjectAccess(storage),
    validateBody(patchProjectBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        const project = await storage.getProject(projectId);
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        if (project.ownerUserId !== user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the project owner can update project details.",
          );
        }
        const updated = await storage.updateProject(
          projectId,
          user.id,
          request.body,
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        response
          .status(200)
          .json({ success: true, data: updated, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/members",
    requireProjectAccess(storage),
    validateBody(projectMembersBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        const project = await storage.getProject(projectId);
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        if (project.ownerUserId !== user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the project owner can manage project members.",
          );
        }
        for (const memberId of request.body.memberIds as string[]) {
          const member = await storage.findById(memberId);
          if (!member || !member.active) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              "A member must be an active registered user.",
              [
                {
                  field: "memberIds",
                  reason: "Every member ID must belong to an active user",
                },
              ],
            );
          }
        }
        const updated = await storage.replaceProjectMembers(
          projectId,
          request.body.memberIds as string[],
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        response
          .status(200)
          .json({ success: true, data: updated, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/artifacts",
    requirePermission("analysis.prepare"),
    requireProjectAccess(storage),
    validateBody(createArtifactBodySchema),
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        for (const requirementId of request.body.requirementIds as string[]) {
          const requirement = await storage.getRequirement(requirementId);
          if (!requirement || requirement.projectId !== projectId) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              "A linked requirement does not belong to this project.",
              [
                {
                  field: "requirementIds",
                  reason:
                    "Requirement is missing or belongs to another project",
                },
              ],
            );
          }
        }
        const now = new Date().toISOString();
        const artifact = await storage.createArtifact({
          id: randomUUID(),
          projectId,
          ...request.body,
          status: "draft",
          version: 1,
          createdByUserId: user.id,
          createdAt: now,
          updatedAt: now,
        });
        response
          .status(201)
          .json({ success: true, data: artifact, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id/artifacts",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const { page, limit } = parsePagination(request.query);
        const artifacts = await storage.listArtifacts(
          getRouteParam(request, "id"),
          page,
          limit,
        );
        response
          .status(200)
          .json({ success: true, data: artifacts, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/documents",
    requirePermission("analysis.prepare"),
    requireProjectAccess(storage),
    handleSingleDocumentUpload,
    async (request, response, next) => {
      try {
        const user = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        const file = request.file;
        if (!file) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "A document file is required.",
          );
        }
        if (file.size === 0) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "The uploaded document must not be empty.",
          );
        }
        validateDocumentContents(file.buffer, file.mimetype);
        const parsedMimeType = z
          .enum([
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
          ])
          .safeParse(file.mimetype);
        if (!parsedMimeType.success) {
          throw new AppError(
            400,
            "UNSUPPORTED_FILE_TYPE",
            "Upload a PDF, DOCX, or plain-text file.",
          );
        }

        const fileName = basename(
          file.originalname.replace(/\\/g, "/"),
        ).replace(/[\x00-\x1f\x7f]/g, "");
        if (!fileName || fileName.length > 255) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "The document filename is invalid.",
          );
        }
        const document = await storage.createDocument({
          id: randomUUID(),
          projectId,
          uploadedByUserId: user.id,
          fileName,
          mimeType: parsedMimeType.data,
          sizeBytes: file.size,
          contentBase64: file.buffer.toString("base64"),
          status: "uploaded",
          createdAt: new Date().toISOString(),
        });
        const { contentBase64: _contentBase64, ...metadata } = document;
        response
          .status(201)
          .json({ success: true, data: metadata, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id/documents",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const projectId = getRouteParam(request, "id");
        const includeArchived = z
          .enum(["true", "false"])
          .safeParse(request.query.includeArchived ?? "false");
        if (!includeArchived.success) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "includeArchived must be true or false.",
          );
        }
        if (includeArchived.data === "true") {
          const project = await storage.getProject(projectId);
          const user = getAuthenticatedUser(request);
          if (!project || project.ownerUserId !== user.id) {
            throw new AppError(
              403,
              "FORBIDDEN",
              "Only the project owner can view archived documents.",
            );
          }
        }
        const documents = await storage.listDocuments(
          projectId,
          includeArchived.data === "true",
        );
        response.status(200).json({
          success: true,
          data: documents.map(
            ({ contentBase64: _contentBase64, ...metadata }) => metadata,
          ),
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/documents/:documentId/archive",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const projectId = getRouteParam(request, "id");
        const documentId = getRouteParam(request, "documentId");
        const user = getAuthenticatedUser(request);
        const project = await storage.getProject(projectId);
        const document = await storage.getDocument(documentId);
        if (!project || !document || document.projectId !== projectId) {
          throw new AppError(404, "NOT_FOUND", "Document not found.");
        }
        if (project.ownerUserId !== user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the project owner can archive documents.",
          );
        }
        const archived = await storage.archiveDocument(documentId, user.id);
        if (!archived) {
          throw new AppError(404, "NOT_FOUND", "Document not found.");
        }
        const { contentBase64: _contentBase64, ...metadata } = archived;
        response
          .status(200)
          .json({ success: true, data: metadata, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/documents/:documentId/restore",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const projectId = getRouteParam(request, "id");
        const documentId = getRouteParam(request, "documentId");
        const user = getAuthenticatedUser(request);
        const project = await storage.getProject(projectId);
        const document = await storage.getDocument(documentId);
        if (!project || !document || document.projectId !== projectId) {
          throw new AppError(404, "NOT_FOUND", "Document not found.");
        }
        if (project.ownerUserId !== user.id) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "Only the project owner can restore documents.",
          );
        }
        const restored = await storage.restoreDocument(documentId, user.id);
        if (!restored) {
          throw new AppError(404, "NOT_FOUND", "Document not found.");
        }
        const { contentBase64: _contentBase64, ...metadata } = restored;
        response
          .status(200)
          .json({ success: true, data: metadata, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id/export",
    requireProjectAccess(storage),
    async (request, response, next) => {
      try {
        const format = z
          .enum(["json", "markdown", "csv"])
          .safeParse(request.query.format ?? "json");
        if (!format.success) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Export format must be json, markdown, or csv.",
            [{ field: "format", reason: "Unsupported export format" }],
          );
        }
        const projectId = getRouteParam(request, "id");
        const content = await renderProjectExport(
          storage,
          projectId,
          format.data,
        );
        if (content === null) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        await storage.recordProjectExport(
          projectId,
          getAuthenticatedUser(request).id,
          format.data,
        );
        const mediaType =
          format.data === "json"
            ? "application/json"
            : format.data === "csv"
              ? "text/csv"
              : "text/markdown";
        response
          .status(200)
          .type(mediaType)
          .attachment(`project-${projectId}.${format.data}`)
          .send(content);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

const handleSingleDocumentUpload: RequestHandler = (
  request,
  response,
  next,
) => {
  upload.single("file")(request, response, (error: unknown) => {
    if (error instanceof MulterError) {
      const isLarge = error.code === "LIMIT_FILE_SIZE";
      next(
        new AppError(
          isLarge ? 413 : 400,
          isLarge ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
          isLarge
            ? "The document exceeds the 5 MB upload limit."
            : "The uploaded file is invalid.",
        ),
      );
      return;
    }
    next(error);
  });
};

function validateDocumentContents(contents: Buffer, mimeType: string): void {
  if (
    mimeType === "application/pdf" &&
    !contents.subarray(0, 5).equals(Buffer.from("%PDF-"))
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "The file content does not match a PDF document.",
    );
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    !contents.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "The file content does not match a DOCX document.",
    );
  }
  if (mimeType === "text/plain") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(contents);
      if (text.includes("\0")) {
        throw new Error("NUL character in text file");
      }
    } catch {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "The text document must contain valid UTF-8 text.",
      );
    }
  }
}
