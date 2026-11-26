import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("frontend RBAC permissions", () => {
  it("maps canonical roles to their capabilities", () => {
    expect(hasPermission(["business_analyst"], "analysis.prepare")).toBe(true);
    expect(hasPermission(["business_analyst"], "project.business.read")).toBe(
      true,
    );
    expect(hasPermission(["business_analyst"], "project.delivery.read")).toBe(
      true,
    );
    expect(hasPermission(["business_analyst"], "project.export")).toBe(true);
    expect(
      hasPermission(["business_analyst"], "approval.decide_business"),
    ).toBe(false);
    expect(hasPermission(["product_owner"], "approval.decide_business")).toBe(
      true,
    );
    expect(hasPermission(["product_owner"], "project.delivery.read")).toBe(
      false,
    );
    expect(hasPermission(["delivery_lead"], "delivery.review")).toBe(true);
    expect(hasPermission(["delivery_lead"], "project.delivery.read")).toBe(
      true,
    );
    expect(hasPermission(["delivery_lead"], "approval.decide_business")).toBe(
      false,
    );
    expect(hasPermission(["admin"], "admin.users")).toBe(true);
    expect(hasPermission(["admin"], "admin.project_access")).toBe(true);
    expect(hasPermission(["admin"], "admin.trash")).toBe(true);
    expect(hasPermission(["admin"], "admin.trash.purge")).toBe(true);
    expect(hasPermission(["product_owner"], "admin.trash")).toBe(false);
    expect(hasPermission(["admin"], "project.read")).toBe(false);
  });

  it("does not give delivery_lead general preparation or project creation permission", () => {
    expect(hasPermission(["delivery_lead"], "project.create")).toBe(false);
    expect(hasPermission(["delivery_lead"], "analysis.prepare")).toBe(false);
  });

  it("keeps administrator permissions exclusive for legacy mixed-role sessions", () => {
    expect(hasPermission(["admin", "business_analyst"], "project.read")).toBe(
      false,
    );
    expect(hasPermission(["admin", "business_analyst"], "admin.users")).toBe(
      true,
    );
  });
});
