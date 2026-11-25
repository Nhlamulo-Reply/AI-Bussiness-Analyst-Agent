import nodemailer from "nodemailer";
import type { AppConfig } from "../../config/env";

export interface EmailProvider {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}

export class NoopEmailProvider implements EmailProvider {
  async sendPasswordReset(): Promise<void> {}
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    });
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: email,
      subject: "Reset your Clarity password",
      text: `Open this link to reset your password: ${resetUrl}\n\nThis link expires soon and can be used once.`,
      html: `<p>Open this link to reset your password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires soon and can be used once.</p>`,
    });
  }
}

export function createEmailProvider(config: AppConfig): EmailProvider {
  if (config.emailProvider === "smtp") {
    if (!config.smtpHost || !config.smtpPort || !config.emailFrom) {
      throw new Error("SMTP email configuration is incomplete.");
    }
    return new SmtpEmailProvider(config);
  }
  return new NoopEmailProvider();
}
