import type { UserRole } from "./auth.schemas";

export function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    business_analyst: "Business Analyst",
    product_owner: "Product Owner / Stakeholder",
    delivery_lead: "Delivery Lead",
    admin: "Administrator",
  };
  return labels[role];
}
