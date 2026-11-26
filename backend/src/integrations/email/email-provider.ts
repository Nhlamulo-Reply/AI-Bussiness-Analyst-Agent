import nodemailer from "nodemailer";
import type { AppConfig } from "../../config/env";

export interface EmailProvider {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
  sendInvitation(email: string, setupUrl: string): Promise<void>;
}

export class NoopEmailProvider implements EmailProvider {
  async sendPasswordReset(): Promise<void> {}

  async sendInvitation(): Promise<void> {}
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
      html: `<p>Open this link to reset your password:</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires soon and can be used once.</p>`,
    });
  }

  async sendInvitation(email: string, setupUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: email,
      subject: "You have been invited to Clarity",
      text: `You have been invited to join Clarity. Set up your account using this link: ${setupUrl}\n\nThis link expires soon and can be used once.`,
      html: `<p>You have been invited to join Clarity.</p><p><a href="${escapeHtml(setupUrl)}">Set up your account</a></p><p>This link expires soon and can be used once.</p>`,
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}
