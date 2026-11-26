import nodemailer from "nodemailer";
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

describe("SmtpEmailProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends an account invitation with an escaped setup link", async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    jest
      .spyOn(nodemailer, "createTransport")
      .mockReturnValue({ sendMail } as never);
    const provider = new SmtpEmailProvider(config);
    const setupUrl = "https://example.test/setup?token=abc&source=invite";

    await provider.sendInvitation("invitee@example.test", setupUrl);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: config.emailFrom,
        to: "invitee@example.test",
        subject: "You have been invited to Clarity",
        text: expect.stringContaining(setupUrl),
        html: expect.stringContaining(
          "https://example.test/setup?token=abc&amp;source=invite",
        ),
      }),
    );
  });
});
