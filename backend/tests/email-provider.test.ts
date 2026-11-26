import type { AppConfig } from "../src/config/env";
import { SmtpEmailProvider } from "../src/integrations/email/email-provider";

const config: AppConfig = {
  environment: "test",
  port: 3000,
  mongoUri: "mongodb://127.0.0.1:27017",
  mongoDatabase: "ai_business_analyst_agent_test",
  jsonStoragePath: "./data/test.json",
  jwtSecret: "a-secure-test-secret-with-at-least-32-characters",
  jwtTtlSeconds: 900,
  logLevel: "silent",
  llmProvider: "openai",
  groqModel: "openai/gpt-oss-120b",
  openAiModel: "gpt-6-luna",
  geminiModel: "gemini-4-hydrogen",
  inceptionModel: "mercury-3",
  passwordResetTtlSeconds: 900,
  emailProvider: "smtp",
  smtpHost: "smtp.example.test",
  smtpPort: 587,
  smtpSecure: false,
  emailFrom: "noreply@example.test",
};

describe("SMTP invitation email", () => {
  it("sends a formal message with the one-time link and safely escaped admin text", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const provider = new SmtpEmailProvider(config, { sendMail });
    const invitationUrl =
      "https://app.example.test/reset-password?token=one-time&next=setup";

    await expect(
      provider.sendInvitation(
        "invitee@example.test",
        invitationUrl,
        "Please join us. <script>alert('no')</script>",
        "admin@example.test",
        "2026-03-04T05:06:07.000Z",
      ),
    ).resolves.toBe("sent");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.test",
        to: "invitee@example.test",
        subject: "Invitation to join AI Business Analyst Agent",
        text: expect.stringContaining(invitationUrl),
        html: expect.stringContaining(
          'href="https://app.example.test/reset-password?token=one-time&amp;next=setup"',
        ),
      }),
    );
    const message = sendMail.mock.calls[0]?.[0];
    expect(message?.html).toContain("Please join us.");
    expect(message?.html).not.toContain("<script>");
    expect(message?.text).toContain("admin@example.test");
  });

  it("uses formal account, membership, review, and approval decision messages", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const provider = new SmtpEmailProvider(config, { sendMail });

    await provider.sendAccountCreated(
      "analyst@example.test",
      "https://app.example.test/pending-access",
    );
    await provider.sendProjectMembershipInvitation(
      "member@example.test",
      "owner@example.test",
      "Customer onboarding",
      "https://app.example.test/app/project-membership-invitations/invite-1",
    );
    await provider.sendApprovalSubmission(
      "owner@example.test",
      "analyst@example.test",
      "Customer onboarding",
      "Risk assessment",
      "https://app.example.test/app/projects/project-1/approvals?approvalId=approval-1",
    );
    await provider.sendApprovalDecision(
      "analyst@example.test",
      "owner@example.test",
      "Customer onboarding",
      "Risk assessment",
      "changes_requested",
      "Please clarify the mitigation owner.",
      "https://app.example.test/app/projects/project-1/artifacts",
    );
    await provider.sendDeliverableApproved(
      "lead@example.test",
      "Customer onboarding",
      "Risk assessment",
      "owner@example.test",
      "https://app.example.test/app/projects/project-1/delivery-reviews?approvalId=approval-1",
    );

    expect(sendMail).toHaveBeenCalledTimes(5);
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: "analyst@example.test",
      subject: "Your account is awaiting administrator review",
      text: expect.stringContaining("Dear colleague"),
    });
    expect(sendMail.mock.calls[1]?.[0]).toMatchObject({
      to: "member@example.test",
      text: expect.stringContaining(
        "https://app.example.test/app/project-membership-invitations/invite-1",
      ),
    });
    expect(sendMail.mock.calls[2]?.[0]).toMatchObject({
      to: "owner@example.test",
      text: expect.stringContaining(
        "https://app.example.test/app/projects/project-1/approvals?approvalId=approval-1",
      ),
    });
    expect(sendMail.mock.calls[3]?.[0]).toMatchObject({
      to: "analyst@example.test",
      text: expect.stringContaining("Please clarify the mitigation owner."),
    });
    expect(sendMail.mock.calls[4]?.[0]).toMatchObject({
      to: "lead@example.test",
      subject: "An approved deliverable is ready for delivery review",
    });
  });
});
