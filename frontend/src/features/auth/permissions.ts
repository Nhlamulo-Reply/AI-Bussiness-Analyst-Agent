import type { UserRole } from "./auth.schemas";

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

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
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
  delivery_lead: ["project.read", "project.delivery.read", "delivery.review"],
  admin: [
    "admin.users",
    "admin.project_access",
    "admin.templates",
    "admin.audit",
    "admin.trash",
    "admin.trash.purge",
  ],
};

export function hasPermission(
  roles: readonly UserRole[] | undefined,
  permission: Permission,
): boolean {
  if (roles?.includes("admin")) {
    return rolePermissions.admin.includes(permission);
  }
  return (
    roles?.some((role) => rolePermissions[role].includes(permission)) ?? false
  );
}

export function hasAnyPermission(
  roles: readonly UserRole[] | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(roles, permission));
}
