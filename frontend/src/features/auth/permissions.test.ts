import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("frontend RBAC permissions", () => {
  it("maps canonical roles to their capabilities", () => {
    expect(hasPermission(["business_analyst"], "analysis.prepare")).toBe(true);
    expect(hasPermission(["business_analyst"], "approval.decide_business")).toBe(false);
    expect(hasPermission(["product_owner"], "approval.decide_business")).toBe(true);
    expect(hasPermission(["delivery_lead"], "delivery.review")).toBe(true);
    expect(hasPermission(["delivery_lead"], "approval.decide_business")).toBe(false);
    expect(hasPermission(["admin"], "admin.users")).toBe(true);
  });

  it("does not give delivery_lead general preparation or project creation permission", () => {
    expect(hasPermission(["delivery_lead"], "project.create")).toBe(false);
    expect(hasPermission(["delivery_lead"], "analysis.prepare")).toBe(false);
  });
});
