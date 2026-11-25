import type { UserRole } from "../../modules/auth/user.repository";

export type Permission =
  | "project.read"
  | "project.create"
  | "project.business.read"
  | "project.delivery.read"
  | "project.export"
  | "analysis.prepare"
  | "analysis.submit"
  | "delivery.review"
  | "approval.decide_business"
  | "admin.users"
  | "admin.project_access"
  | "admin.templates"
  | "admin.audit"
  | "admin.trash"
  | "admin.trash.purge";

const permissionMap: Record<UserRole, Permission[]> = {
  business_analyst: [
    "project.read",
    "project.create",
    "project.business.read",
    "project.delivery.read",
    "project.export",
    "analysis.prepare",
    "analysis.submit",
  ],
  product_owner: [
    "project.read",
    "project.business.read",
    "approval.decide_business",
  ],
  delivery_lead: [
    "project.read",
    "project.delivery.read",
    "delivery.review",
  ],
  admin: [
    "admin.users",
    "admin.project_access",
    "admin.templates",
    "admin.audit",
    "admin.trash",
    "admin.trash.purge",
  ],
};

export function hasPermission(roles: readonly UserRole[], permission: Permission): boolean {
  if (roles.includes("admin")) {
    return permissionMap.admin.includes(permission);
  }
  return roles.some((role) => permissionMap[role]?.includes(permission));
}
