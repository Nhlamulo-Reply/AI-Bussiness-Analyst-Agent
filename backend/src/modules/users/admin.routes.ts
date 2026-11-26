import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../../config/env";
import {
  InvalidUserRolesError,
  DuplicateTemplateError,
  LastActiveAdminError,
  ProjectMembershipAlreadyActiveError,
  ProjectMembershipInviteeIneligibleError,
  ProjectMembershipProjectInactiveError,
  type Storage,
} from "../../config/storage";
import { DuplicateUserError } from "../auth/user.repository";
import { AppError } from "../../common/errors/app-error";
import { authenticate } from "../../common/middleware/authentication";
import {
  getAuthenticatedUser,
  getRouteParam,
} from "../../common/middleware/current-user";
import { parsePagination } from "../../common/utils/pagination";
import { validateBody } from "../../common/middleware/validation";
import {
  projectMembersBodySchema,
  templateTypeSchema,
} from "../domain/domain.schemas";
import { hasExclusiveAdminRole, userRoles } from "../auth/user.repository";
import { requirePermission } from "../../common/middleware/authorization";
import type { Logger } from "pino";
import type { EmailProvider } from "../../integrations/email/email-provider";
import type { ApplicationEmailNotifications } from "../../integrations/email/application-email-notifications";

const activeStatusSchema = z.object({ active: z.boolean() }).strict();
const addProjectMemberSchema = z
  .object({ memberId: z.string().min(1).max(128) })
  .strict();
const adminSearchSchema = z.string().trim().max(120).optional();
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

const invitationSchema = z
  .object({
    email: z.string().trim().pipe(z.email()),
    message: z.string().trim().min(3).max(500),
    roles: z
      .array(z.enum(userRoles))
      .min(1)
      .max(userRoles.length)
      .refine((roles) => new Set(roles).size === roles.length),
  })
  .strict()
  .refine(
    ({ roles }) => hasExclusiveAdminRole(roles),
    "Administrator accounts cannot be combined with project roles.",
  );

export function createAdminRouter(
  storage: Storage,
  config: Pick<
    AppConfig,
    | "jwtSecret"
    | "passwordResetTtlSeconds"
    | "passwordResetFrontendUrl"
    | "emailProvider"
    | "smtpHost"
    | "smtpPort"
    | "smtpSecure"
    | "smtpUser"
    | "smtpPass"
    | "emailFrom"
  >,
  emailProvider: EmailProvider,
  logger: Logger,
  emailNotifications: ApplicationEmailNotifications,
): Router {
  const router = Router();
  router.use(authenticate(config.jwtSecret, storage));

  router.get(
    "/users",
    requirePermission("admin.users"),
    async (request, response, next) => {
      try {
        const { page, limit } = parsePagination(request.query);
        const search = parseAdminSearch(request.query.search);
        const users = await storage.listUsers(page, limit, search);
        response
          .status(200)
          .json({ success: true, data: users, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/users/invitations",
    requirePermission("admin.users"),
    validateBody(invitationSchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const rawToken = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const ttl = config.passwordResetTtlSeconds ?? 900;
        const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
        const setupUrl = new URL(
          config.passwordResetFrontendUrl ??
            "http://localhost:5173/reset-password",
        );
        setupUrl.searchParams.set("token", rawToken);
        const invitation = await storage.createInvitedUser({
          email: request.body.email.trim().toLowerCase(),
          roles: request.body.roles,
          tokenHash,
          expiresAt,
          actorUserId: actor.id,
        });
        let emailStatus: "sent" | "disabled" | "failed";
        try {
          emailStatus = await emailProvider.sendInvitation(
            invitation.user.email,
            setupUrl.toString(),
            request.body.message,
            actor.email,
            expiresAt,
          );
        } catch (error) {
          emailStatus = "failed";
          logger.error(
            {
              errorName: error instanceof Error ? error.name : "UnknownError",
              invitationUserId: invitation.user.id,
            },
            "Invitation email delivery failed",
          );
        }
        response.status(invitation.resent ? 200 : 201).json({
          success: true,
          data: {
            user: {
              id: invitation.user.id,
              email: invitation.user.email,
              roles: invitation.user.roles,
              active: invitation.user.active,
            },
            invitationUrl: setupUrl.toString(),
            expiresAt,
            invitationResent: invitation.resent,
            emailStatus,
            emailSent: emailStatus === "sent",
          },
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof DuplicateUserError) {
          next(
            new AppError(
              409,
              "EMAIL_ALREADY_REGISTERED",
              "An account with this email already exists.",
            ),
          );
          return;
        }
        if (error instanceof InvalidUserRolesError) {
          next(new AppError(400, "VALIDATION_ERROR", error.message));
          return;
        }
        next(error);
      }
    },
  );

  router.patch(
    "/users/:id/active",
    requirePermission("admin.users"),
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

  router.get(
    "/project-access",
    requirePermission("admin.project_access"),
    async (request, response, next) => {
      try {
        const { page, limit } = parsePagination(request.query);
        const search = parseAdminSearch(request.query.search);
        const projects = await storage.listProjectAccess(page, limit, search);
        response
          .status(200)
          .json({ success: true, data: projects, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/project-access/:id/members",
    requirePermission("admin.project_access"),
    async (request, response, next) => {
      try {
        const projectId = getRouteParam(request, "id");
        if (!(await storage.getProject(projectId))) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        const { page, limit } = parsePagination(request.query);
        const search = parseAdminSearch(request.query.search);
        const members = await storage.listProjectMembers(
          projectId,
          page,
          limit,
          search,
        );
        response.status(200).json({
          success: true,
          data: members,
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/project-access/:id/members",
    requirePermission("admin.project_access"),
    validateBody(addProjectMemberSchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        const memberId = request.body.memberId as string;
        const project = await storage.getProject(projectId);
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        const member = await storage.findById(memberId);
        if (
          !member ||
          !member.active ||
          member.roles.length === 0 ||
          member.roles.includes("admin") ||
          project.ownerUserId === memberId
        ) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Project members must be active non-administrator users who are not the project owner.",
            [
              {
                field: "memberId",
                reason: "Choose an eligible active project user.",
              },
            ],
          );
        }
        const alreadyMember =
          project.ownerUserId === memberId || project.members.includes(memberId);
        if (alreadyMember) {
          response.status(200).json({
            success: true,
            data: {
              projectId: project.id,
              projectName: project.name,
              memberId,
              memberCount: project.members.length,
              alreadyMember: true,
            },
            requestId: request.id,
          });
          return;
        }
        const invitation = await storage.createProjectMembershipInvitation(
          projectId,
          memberId,
          actor.id,
        );
        if (!invitation) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        const emailStatus = await emailNotifications.projectMemberInvited(
          invitation.invitation.id,
          member,
          actor,
          project,
        );
        response.status(200).json({
          success: true,
          data: {
            projectId: project.id,
            projectName: project.name,
            memberId,
            memberCount: project.members.length,
            alreadyMember: false,
            invitationId: invitation.invitation.id,
            invitationPending: true,
            invitationResent: invitation.alreadyPending,
            emailStatus,
          },
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof ProjectMembershipInviteeIneligibleError) {
          next(
            new AppError(
              400,
              "VALIDATION_ERROR",
              "Project members must be active non-administrator users with a project role.",
            ),
          );
          return;
        }
        if (
          error instanceof ProjectMembershipAlreadyActiveError ||
          error instanceof ProjectMembershipProjectInactiveError
        ) {
          next(new AppError(409, "CONFLICT", error.message));
          return;
        }
        next(error);
      }
    },
  );

  router.delete(
    "/project-access/:id/members/:memberId",
    requirePermission("admin.project_access"),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        const memberId = getRouteParam(request, "memberId");
        const project = await storage.getProject(projectId);
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        const removed = project.members.includes(memberId);
        const cancelledInvitation =
          await storage.cancelProjectMembershipInvitation(
            projectId,
            memberId,
            actor.id,
          );
        const updated = await storage.removeProjectMember(
          projectId,
          memberId,
          actor.id,
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        response.status(200).json({
          success: true,
          data: {
            projectId: updated.id,
            projectName: updated.name,
            memberId,
            memberCount: updated.members.length,
            removed,
            invitationCancelled: cancelledInvitation !== null,
          },
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/project-access/:id/members",
    requirePermission("admin.project_access"),
    validateBody(projectMembersBodySchema),
    async (request, response, next) => {
      try {
        const actor = getAuthenticatedUser(request);
        const projectId = getRouteParam(request, "id");
        const project = await storage.getProject(projectId);
        if (!project) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        for (const memberId of request.body.memberIds as string[]) {
          const member = await storage.findById(memberId);
          if (
            !member ||
            !member.active ||
            member.roles.length === 0 ||
            member.roles.includes("admin")
          ) {
            throw new AppError(
              400,
              "VALIDATION_ERROR",
              "Project members must be active non-administrator users.",
              [
                {
                  field: "memberIds",
                  reason:
                    "Every member must have an active project role and cannot be an administrator",
                },
              ],
            );
          }
        }
        const updated = await storage.replaceProjectMembersWithInvitations(
          projectId,
          request.body.memberIds as string[],
          actor.id,
        );
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "Project not found.");
        }
        const invitationResults = await Promise.all(
          updated.invitations.map(async ({ invitation, alreadyPending }) => {
            const invitee = await storage.findById(invitation.invitedUserId);
            if (!invitee) {
              return {
                invitationId: invitation.id,
                invitedUserId: invitation.invitedUserId,
                emailStatus: "failed" as const,
                alreadyPending,
              };
            }
            const emailStatus = await emailNotifications.projectMemberInvited(
              invitation.id,
              invitee,
              actor,
              updated.project,
            );
            return {
              invitationId: invitation.id,
              invitedUserId: invitation.invitedUserId,
              emailStatus,
              alreadyPending,
            };
          }),
        );
        response.status(200).json({
          success: true,
          data: {
            id: updated.project.id,
            name: updated.project.name,
            status: updated.project.status,
            ownerUserId: updated.project.ownerUserId,
            memberIds: updated.project.members,
            memberCount: updated.project.members.length,
            invitations: invitationResults,
          },
          requestId: request.id,
        });
      } catch (error) {
        if (error instanceof ProjectMembershipInviteeIneligibleError) {
          next(
            new AppError(
              400,
              "VALIDATION_ERROR",
              "Project members must be active non-administrator users with a project role.",
            ),
          );
          return;
        }
        if (error instanceof ProjectMembershipProjectInactiveError) {
          next(
            new AppError(
              409,
              "CONFLICT",
              "Archived projects cannot create membership invitations.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  router.get(
    "/templates",
    requirePermission("admin.templates"),
    async (request, response, next) => {
      try {
        const templates = await storage.listTemplates();
        response
          .status(200)
          .json({ success: true, data: templates, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/templates",
    requirePermission("admin.templates"),
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
    requirePermission("admin.templates"),
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

  router.get(
    "/audit-events/export",
    requirePermission("admin.audit"),
    async (request, response, next) => {
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
    },
  );

  router.get(
    "/audit-events",
    requirePermission("admin.audit"),
    async (request, response, next) => {
      try {
        const { page, limit } = parsePagination(request.query);
        const events = await storage.listAuditEventsWithLabels(page, limit);
        response
          .status(200)
          .json({ success: true, data: events, requestId: request.id });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function parseAdminSearch(value: unknown): string | undefined {
  const parsed = adminSearchSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "The search query is invalid.",
      parsed.error.issues.map((issue) => ({
        field: "search",
        reason: issue.message,
      })),
    );
  }
  return parsed.data || undefined;
}

function renderAuditCsv(
  events: Awaited<ReturnType<Storage["exportAuditEvents"]>>,
) {
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
