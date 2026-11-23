import { hasPermission } from "../src/common/authorization/permissions";

describe("Capstone RBAC permission policy", () => {
  it("grants canonical roles only their defined preparation, review, or administration capabilities", () => {
    expect(
      hasPermission(["business_analyst"], "analysis.prepare"),
    ).toBe(true);
    expect(
      hasPermission(["business_analyst"], "approval.decide_business"),
    ).toBe(false);
    expect(
      hasPermission(["product_owner"], "approval.decide_business"),
    ).toBe(true);
    expect(hasPermission(["product_owner"], "analysis.prepare")).toBe(false);
    expect(hasPermission(["delivery_lead"], "delivery.review")).toBe(true);
    expect(
      hasPermission(["delivery_lead"], "approval.decide_business"),
    ).toBe(false);
    expect(hasPermission(["admin"], "admin.users")).toBe(true);
    expect(hasPermission(["admin"], "project.create")).toBe(false);
  });

  it("uses only canonical roles for permission grants", () => {
    expect(hasPermission(["product_owner"], "approval.decide_business")).toBe(true);
    expect(hasPermission(["business_analyst"], "analysis.prepare")).toBe(true);
    expect(hasPermission(["delivery_lead"], "project.create")).toBe(false);
  });
});
