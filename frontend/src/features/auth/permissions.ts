import type { UserRole } from "./auth.schemas";

export type Permission =
  | "project.read"
  | "project.create"
  | "analysis.prepare"
  | "analysis.submit"
  | "delivery.review"
  | "approval.decide_business"
  | "admin.users"
  | "admin.templates"
  | "admin.audit";

const permissionMap: Record<UserRole, Permission[]> = {
  business_analyst: ["project.read", "project.create", "analysis.prepare", "analysis.submit"],
  product_owner: ["project.read", "approval.decide_business"],
  delivery_lead: ["project.read", "delivery.review"],
  admin: ["project.read", "admin.users", "admin.templates", "admin.audit"],
};

export function hasPermission(roles: readonly UserRole[] | undefined, permission: Permission): boolean {
  return roles?.some((role) => permissionMap[role]?.includes(permission)) ?? false;
}
