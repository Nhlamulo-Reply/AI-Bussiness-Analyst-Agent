import nodemailer from "nodemailer";
import type { AppConfig } from "../../config/env";

export type EmailDeliveryStatus = "sent" | "disabled";
export type ReviewDecision = "approved" | "rejected" | "changes_requested";
export type NotifiableRole =
  | "business_analyst"
  | "product_owner"
  | "delivery_lead"
  | "admin";

type EmailTransport = {
  sendMail(options: {
    from?: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
};

export interface EmailProvider {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
  sendAccountCreated(
    email: string,
    pendingAccessUrl: string,
  ): Promise<EmailDeliveryStatus>;
  sendAdminAccountReview(
    email: string,
    applicantEmail: string,
    adminReviewUrl: string,
  ): Promise<EmailDeliveryStatus>;
  sendAccountAccessGranted(
    email: string,
    roles: NotifiableRole[],
    signInUrl: string,
  ): Promise<EmailDeliveryStatus>;
  sendInvitation(
    email: string,
    invitationUrl: string,
    adminMessage: string,
    adminEmail: string,
    expiresAt: string,
  ): Promise<EmailDeliveryStatus>;
  sendProjectMembershipInvitation(
    email: string,
    inviterEmail: string,
    projectName: string,
    invitationUrl: string,
  ): Promise<EmailDeliveryStatus>;
  sendApprovalSubmission(
    email: string,
    submitterEmail: string,
    projectName: string,
    artifactTitle: string,
    reviewUrl: string,
  ): Promise<EmailDeliveryStatus>;
  sendApprovalDecision(
    email: string,
    reviewerEmail: string,
    projectName: string,
    artifactTitle: string,
    decision: ReviewDecision,
    reason: string,
    artifactUrl: string,
  ): Promise<EmailDeliveryStatus>;
  sendDeliverableApproved(
    email: string,
    projectName: string,
    artifactTitle: string,
    approvedByEmail: string,
    reviewUrl: string,
  ): Promise<EmailDeliveryStatus>;
}

export class NoopEmailProvider implements EmailProvider {
  async sendPasswordReset(): Promise<void> {}

  async sendAccountCreated(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendAdminAccountReview(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendAccountAccessGranted(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendInvitation(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendProjectMembershipInvitation(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendApprovalSubmission(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendApprovalDecision(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }

  async sendDeliverableApproved(): Promise<EmailDeliveryStatus> {
    return "disabled";
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: EmailTransport;

  constructor(
    private readonly config: AppConfig,
    transporter?: EmailTransport,
  ) {
    this.transporter =
      transporter ??
      nodemailer.createTransport({
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

  async sendInvitation(
    email: string,
    invitationUrl: string,
    adminMessage: string,
    adminEmail: string,
    expiresAt: string,
  ): Promise<EmailDeliveryStatus> {
    const safeMessage = escapeHtml(adminMessage).replace(/\r?\n/g, "<br>");
    const safeInvitationUrl = escapeHtml(invitationUrl);
    const safeAdminEmail = escapeHtml(adminEmail);
    const expiration = new Date(expiresAt).toUTCString();

    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: email,
      subject: "Invitation to join AI Business Analyst Agent",
      text: [
        "Dear colleague,",
        "",
        adminMessage,
        "",
        "You have been invited to join the AI Business Analyst Agent workspace. Use this one-time link to complete your account setup:",
        invitationUrl,
        "",
        `This link expires on ${expiration} and can only be used once.`,
        "If you were not expecting this invitation, you may disregard this email.",
        "",
        "Kind regards,",
        adminEmail,
      ].join("\n"),
      html: [
        "<p>Dear colleague,</p>",
        `<p>${safeMessage}</p>`,
        "<p>You have been invited to join the AI Business Analyst Agent workspace. Use the secure, one-time link below to complete your account setup:</p>",
        `<p><a href="${safeInvitationUrl}">Complete account setup</a></p>`,
        `<p>This link expires on ${escapeHtml(expiration)} and can only be used once.</p>`,
        "<p>If you were not expecting this invitation, you may disregard this email.</p>",
        `<p>Kind regards,<br>${safeAdminEmail}</p>`,
      ].join(""),
    });

    return "sent";
  }

  async sendAccountCreated(
    email: string,
    pendingAccessUrl: string,
  ): Promise<EmailDeliveryStatus> {
    await this.sendFormalEmail(
      email,
      "Your account is awaiting administrator review",
      [
        "Your account has been created successfully and is awaiting review by an administrator.",
        "You will receive another email when your account has been assigned access. Until then, you can review your account status using the link below.",
      ],
      { label: "View account status", url: pendingAccessUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  async sendAdminAccountReview(
    email: string,
    applicantEmail: string,
    adminReviewUrl: string,
  ): Promise<EmailDeliveryStatus> {
    await this.sendFormalEmail(
      email,
      "New account awaiting administrator review",
      [
        "A new account has been created and is awaiting administrator review.",
        `Applicant email address: ${applicantEmail}. Please review the account and assign the appropriate role(s).`,
      ],
      { label: "Review pending accounts", url: adminReviewUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  async sendAccountAccessGranted(
    email: string,
    roles: NotifiableRole[],
    signInUrl: string,
  ): Promise<EmailDeliveryStatus> {
    const roleNames = roles.map(roleLabel).join(", ");
    await this.sendFormalEmail(
      email,
      "Your account access has been approved",
      [
        "An administrator has reviewed your account and granted workspace access.",
        `Assigned role(s): ${roleNames}. Please sign in again to activate your updated access.`,
      ],
      { label: "Sign in", url: signInUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  async sendProjectMembershipInvitation(
    email: string,
    inviterEmail: string,
    projectName: string,
    invitationUrl: string,
  ): Promise<EmailDeliveryStatus> {
    await this.sendFormalEmail(
      email,
      "Invitation to join a project workspace",
      [
        `${inviterEmail} has invited you to join the project "${projectName}".`,
        "Please sign in to review the invitation. Project access will be granted only after you accept.",
      ],
      { label: "Review project invitation", url: invitationUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  async sendApprovalSubmission(
    email: string,
    submitterEmail: string,
    projectName: string,
    artifactTitle: string,
    reviewUrl: string,
  ): Promise<EmailDeliveryStatus> {
    await this.sendFormalEmail(
      email,
      "A deliverable is awaiting your review",
      [
        `${submitterEmail} submitted "${artifactTitle}" for review in the project "${projectName}".`,
        "Please review the submission and record an approval decision.",
      ],
      { label: "Open the Product Owner review", url: reviewUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  async sendApprovalDecision(
    email: string,
    reviewerEmail: string,
    projectName: string,
    artifactTitle: string,
    decision: ReviewDecision,
    reason: string,
    artifactUrl: string,
  ): Promise<EmailDeliveryStatus> {
    await this.sendFormalEmail(
      email,
      "Decision on your submitted deliverable",
      [
        `The Product Owner (${reviewerEmail}) recorded the decision "${decisionLabel(decision)}" for "${artifactTitle}" in the project "${projectName}".`,
        `Reason and feedback: ${reason}`,
      ],
      { label: "View the deliverable", url: artifactUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  async sendDeliverableApproved(
    email: string,
    projectName: string,
    artifactTitle: string,
    approvedByEmail: string,
    reviewUrl: string,
  ): Promise<EmailDeliveryStatus> {
    await this.sendFormalEmail(
      email,
      "An approved deliverable is ready for delivery review",
      [
        `"${artifactTitle}" in the project "${projectName}" has been approved by ${approvedByEmail}.`,
        "You are receiving this notification because you are a Delivery Lead on the project.",
      ],
      { label: "Open the delivery review", url: reviewUrl },
      "AI Business Analyst Agent",
    );
    return "sent";
  }

  private async sendFormalEmail(
    email: string,
    subject: string,
    paragraphs: string[],
    action: { label: string; url: string },
    signOff: string,
  ): Promise<void> {
    const htmlParagraphs = paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: email,
      subject,
      text: [
        "Dear colleague,",
        "",
        ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
        `${action.label}: ${action.url}`,
        "",
        "Kind regards,",
        signOff,
      ].join("\n"),
      html: [
        "<p>Dear colleague,</p>",
        htmlParagraphs,
        `<p><a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a></p>`,
        `<p>Kind regards,<br>${escapeHtml(signOff)}</p>`,
      ].join(""),
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roleLabel(role: NotifiableRole): string {
  const labels: Record<NotifiableRole, string> = {
    business_analyst: "Business Analyst",
    product_owner: "Product Owner",
    delivery_lead: "Delivery Lead",
    admin: "Administrator",
  };
  return labels[role];
}

function decisionLabel(decision: ReviewDecision): string {
  const labels: Record<ReviewDecision, string> = {
    approved: "Approved",
    rejected: "Rejected",
    changes_requested: "Changes requested",
  };
  return labels[decision];
}
