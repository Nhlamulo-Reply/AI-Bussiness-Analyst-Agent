import type { Logger } from "pino";
import {
  deliveryArtifactTypes,
  type ApprovalRecord,
  type ProjectRecord,
} from "../../modules/domain/domain.schemas";
import type { UserRecord, UserRole } from "../../modules/auth/user.repository";
import type { Storage } from "../../config/storage";
import type {
  EmailDeliveryStatus,
  EmailProvider,
  ReviewDecision,
} from "./email-provider";

export class ApplicationEmailNotifications {
  constructor(
    private readonly storage: Storage,
    private readonly emailProvider: EmailProvider,
    private readonly logger: Logger,
    private readonly frontendBaseUrl: string,
  ) {}

  async accountCreated(user: Pick<UserRecord, "id" | "email">): Promise<void> {
    const pendingAccessUrl = this.url("/pending-access");
    const adminReviewUrl = this.url("/app/admin");
    const administrators = await this.activeUsersWithRole("admin").catch(
      (error: unknown) => {
        this.logFailure("account-review-recipient-lookup", user.id, error);
        return [];
      },
    );

    await Promise.all([
      this.send(
        "account-created-confirmation",
        user.id,
        () =>
          this.emailProvider.sendAccountCreated(user.email, pendingAccessUrl),
      ),
      ...administrators.map((administrator) =>
        this.send("account-review-request", administrator.id, () =>
          this.emailProvider.sendAdminAccountReview(
            administrator.email,
            user.email,
            adminReviewUrl,
          ),
        ),
      ),
    ]);

    if (administrators.length === 0) {
      this.logger.warn(
        { userId: user.id },
        "No active administrator was available for account review notification",
      );
    }
  }

  async accountAccessGranted(user: UserRecord): Promise<void> {
    await this.send("account-access-granted", user.id, () =>
      this.emailProvider.sendAccountAccessGranted(
        user.email,
        user.roles,
        this.url("/login"),
      ),
    );
  }

  async projectMemberInvited(
    invitationId: string,
    invitee: Pick<UserRecord, "id" | "email">,
    inviter: Pick<UserRecord, "email">,
    project: Pick<ProjectRecord, "name">,
  ): Promise<EmailDeliveryStatus | "failed"> {
    return this.send("project-membership-invitation", invitee.id, () =>
      this.emailProvider.sendProjectMembershipInvitation(
        invitee.email,
        inviter.email,
        project.name,
        this.url(`/app/project-membership-invitations/${encodeURIComponent(invitationId)}`),
      ),
    );
  }

  async approvalSubmitted(
    approval: ApprovalRecord,
    submitter: Pick<UserRecord, "id" | "email">,
    project: Pick<ProjectRecord, "id" | "name" | "ownerUserId" | "members">,
    artifactTitle: string,
  ): Promise<void> {
    const recipients = await this.projectUsersWithRole(project, "product_owner").catch(
      (error: unknown) => {
        this.logFailure("approval-submission-recipient-lookup", approval.id, error);
        return [];
      },
    );
    const reviewUrl = this.url(
      `/app/projects/${encodeURIComponent(project.id)}/approvals?approvalId=${encodeURIComponent(approval.id)}`,
    );
    if (recipients.length === 0) {
      this.logger.warn(
        { projectId: project.id, approvalId: approval.id },
        "No active project Product Owner was available for approval notification",
      );
    }
    await Promise.all(
      recipients.map((recipient) =>
        this.send("approval-submitted", recipient.id, () =>
          this.emailProvider.sendApprovalSubmission(
            recipient.email,
            submitter.email,
            project.name,
            artifactTitle,
            reviewUrl,
          ),
        ),
      ),
    );
  }

  async approvalDecided(
    approval: ApprovalRecord,
    reviewer: Pick<UserRecord, "email">,
    submitter: Pick<UserRecord, "id" | "email">,
    project: Pick<ProjectRecord, "id" | "name" | "ownerUserId" | "members">,
    artifactTitle: string,
    decision: ReviewDecision,
    reason: string,
  ): Promise<void> {
    const artifactUrl = this.url(
      `/app/projects/${encodeURIComponent(project.id)}/artifacts`,
    );
    await this.send("approval-decision", submitter.id, () =>
      this.emailProvider.sendApprovalDecision(
        submitter.email,
        reviewer.email,
        project.name,
        artifactTitle,
        decision,
        reason,
        artifactUrl,
      ),
    );

    if (
      decision !== "approved" ||
      !deliveryArtifactTypes.some((type) => type === approval.artifactType)
    ) {
      return;
    }

    const recipients = await this.projectUsersWithRole(project, "delivery_lead").catch(
      (error: unknown) => {
        this.logFailure("deliverable-approval-recipient-lookup", approval.id, error);
        return [];
      },
    );
    const reviewUrl = this.url(
      `/app/projects/${encodeURIComponent(project.id)}/delivery-reviews?approvalId=${encodeURIComponent(approval.id)}`,
    );
    if (recipients.length === 0) {
      this.logger.warn(
        { projectId: project.id, approvalId: approval.id },
        "No active project Delivery Lead was available for approval notification",
      );
    }
    await Promise.all(
      recipients.map((recipient) =>
        this.send("deliverable-approved", recipient.id, () =>
          this.emailProvider.sendDeliverableApproved(
            recipient.email,
            project.name,
            artifactTitle,
            reviewer.email,
            reviewUrl,
          ),
        ),
      ),
    );
  }

  private async activeUsersWithRole(role: UserRole): Promise<UserRecord[]> {
    const matchingUsers: UserRecord[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while ((page - 1) * 100 < total) {
      const users = await this.storage.listUsers(page, 100);
      total = users.total;
      matchingUsers.push(
        ...users.items.filter(
          (user) => user.active && user.roles.includes(role),
        ),
      );
      page += 1;
    }
    return Promise.all(
      matchingUsers.map((user) => this.storage.findById(user.id)),
    ).then((records) =>
      records.filter((user): user is UserRecord => user !== null && user.active),
    );
  }

  private async projectUsersWithRole(
    project: Pick<ProjectRecord, "ownerUserId" | "members"> & { id: string },
    role: "product_owner" | "delivery_lead",
  ): Promise<UserRecord[]> {
    const memberIds = [...new Set([project.ownerUserId, ...project.members])];
    const records = await Promise.all(
      memberIds.map((userId) => this.storage.findById(userId)),
    );
    return records.filter(
      (user): user is UserRecord =>
        user !== null && user.active && user.roles.includes(role),
    );
  }

  private async send(
    notificationType: string,
    recipientUserId: string,
    sendEmail: () => ReturnType<EmailProvider["sendAccountCreated"]>,
  ): Promise<EmailDeliveryStatus | "failed"> {
    try {
      const status = await sendEmail();
      if (status === "disabled") {
        this.logger.warn(
          { notificationType, recipientUserId },
          "Email notification is disabled",
        );
      }
      return status;
    } catch (error) {
      this.logFailure(notificationType, recipientUserId, error);
      return "failed";
    }
  }

  private logFailure(
    notificationType: string,
    recipientUserId: string,
    error: unknown,
  ): void {
    this.logger.error(
      {
        notificationType,
        recipientUserId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Email notification delivery failed",
    );
  }

  private url(path: string): string {
    return new URL(path, this.frontendBaseUrl).toString();
  }
}
