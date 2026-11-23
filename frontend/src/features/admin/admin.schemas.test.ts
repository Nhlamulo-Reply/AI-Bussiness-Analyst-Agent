import { describe, expect, it } from "vitest";
import { auditEventSchema } from "./admin.schemas";

describe("audit event schema", () => {
  it("accepts project, content, and workflow audit events", () => {
    for (const [action, resourceType] of [
      ["user.deactivated", "user"],
      ["user.reactivated", "user"],
      ["project.updated", "project"],
      ["project.exported", "project"],
      ["document.uploaded", "document"],
      ["requirement.updated", "requirement"],
      ["artifact.created", "artifact"],
      ["workflow.started", "execution"],
      ["template.created", "template"],
      ["audit.exported", "audit_event"],
    ] as const) {
      expect(
        auditEventSchema.safeParse({
          id: "event-1",
          actorUserId: "user-1",
          action,
          resourceType,
          resourceId: "resource-1",
          projectId: "project-1",
          after: { changedFields: ["businessObjective"] },
          createdAt: "2026-03-02T03:04:05.000Z",
        }).success,
      ).toBe(true);
    }
  });
});
