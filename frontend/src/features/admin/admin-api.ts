import { apiDownload, apiRequest } from "../../lib/api-client";
import { z } from "zod";
import {
  adminTemplateSchema,
  adminUserPageSchema,
  auditEventPageSchema,
  adminUserSchema,
  bootstrapAdminResponseSchema,
  createTemplateSchema,
  inviteUserInputSchema,
  inviteUserResponseSchema,
  projectAccessPageSchema,
  projectAccessSchema,
  projectMemberPageSchema,
  projectMembershipUpdateSchema,
  templateTypeSchema,
  updateUserRolesSchema,
  updateProjectMembersSchema,
  type AdminTemplate,
  type UserRole,
} from "./admin.schemas";

const templatesSchema = z.array(adminTemplateSchema);

export function claimFirstAdmin(token: string) {
  return apiRequest("/users/bootstrap-admin", {
    method: "POST",
    auth: "required",
    json: { token },
    schema: bootstrapAdminResponseSchema,
  });
}

export function listAdminUsers(signal?: AbortSignal) {
  return apiRequest("/admin/users?page=1&limit=100", {
    auth: "required",
    schema: adminUserPageSchema,
    signal,
  });
}

export function inviteAdminUser(input: z.input<typeof inviteUserInputSchema>) {
  return apiRequest("/admin/users/invitations", {
    method: "POST",
    auth: "required",
    json: inviteUserInputSchema.parse(input),
    schema: inviteUserResponseSchema,
  });
}

export function listAdminProjectAccess(signal?: AbortSignal) {
  return listAdminProjectAccessPage({}, signal);
}

export function listAdminProjectAccessPage(
  {
    page = 1,
    limit = 10,
    search,
  }: { page?: number; limit?: number; search?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search?.trim()) query.set("search", search.trim());
  return apiRequest(`/admin/project-access?${query}`, {
    auth: "required",
    schema: projectAccessPageSchema,
    signal,
  });
}

export function searchAdminUsers(
  {
    page = 1,
    limit = 10,
    search,
  }: { page?: number; limit?: number; search: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search: search.trim(),
  });
  return apiRequest(`/admin/users?${query}`, {
    auth: "required",
    schema: adminUserPageSchema,
    signal,
  });
}

export function listAdminProjectMembers(
  projectId: string,
  {
    page = 1,
    limit = 10,
    search,
  }: { page?: number; limit?: number; search?: string },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search?.trim()) query.set("search", search.trim());
  return apiRequest(
    `/admin/project-access/${encodeURIComponent(projectId)}/members?${query}`,
    {
      auth: "required",
      schema: projectMemberPageSchema,
      signal,
    },
  );
}

export function addAdminProjectMember(projectId: string, memberId: string) {
  return apiRequest(
    `/admin/project-access/${encodeURIComponent(projectId)}/members`,
    {
      method: "POST",
      auth: "required",
      json: { memberId },
      schema: projectMembershipUpdateSchema,
    },
  );
}

export function removeAdminProjectMember(projectId: string, memberId: string) {
  return apiRequest(
    `/admin/project-access/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: "DELETE",
      auth: "required",
      schema: projectMembershipUpdateSchema,
    },
  );
}

export function updateAdminProjectMembers(
  projectId: string,
  memberIds: string[],
) {
  const json = updateProjectMembersSchema.parse({ memberIds });
  return apiRequest(
    `/admin/project-access/${encodeURIComponent(projectId)}/members`,
    {
      method: "PUT",
      auth: "required",
      json,
      schema: projectAccessSchema,
    },
  );
}

export function listAdminAuditEvents(signal?: AbortSignal) {
  return apiRequest("/admin/audit-events?page=1&limit=100", {
    auth: "required",
    schema: auditEventPageSchema,
    signal,
  });
}

export function listAdminTemplates(signal?: AbortSignal) {
  return apiRequest("/admin/templates", {
    auth: "required",
    schema: templatesSchema,
    signal,
  });
}

export function listAvailableTemplates(
  type?: z.infer<typeof templateTypeSchema>,
  signal?: AbortSignal,
) {
  const search = type ? `?type=${encodeURIComponent(type)}` : "";
  return apiRequest(`/templates${search}`, {
    auth: "required",
    schema: templatesSchema,
    signal,
  });
}

export function createAdminTemplate(
  input: z.input<typeof createTemplateSchema>,
): Promise<AdminTemplate> {
  return apiRequest("/admin/templates", {
    method: "POST",
    auth: "required",
    json: createTemplateSchema.parse(input),
    schema: adminTemplateSchema,
  });
}

export function updateAdminTemplate(
  templateId: string,
  patch: Partial<
    Pick<AdminTemplate, "name" | "description" | "instructions" | "status">
  >,
) {
  return apiRequest(`/admin/templates/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
    auth: "required",
    json: patch,
    schema: adminTemplateSchema,
  });
}

export function updateAdminUserActive(userId: string, active: boolean) {
  return apiRequest(`/admin/users/${encodeURIComponent(userId)}/active`, {
    method: "PATCH",
    auth: "required",
    json: { active },
    schema: adminUserSchema.pick({
      id: true,
      email: true,
      roles: true,
      active: true,
    }),
  });
}

export function downloadAuditExport(format: "json" | "csv") {
  return apiDownload(`/admin/audit-events/export?format=${format}`, {
    auth: "required",
    fallbackFilename: `audit-events.${format}`,
  });
}

export function updateAdminUserRoles(userId: string, roles: UserRole[]) {
  const parsedRoles = updateUserRolesSchema.parse(roles);
  return apiRequest(`/users/${encodeURIComponent(userId)}/roles`, {
    method: "PATCH",
    auth: "required",
    json: { roles: parsedRoles },
    schema: adminUserSchema.pick({ id: true, email: true, roles: true }),
  });
}
