import { describe, expect, it } from "vitest";
import {
  auditEventSchema,
  inviteUserInputSchema,
  inviteUserResponseSchema,
} from "./admin.schemas";

describe("audit event schema", () => {
  it("accepts display labels while retaining the original identifiers", () => {
    expect(
      auditEventSchema.safeParse({
        id: "event-1",
        actorUserId: "actor-uuid",
        actorEmail: "analyst@example.test",
        action: "document.uploaded",
        resourceType: "document",
        resourceId: "document-uuid",
        resourceLabel: "brief.pdf",
        projectId: "project-uuid",
        projectName: "Customer onboarding",
        createdAt: "2026-03-02T03:04:05.000Z",
      }),
    ).toMatchObject({
      success: true,
      data: {
        actorUserId: "actor-uuid",
        resourceId: "document-uuid",
        projectId: "project-uuid",
        actorEmail: "analyst@example.test",
        resourceLabel: "brief.pdf",
        projectName: "Customer onboarding",
      },
    });
  });

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

  it("accepts invitation audit events and rejects mixed administrator roles", () => {
    for (const action of [
      "user.invited",
      "user.invitation_resent",
      "user.invitation_accepted",
    ] as const) {
      expect(
        auditEventSchema.safeParse({
          id: "event-1",
          actorUserId: "admin-1",
          action,
          resourceType: "user",
          resourceId: "user-1",
          createdAt: "2026-03-02T03:04:05.000Z",
        }).success,
      ).toBe(true);
    }
    for (const action of [
      "project.member_invited",
      "project.member_invitation_accepted",
      "project.member_invitation_rejected",
      "project.member_invitation_cancelled",
    ] as const) {
      expect(
        auditEventSchema.safeParse({
          id: "event-2",
          actorUserId: "user-1",
          action,
          resourceType: "project",
          resourceId: "project-1",
          projectId: "project-1",
          createdAt: "2026-03-02T03:04:05.000Z",
        }).success,
      ).toBe(true);
    }

    expect(
      inviteUserInputSchema.safeParse({
        email: "new@example.test",
        message: "We are pleased to invite you to join our workspace.",
        roles: ["admin", "business_analyst"],
      }).success,
    ).toBe(false);
    expect(
      inviteUserInputSchema.safeParse({
        email: "new@example.test",
        message: "We are pleased to invite you to join our workspace.",
        roles: ["business_analyst", "product_owner"],
      }).success,
    ).toBe(true);
  });

  it("parses copyable one-time invitation links", () => {
    expect(
      inviteUserResponseSchema.parse({
        user: {
          id: "user-1",
          email: "new@example.test",
          roles: ["delivery_lead"],
          active: false,
        },
        invitationUrl: "https://app.example.test/reset-password?token=secret",
        expiresAt: "2026-03-02T03:04:05.000Z",
        invitationResent: false,
        emailStatus: "sent",
      }).user.active,
    ).toBe(false);
  });
});
