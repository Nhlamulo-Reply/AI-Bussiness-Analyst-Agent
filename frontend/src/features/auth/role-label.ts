import type { UserRole } from "./auth.schemas";

export function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    user: "User",
    reviewer: "Reviewer",
    admin: "Admin",
    project_owner: "Project owner",
  };
  return labels[role];
}
