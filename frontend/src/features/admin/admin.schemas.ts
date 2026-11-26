import { z } from "zod";
import { userRoles } from "../auth/auth.schemas";

const pageSchema = <T extends z.ZodType>(itemSchema: T) =>
  z
    .object({
      items: z.array(itemSchema),
      page: z.number().int().positive(),
      limit: z.number().int().positive().max(100),
      total: z.number().int().nonnegative(),
    })
    .strict();

export const adminUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    roles: z.array(z.enum(userRoles)),
    active: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const adminUserPageSchema = pageSchema(adminUserSchema);

export const auditEventSchema = z
  .object({
    id: z.string().min(1),
    actorUserId: z.string().min(1),
    action: z.enum([
      "admin.bootstrap",
      "user.registered",
      "user.roles_changed",
      "user.deactivated",
      "user.reactivated",
      "user.invited",
      "user.invitation_resent",
      "user.invitation_accepted",
      "audit.exported",
      "project.created",
      "project.exported",
      "project.updated",
      "project.members_changed",
      "project.member_invited",
      "project.member_invitation_accepted",
      "project.member_invitation_rejected",
      "project.member_invitation_cancelled",
      "document.uploaded",
      "document.archived",
      "document.restored",
      "requirement.created",
      "requirement.updated",
      "artifact.created",
      "artifact.updated",
      "workflow.started",
      "template.created",
      "template.updated",
      "template.activated",
      "template.deactivated",
      "approval.submitted",
      "approval.decided",
      "delivery.feedback_added",
      "password_reset.requested",
      "password_reset.completed",
      "google.login",
      "google.account_created",
    ]),
    resourceType: z.enum([
      "user",
      "project",
      "document",
      "requirement",
      "artifact",
      "execution",
      "approval",
      "template",
      "audit_event",
    ]),
    resourceId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    actorEmail: z.email().optional(),
    resourceLabel: z.string().min(1).optional(),
    projectName: z.string().min(1).optional(),
    before: z.record(z.string(), z.unknown()).optional(),
    after: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const auditEventPageSchema = pageSchema(auditEventSchema);
export const updateUserRolesSchema = z
  .array(z.enum(userRoles))
  .max(userRoles.length)
  .refine(
    (roles) => !roles.includes("admin") || roles.length === 1,
    "Administrator accounts cannot be combined with project roles.",
  );
export const bootstrapAdminResponseSchema = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    roles: z.array(z.enum(userRoles)),
    requiresLogin: z.literal(true),
  })
  .strict();

export const inviteUserInputSchema = z
  .object({
    email: z.string().trim().pipe(z.email()),
    message: z.string().trim().min(3).max(500),
    roles: z
      .array(z.enum(userRoles))
      .min(1)
      .max(userRoles.length)
      .refine((roles) => new Set(roles).size === roles.length)
      .refine(
        (roles) => !roles.includes("admin") || roles.length === 1,
        "Administrator accounts cannot be combined with project roles.",
      ),
  })
  .strict();

export const inviteUserResponseSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        email: z.email(),
        roles: z.array(z.enum(userRoles)),
        active: z.boolean(),
      })
      .strict(),
    invitationUrl: z.url(),
    expiresAt: z.iso.datetime(),
    invitationResent: z.boolean(),
    emailStatus: z.enum(["sent", "disabled", "failed"]),
  })
  .strict();

export const projectAccessSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["active", "archived"]),
    ownerUserId: z.string().min(1),
    memberCount: z.number().int().nonnegative(),
    memberIds: z.array(z.string().min(1)).optional(),
  })
  .strict();
export const projectAccessPageSchema = pageSchema(projectAccessSchema);
export const updateProjectMembersSchema = z
  .object({ memberIds: z.array(z.string().min(1)) })
  .strict();
export const projectMemberSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().min(1),
    roles: z.array(z.enum(userRoles)),
    active: z.boolean(),
  })
  .strict();
export const projectMemberPageSchema = pageSchema(projectMemberSchema);
export const projectMembershipUpdateSchema = z
  .object({
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    memberId: z.string().min(1),
    memberCount: z.number().int().nonnegative(),
    alreadyMember: z.boolean().optional(),
    removed: z.boolean().optional(),
    invitationId: z.string().min(1).optional(),
    invitationPending: z.boolean().optional(),
    invitationResent: z.boolean().optional(),
    invitationCancelled: z.boolean().optional(),
    emailStatus: z.enum(["sent", "disabled", "failed"]).optional(),
  })
  .strict();
const membershipInvitationResultSchema = z
  .object({
    invitationId: z.string().min(1),
    invitedUserId: z.string().min(1),
    emailStatus: z.enum(["sent", "disabled", "failed"]),
    alreadyPending: z.boolean(),
  })
  .strict();
export const projectMembershipReplacementSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["active", "archived"]),
    ownerUserId: z.string().min(1),
    memberIds: z.array(z.string().min(1)),
    memberCount: z.number().int().nonnegative(),
    invitations: z.array(membershipInvitationResultSchema),
  })
  .strict();

export const templateTypes = [
  "project_intake",
  "requirements",
  "epics_stories",
  "acceptance_criteria",
  "risks_roadmaps",
] as const;
export const templateTypeSchema = z.enum(templateTypes);
export const adminTemplateSchema = z
  .object({
    id: z.string().min(1),
    type: templateTypeSchema,
    name: z.string().min(1).max(120),
    description: z.string().max(1000),
    instructions: z.string().min(1).max(10000),
    status: z.enum(["active", "inactive"]),
    createdByUserId: z.string().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const createTemplateSchema = adminTemplateSchema
  .pick({ type: true, name: true, description: true, instructions: true })
  .strict();

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type AdminTemplate = z.infer<typeof adminTemplateSchema>;
export type TemplateType = z.infer<typeof templateTypeSchema>;
export type UserRole = (typeof userRoles)[number];
export type InviteUserInput = z.infer<typeof inviteUserInputSchema>;
export type InviteUserResponse = z.infer<typeof inviteUserResponseSchema>;
export type ProjectAccess = z.infer<typeof projectAccessSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
