import { constants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { AppConfig } from "./env";
import {
  DuplicateUserError,
  hasExclusiveAdminRole,
  normalizeUserRoles,
  type UserRecord,
  type UserRepository,
  type UserRole,
} from "../modules/auth/user.repository";
import type { ProjectRepository } from "../common/middleware/project-access";
import {
  approvalSchema,
  auditEventSchema,
  artifactSchema,
  documentRecordSchema,
  executionSchema,
  projectSchema,
  requirementSchema,
  versionSchema,
  templateSchema,
  type ApprovalDecision,
  type ApprovalRecord,
  type ArtifactRecord,
  type ApprovalArtifactType,
  type AuditEventRecord,
  type DocumentRecord,
  type ExecutionRecord,
  type ProjectRecord,
  type RequirementRecord,
  type VersionRecord,
  type TemplateRecord,
  type TemplateType,
} from "../modules/domain/domain.schemas";

const userRecordSchema = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    passwordHash: z.string().min(1).optional(),
    googleSubject: z.string().min(1).optional(),
    sessionVersion: z.number().int().nonnegative().default(0),
    roles: z.array(
      z.enum(["business_analyst", "product_owner", "delivery_lead", "admin"]),
    ),
    active: z.boolean().default(true),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const legacyProjectSchema = z
  .object({
    id: z.string().min(1),
    ownerUserId: z.string().min(1),
    members: z.array(z.string()).default([]),
  })
  .passthrough();

const legacyStorageFileSchema = z
  .object({
    version: z.literal(1),
    users: z.array(userRecordSchema),
    projects: z.array(legacyProjectSchema),
  })
  .strict();

const storageFileSchema = z
  .object({
    version: z.literal(2),
    users: z.array(userRecordSchema),
    projects: z.array(projectSchema),
    documents: z.array(documentRecordSchema),
    requirements: z.array(requirementSchema),
    artifacts: z.array(artifactSchema),
    templates: z.array(templateSchema).default([]),
    approvals: z.array(approvalSchema),
    auditEvents: z.array(auditEventSchema).default([]),
    versions: z.array(versionSchema),
    executions: z.array(executionSchema),
    passwordResetTokens: z
      .array(
        z
          .object({
            id: z.string().min(1),
            userId: z.string().min(1),
            tokenHash: z.string().min(64).max(64),
            purpose: z
              .enum(["password_reset", "invitation"])
              .default("password_reset"),
            expiresAt: z.string(),
            usedAt: z.string().optional(),
            createdAt: z.string(),
          })
          .strict(),
      )
      .default([]),
    oauthStates: z
      .array(
        z
          .object({
            id: z.string().min(1),
            stateHash: z.string().min(64).max(64),
            nonceHash: z.string().min(64).max(64),
            expiresAt: z.string(),
            usedAt: z.string().optional(),
            createdAt: z.string(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

type StorageFile = z.infer<typeof storageFileSchema>;

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AuditEventListRecord extends AuditEventRecord {
  actorEmail?: string;
  projectName?: string;
  resourceLabel?: string;
}

export type FirstAdminBootstrapResult =
  | { status: "claimed"; user: UserRecord }
  | { status: "already_configured" }
  | { status: "user_not_found" };

export interface AdminUserRecord {
  id: string;
  email: string;
  roles: UserRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectAccessRecord {
  id: string;
  name: string;
  status: ProjectRecord["status"];
  ownerUserId: string;
  memberCount: number;
}

export interface ProjectMemberRecord {
  id: string;
  email: string;
  roles: UserRole[];
  active: boolean;
}

export type ProjectPatch = Partial<
  Pick<
    ProjectRecord,
    | "name"
    | "description"
    | "businessObjective"
    | "inScope"
    | "outOfScope"
    | "stakeholders"
    | "constraints"
    | "desiredOutputs"
    | "intakeTemplateId"
  >
>;

export type TemplatePatch = Partial<
  Pick<TemplateRecord, "name" | "description" | "instructions" | "status">
>;

export class LastActiveAdminError extends Error {
  constructor() {
    super("The last active administrator cannot be deactivated or demoted.");
    this.name = "LastActiveAdminError";
  }
}

export class InvalidUserRolesError extends Error {
  constructor() {
    super("Administrator accounts cannot be combined with project roles.");
    this.name = "InvalidUserRolesError";
  }
}

export class DuplicateTemplateError extends Error {
  constructor() {
    super("A template with this name and type already exists.");
    this.name = "DuplicateTemplateError";
  }
}

export class ApprovalTransitionError extends Error {
  constructor() {
    super("Approval is no longer pending");
    this.name = "ApprovalTransitionError";
  }
}

export class ApprovalSubmissionError extends Error {
  constructor() {
    super("Record is not a draft or already has a pending approval");
    this.name = "ApprovalSubmissionError";
  }
}

export class ArtifactReviewConflictError extends Error {
  constructor() {
    super("Artifact cannot be edited while an approval is pending");
    this.name = "ArtifactReviewConflictError";
  }
}

export interface Storage extends ProjectRepository {
  connect(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
  findById(userId: string): Promise<UserRecord | null>;
  findByGoogleSubject(subject: string): Promise<UserRecord | null>;
  recordGoogleLogin(userId: string): Promise<void>;
  createOAuthState(
    stateHash: string,
    nonceHash: string,
    expiresAt: string,
  ): Promise<string>;
  consumeOAuthState(stateHash: string, nonce: string): Promise<boolean>;
  getOAuthNonceHash(stateHash: string): Promise<string | null>;
  createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<void>;
  createInvitedUser(input: {
    email: string;
    roles: UserRole[];
    tokenHash: string;
    expiresAt: string;
    actorUserId: string;
  }): Promise<{ user: UserRecord; resent: boolean }>;
  consumePasswordResetToken(
    tokenHash: string,
    passwordHash: string,
  ): Promise<"consumed" | "invalid" | "expired" | "used" | "inactive">;
  invalidatePasswordResetTokens(userId: string): Promise<void>;
  updateUserRoles(
    userId: string,
    roles: UserRecord["roles"],
    actorUserId?: string,
  ): Promise<UserRecord | null>;
  updateUserActiveStatus(
    userId: string,
    active: boolean,
    actorUserId: string,
  ): Promise<UserRecord | null>;
  bootstrapFirstAdmin(userId: string): Promise<FirstAdminBootstrapResult>;
  listUsers(
    page: number,
    limit: number,
    search?: string,
  ): Promise<Page<AdminUserRecord>>;
  listProjectAccess(
    page: number,
    limit: number,
    search?: string,
  ): Promise<Page<ProjectAccessRecord>>;
  listProjectMembers(
    projectId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<Page<ProjectMemberRecord>>;
  addProjectMember(
    projectId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<ProjectRecord | null>;
  removeProjectMember(
    projectId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<ProjectRecord | null>;
  listAuditEvents(page: number, limit: number): Promise<Page<AuditEventRecord>>;
  listAuditEventsWithLabels(
    page: number,
    limit: number,
  ): Promise<Page<AuditEventListRecord>>;
  exportAuditEvents(actorUserId: string): Promise<AuditEventRecord[]>;
  listTemplates(
    activeOnly?: boolean,
    type?: TemplateType,
  ): Promise<TemplateRecord[]>;
  getTemplate(templateId: string): Promise<TemplateRecord | null>;
  createTemplate(template: TemplateRecord): Promise<TemplateRecord>;
  updateTemplate(
    templateId: string,
    actorUserId: string,
    patch: TemplatePatch,
  ): Promise<TemplateRecord | null>;
  createProject(project: ProjectRecord): Promise<ProjectRecord>;
  recordProjectExport(
    projectId: string,
    actorUserId: string,
    format: "json" | "markdown" | "csv",
  ): Promise<void>;
  updateProject(
    projectId: string,
    actorUserId: string,
    patch: ProjectPatch,
  ): Promise<ProjectRecord | null>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  listProjectsForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<Page<ProjectRecord>>;
  replaceProjectMembers(
    projectId: string,
    memberIds: string[],
    actorUserId: string,
  ): Promise<ProjectRecord | null>;
  createDocument(document: DocumentRecord): Promise<DocumentRecord>;
  getDocument(documentId: string): Promise<DocumentRecord | null>;
  listDocuments(
    projectId: string,
    includeArchived?: boolean,
  ): Promise<DocumentRecord[]>;
  archiveDocument(
    documentId: string,
    actorUserId: string,
  ): Promise<DocumentRecord | null>;
  restoreDocument(
    documentId: string,
    actorUserId: string,
  ): Promise<DocumentRecord | null>;
  createRequirement(requirement: RequirementRecord): Promise<RequirementRecord>;
  createRequirements(
    requirements: RequirementRecord[],
  ): Promise<RequirementRecord[]>;
  getRequirement(requirementId: string): Promise<RequirementRecord | null>;
  listRequirements(
    projectId: string,
    page: number,
    limit: number,
  ): Promise<Page<RequirementRecord>>;
  reviseRequirement(
    requirementId: string,
    actorUserId: string,
    patch: Partial<
      Pick<
        RequirementRecord,
        | "title"
        | "description"
        | "type"
        | "priority"
        | "sourceFacts"
        | "assumptions"
        | "openQuestions"
      >
    >,
  ): Promise<RequirementRecord | null>;
  getArtifact(
    artifactType: ApprovalArtifactType,
    artifactId: string,
  ): Promise<RequirementRecord | ArtifactRecord | null>;
  getArtifactById(artifactId: string): Promise<ArtifactRecord | null>;
  createArtifact(artifact: ArtifactRecord): Promise<ArtifactRecord>;
  createArtifacts(artifacts: ArtifactRecord[]): Promise<ArtifactRecord[]>;
  reviseArtifact(
    artifactId: string,
    actorUserId: string,
    patch: Partial<
      Pick<ArtifactRecord, "title" | "description" | "requirementIds" | "data">
    >,
  ): Promise<ArtifactRecord | null>;
  listArtifacts(
    projectId: string,
    page: number,
    limit: number,
    allowedTypes?: ArtifactRecord["type"][],
    requestedType?: ArtifactRecord["type"],
  ): Promise<Page<ArtifactRecord>>;
  createApproval(approval: ApprovalRecord): Promise<ApprovalRecord>;
  getApproval(approvalId: string): Promise<ApprovalRecord | null>;
  listApprovals(
    projectId: string,
    page: number,
    limit: number,
    decision?: ApprovalDecision,
    artifactTypes?: ApprovalArtifactType[],
  ): Promise<Page<ApprovalRecord>>;
  listApprovalsForArtifact(
    artifactType: ApprovalArtifactType,
    artifactId: string,
  ): Promise<ApprovalRecord[]>;
  decideApproval(
    approvalId: string,
    reviewerUserId: string,
    decision: Exclude<ApprovalDecision, "pending">,
    comments: string,
  ): Promise<ApprovalRecord | null>;
  addDeliveryFeedback(
    approvalId: string,
    reviewerUserId: string,
    comments: string,
  ): Promise<ApprovalRecord | null>;
  listVersions(
    artifactType: ApprovalArtifactType,
    artifactId: string,
  ): Promise<VersionRecord[]>;
  createExecution(execution: ExecutionRecord): Promise<ExecutionRecord>;
  getExecution(executionId: string): Promise<ExecutionRecord | null>;
  updateExecution(
    executionId: string,
    patch: Partial<
      Pick<
        ExecutionRecord,
        | "status"
        | "nodeStates"
        | "result"
        | "error"
        | "model"
        | "usage"
        | "startedAt"
        | "completedAt"
        | "durationMs"
      >
    >,
  ): Promise<ExecutionRecord | null>;
  getProjectExport(projectId: string): Promise<{
    project: ProjectRecord;
    documents: Array<Omit<DocumentRecord, "contentBase64">>;
    requirements: RequirementRecord[];
    artifacts: ArtifactRecord[];
    approvals: ApprovalRecord[];
  } | null>;
}

export class JsonFileStorage
  implements Storage, UserRepository, ProjectRepository
{
  private readonly filePath: string;
  private state?: StorageFile;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: Pick<AppConfig, "jsonStoragePath">) {
    this.filePath = resolve(config.jsonStoragePath);
  }

  async connect(): Promise<void> {
    if (this.state) {
      throw new Error("JSON storage is already connected");
    }

    await mkdir(dirname(this.filePath), { recursive: true });

    let contents: string;
    try {
      contents = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (!isMissingFile(error)) {
        throw error;
      }

      const emptyState = createEmptyStorage();
      await this.persist(emptyState);
      this.state = emptyState;
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(contents);
    } catch {
      throw new Error(
        `JSON storage file contains invalid JSON: ${this.filePath}`,
      );
    }

    const parsedStorage = storageFileSchema.safeParse(parsedJson);
    if (parsedStorage.success) {
      this.state = parsedStorage.data;
      return;
    }

    const legacyStorage = legacyStorageFileSchema.safeParse(parsedJson);
    if (!legacyStorage.success) {
      throw new Error(
        `JSON storage file has an unsupported or invalid structure: ${this.filePath}`,
      );
    }

    const migratedState = createEmptyStorage();
    migratedState.users = legacyStorage.data.users;
    migratedState.projects = legacyStorage.data.projects.map((project) => ({
      id: project.id,
      name:
        typeof project.name === "string"
          ? project.name
          : `Project ${project.id}`,
      description:
        typeof project.description === "string" ? project.description : "",
      businessObjective: "",
      inScope: "",
      outOfScope: "",
      stakeholders: [],
      constraints: [],
      desiredOutputs: [],
      ownerUserId: project.ownerUserId,
      members: project.members,
      status: "active",
      createdAt:
        typeof project.createdAt === "string"
          ? project.createdAt
          : new Date(0).toISOString(),
      updatedAt:
        typeof project.updatedAt === "string"
          ? project.updatedAt
          : new Date(0).toISOString(),
    }));
    await this.persist(migratedState);
    this.state = migratedState;
  }

  async ping(): Promise<void> {
    this.getState();
    await access(this.filePath, constants.R_OK | constants.W_OK);
  }

  async close(): Promise<void> {
    await this.writeQueue;
    this.state = undefined;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = this.getState().users.find((record) => record.email === email);
    return user
      ? { ...structuredClone(user), roles: normalizeUserRoles(user.roles) }
      : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const user = this.getState().users.find((record) => record.id === userId);
    return user
      ? { ...structuredClone(user), roles: normalizeUserRoles(user.roles) }
      : null;
  }

  async findByGoogleSubject(subject: string): Promise<UserRecord | null> {
    const user = this.getState().users.find(
      (record) => record.googleSubject === subject,
    );
    return user
      ? { ...structuredClone(user), roles: normalizeUserRoles(user.roles) }
      : null;
  }

  async recordGoogleLogin(userId: string): Promise<void> {
    await this.update((state) => {
      appendAuditEvent(state, {
        actorUserId: userId,
        action: "google.login",
        resourceType: "user",
        resourceId: userId,
      });
    });
  }

  async createOAuthState(
    stateHash: string,
    nonceHash: string,
    expiresAt: string,
  ): Promise<string> {
    const id = randomUUID();
    await this.update((state) => {
      state.oauthStates.push({
        id,
        stateHash,
        nonceHash,
        expiresAt,
        createdAt: new Date().toISOString(),
      });
    });
    return id;
  }

  async consumeOAuthState(stateHash: string, nonce: string): Promise<boolean> {
    return this.update((state) => {
      const nonceHash = createHash("sha256").update(nonce).digest("hex");
      const transaction = state.oauthStates.find(
        (record) =>
          record.stateHash === stateHash &&
          record.nonceHash === nonceHash &&
          record.usedAt === undefined,
      );
      if (
        !transaction ||
        new Date(transaction.expiresAt).getTime() <= Date.now()
      ) {
        return false;
      }
      transaction.usedAt = new Date().toISOString();
      return true;
    });
  }

  async getOAuthNonceHash(stateHash: string): Promise<string | null> {
    const transaction = this.getState().oauthStates.find(
      (record) =>
        record.stateHash === stateHash &&
        record.usedAt === undefined &&
        new Date(record.expiresAt).getTime() > Date.now(),
    );
    return transaction?.nonceHash ?? null;
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: string,
  ): Promise<void> {
    await this.update((state) => {
      state.passwordResetTokens = state.passwordResetTokens.filter(
        (token) => token.userId !== userId || token.usedAt !== undefined,
      );
      state.passwordResetTokens.push({
        id: randomUUID(),
        userId,
        tokenHash,
        purpose: "password_reset",
        expiresAt,
        createdAt: new Date().toISOString(),
      });
      appendAuditEvent(state, {
        actorUserId: userId,
        action: "password_reset.requested",
        resourceType: "user",
        resourceId: userId,
      });
    });
  }

  async consumePasswordResetToken(
    tokenHash: string,
    passwordHash: string,
  ): Promise<"consumed" | "invalid" | "expired" | "used" | "inactive"> {
    return this.update((state) => {
      const token = state.passwordResetTokens.find(
        (record) => record.tokenHash === tokenHash,
      );
      if (!token) return "invalid";
      if (token.usedAt) return "used";
      if (new Date(token.expiresAt).getTime() <= Date.now()) return "expired";
      const user = state.users.find((record) => record.id === token.userId);
      if (!user) return "inactive";
      const isInvitation = token.purpose === "invitation";
      if (
        (isInvitation && (user.active || user.passwordHash)) ||
        (!isInvitation && (!user.active || !user.passwordHash))
      ) {
        return "inactive";
      }

      token.usedAt = new Date().toISOString();
      for (const siblingToken of state.passwordResetTokens) {
        if (siblingToken.userId === user.id && !siblingToken.usedAt) {
          siblingToken.usedAt = new Date().toISOString();
        }
      }
      user.passwordHash = passwordHash;
      if (isInvitation) {
        user.active = true;
      }
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      user.updatedAt = new Date().toISOString();
      appendAuditEvent(state, {
        actorUserId: user.id,
        action: isInvitation
          ? "user.invitation_accepted"
          : "password_reset.completed",
        resourceType: "user",
        resourceId: user.id,
      });
      return "consumed";
    });
  }

  async invalidatePasswordResetTokens(userId: string): Promise<void> {
    await this.update((state) => {
      const now = new Date().toISOString();
      for (const token of state.passwordResetTokens) {
        if (token.userId === userId && !token.usedAt) token.usedAt = now;
      }
    });
  }

  updateUserRoles(
    userId: string,
    roles: UserRecord["roles"],
    actorUserId?: string,
  ): Promise<UserRecord | null> {
    if (!hasExclusiveAdminRole(roles) || new Set(roles).size !== roles.length) {
      throw new InvalidUserRolesError();
    }
    return this.update((state) => {
      const user = state.users.find((record) => record.id === userId);
      if (!user) {
        return null;
      }
      const previousRoles = [...user.roles];
      if (
        user.active &&
        previousRoles.includes("admin") &&
        !roles.includes("admin") &&
        !state.users.some(
          (record) =>
            record.id !== userId &&
            record.active &&
            record.roles.includes("admin"),
        )
      ) {
        throw new LastActiveAdminError();
      }
      user.roles = roles;
      if (JSON.stringify(previousRoles) !== JSON.stringify(roles)) {
        user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      }
      user.updatedAt = new Date().toISOString();
      if (
        actorUserId &&
        JSON.stringify(previousRoles) !== JSON.stringify(roles)
      ) {
        appendAuditEvent(state, {
          actorUserId,
          action: "user.roles_changed",
          resourceType: "user",
          resourceId: userId,
          before: { roles: previousRoles },
          after: { roles: [...roles] },
        });
      }
      return user;
    });
  }

  updateUserActiveStatus(
    userId: string,
    active: boolean,
    actorUserId: string,
  ): Promise<UserRecord | null> {
    return this.update((state) => {
      const user = state.users.find((record) => record.id === userId);
      if (!user) {
        return null;
      }
      if (
        !active &&
        user.active &&
        user.roles.includes("admin") &&
        !state.users.some(
          (record) =>
            record.id !== userId &&
            record.active &&
            record.roles.includes("admin"),
        )
      ) {
        throw new LastActiveAdminError();
      }
      const wasActive = user.active;
      user.active = active;
      if (wasActive !== active) {
        user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      }
      user.updatedAt = new Date().toISOString();
      if (wasActive !== active) {
        appendAuditEvent(state, {
          actorUserId,
          action: active ? "user.reactivated" : "user.deactivated",
          resourceType: "user",
          resourceId: userId,
          before: { active: wasActive },
          after: { active },
        });
      }
      return { ...user, roles: normalizeUserRoles(user.roles) };
    });
  }

  bootstrapFirstAdmin(userId: string): Promise<FirstAdminBootstrapResult> {
    return this.update((state) => {
      const user = state.users.find((record) => record.id === userId);
      if (!user) {
        return { status: "user_not_found" };
      }
      if (
        state.users.some(
          (record) => record.active && record.roles.includes("admin"),
        )
      ) {
        return { status: "already_configured" };
      }
      if (!user.active) {
        return { status: "user_not_found" };
      }
      const previousRoles = [...user.roles];
      user.roles = ["admin"];
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      user.updatedAt = new Date().toISOString();
      appendAuditEvent(state, {
        actorUserId: userId,
        action: "admin.bootstrap",
        resourceType: "user",
        resourceId: userId,
        before: { roles: previousRoles },
        after: { roles: [...user.roles] },
      });
      return { status: "claimed", user };
    });
  }

  async listUsers(
    page: number,
    limit: number,
    search?: string,
  ): Promise<Page<AdminUserRecord>> {
    const normalizedSearch = search?.trim().toLocaleLowerCase();
    const users = this.getState()
      .users.map((user) => ({
        id: user.id,
        email: user.email,
        roles: normalizeUserRoles(user.roles),
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }))
      .filter(
        (user) =>
          !normalizedSearch ||
          user.email.toLocaleLowerCase().includes(normalizedSearch) ||
          user.id.toLocaleLowerCase().includes(normalizedSearch),
      );
    return makePage(users, page, limit);
  }

  async listProjectAccess(
    page: number,
    limit: number,
    search?: string,
  ): Promise<Page<ProjectAccessRecord>> {
    const normalizedSearch = search?.trim().toLocaleLowerCase();
    const projects = this.getState()
      .projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        ownerUserId: project.ownerUserId,
        memberCount: project.members.length,
      }))
      .filter(
        (project) =>
          !normalizedSearch ||
          project.name.toLocaleLowerCase().includes(normalizedSearch) ||
          project.id.toLocaleLowerCase().includes(normalizedSearch) ||
          project.ownerUserId.toLocaleLowerCase().includes(normalizedSearch),
      );
    return makePage(projects, page, limit);
  }

  async listProjectMembers(
    projectId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<Page<ProjectMemberRecord>> {
    const state = this.getState();
    const project = state.projects.find((record) => record.id === projectId);
    if (!project) {
      return makePage([], page, limit);
    }
    const normalizedSearch = search?.trim().toLocaleLowerCase();
    const members = project.members
      .map((id) => {
        const user = state.users.find((record) => record.id === id);
        return {
          id,
          email: user?.email ?? id,
          roles: normalizeUserRoles(user?.roles ?? []),
          active: user?.active ?? false,
        };
      })
      .filter(
        (member) =>
          !normalizedSearch ||
          member.email.toLocaleLowerCase().includes(normalizedSearch) ||
          member.id.toLocaleLowerCase().includes(normalizedSearch),
      )
      .sort((left, right) => left.email.localeCompare(right.email));
    return makePage(members, page, limit);
  }

  addProjectMember(
    projectId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<ProjectRecord | null> {
    return this.update((state) => {
      const project = state.projects.find((record) => record.id === projectId);
      if (!project || project.ownerUserId === memberId) {
        return project ?? null;
      }
      if (!project.members.includes(memberId)) {
        const previousCount = project.members.length;
        project.members.push(memberId);
        project.updatedAt = new Date().toISOString();
        appendAuditEvent(state, {
          actorUserId,
          action: "project.members_changed",
          resourceType: "project",
          resourceId: projectId,
          projectId,
          before: { memberCount: previousCount },
          after: {
            addedMemberId: memberId,
            memberCount: project.members.length,
          },
        });
      }
      return project;
    });
  }

  removeProjectMember(
    projectId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<ProjectRecord | null> {
    return this.update((state) => {
      const project = state.projects.find((record) => record.id === projectId);
      if (!project) {
        return null;
      }
      if (project.members.includes(memberId)) {
        const previousCount = project.members.length;
        project.members = project.members.filter((id) => id !== memberId);
        project.updatedAt = new Date().toISOString();
        appendAuditEvent(state, {
          actorUserId,
          action: "project.members_changed",
          resourceType: "project",
          resourceId: projectId,
          projectId,
          before: { removedMemberId: memberId, memberCount: previousCount },
          after: { memberCount: project.members.length },
        });
      }
      return project;
    });
  }

  async listAuditEvents(
    page: number,
    limit: number,
  ): Promise<Page<AuditEventRecord>> {
    const events = [...this.getState().auditEvents].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    return makePage(events, page, limit);
  }

  async listAuditEventsWithLabels(
    page: number,
    limit: number,
  ): Promise<Page<AuditEventListRecord>> {
    const state = this.getState();
    const events = [...state.auditEvents].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    const eventPage = makePage(events, page, limit);

    return {
      ...eventPage,
      items: eventPage.items.map((event) => {
        const resource = resolveAuditResource(event, state);
        const projectId =
          event.projectId ??
          resource.projectId ??
          (event.resourceType === "project" ? event.resourceId : undefined);
        const actorEmail = state.users.find(
          (user) => user.id === event.actorUserId,
        )?.email;
        const projectName = projectId
          ? state.projects.find((project) => project.id === projectId)?.name
          : undefined;

        return {
          ...event,
          ...(actorEmail ? { actorEmail } : {}),
          ...(projectName ? { projectName } : {}),
          ...(resource.label ? { resourceLabel: resource.label } : {}),
        };
      }),
    };
  }

  exportAuditEvents(actorUserId: string): Promise<AuditEventRecord[]> {
    return this.update((state) => {
      appendAuditEvent(state, {
        actorUserId,
        action: "audit.exported",
        resourceType: "audit_event",
        resourceId: "audit-events",
      });
      return [...state.auditEvents].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
    });
  }

  async listTemplates(
    activeOnly = false,
    type?: TemplateType,
  ): Promise<TemplateRecord[]> {
    return structuredClone(
      this.getState()
        .templates.filter(
          (template) =>
            (!activeOnly || template.status === "active") &&
            (!type || template.type === type),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  async getTemplate(templateId: string): Promise<TemplateRecord | null> {
    const template = this.getState().templates.find(
      (record) => record.id === templateId,
    );
    return template ? structuredClone(template) : null;
  }

  createTemplate(template: TemplateRecord): Promise<TemplateRecord> {
    return this.update((state) => {
      if (
        state.templates.some(
          (record) =>
            record.type === template.type &&
            record.name.toLocaleLowerCase() ===
              template.name.toLocaleLowerCase(),
        )
      ) {
        throw new DuplicateTemplateError();
      }
      state.templates.push(template);
      appendAuditEvent(state, {
        actorUserId: template.createdByUserId,
        action: "template.created",
        resourceType: "template",
        resourceId: template.id,
        after: {
          name: template.name,
          type: template.type,
          status: template.status,
        },
      });
      return template;
    });
  }

  updateTemplate(
    templateId: string,
    actorUserId: string,
    patch: TemplatePatch,
  ): Promise<TemplateRecord | null> {
    return this.update((state) => {
      const template = state.templates.find(
        (record) => record.id === templateId,
      );
      if (!template) {
        return null;
      }
      if (
        patch.name &&
        state.templates.some(
          (record) =>
            record.id !== templateId &&
            record.type === template.type &&
            record.name.toLocaleLowerCase() === patch.name?.toLocaleLowerCase(),
        )
      ) {
        throw new DuplicateTemplateError();
      }
      const before = {
        name: template.name,
        type: template.type,
        status: template.status,
      };
      const previousStatus = template.status;
      const instructionsChanged =
        patch.instructions !== undefined &&
        patch.instructions !== template.instructions;
      Object.assign(template, patch, { updatedAt: new Date().toISOString() });
      const action =
        previousStatus !== template.status
          ? template.status === "active"
            ? "template.activated"
            : "template.deactivated"
          : "template.updated";
      appendAuditEvent(state, {
        actorUserId,
        action,
        resourceType: "template",
        resourceId: templateId,
        before,
        after: {
          name: template.name,
          type: template.type,
          status: template.status,
          instructionsChanged,
        },
      });
      return template;
    });
  }

  async createProject(project: ProjectRecord): Promise<ProjectRecord> {
    return this.update((state) => {
      if (state.projects.some((record) => record.id === project.id)) {
        throw new Error(`Duplicate record ID: ${project.id}`);
      }
      state.projects.push(project);
      appendAuditEvent(state, {
        actorUserId: project.ownerUserId,
        action: "project.created",
        resourceType: "project",
        resourceId: project.id,
        projectId: project.id,
        after: { fields: Object.keys(project) },
      });
      return project;
    });
  }

  recordProjectExport(
    projectId: string,
    actorUserId: string,
    format: "json" | "markdown" | "csv",
  ): Promise<void> {
    return this.update((state) => {
      appendAuditEvent(state, {
        actorUserId,
        action: "project.exported",
        resourceType: "project",
        resourceId: projectId,
        projectId,
        after: { format },
      });
    });
  }

  updateProject(
    projectId: string,
    actorUserId: string,
    patch: ProjectPatch,
  ): Promise<ProjectRecord | null> {
    return this.update((state) => {
      const project = state.projects.find((record) => record.id === projectId);
      if (!project) {
        return null;
      }
      const changedFields = Object.keys(patch).filter(
        (field) =>
          JSON.stringify(project[field as keyof ProjectPatch]) !==
          JSON.stringify(patch[field as keyof ProjectPatch]),
      );
      if (changedFields.length === 0) {
        return project;
      }
      Object.assign(project, patch);
      project.updatedAt = new Date().toISOString();
      appendAuditEvent(state, {
        actorUserId,
        action: "project.updated",
        resourceType: "project",
        resourceId: projectId,
        projectId,
        before: { changedFields },
        after: { changedFields },
      });
      return project;
    });
  }

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    return this.findRecord("projects", projectId);
  }

  async listProjectsForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<Page<ProjectRecord>> {
    const projects = this.getState().projects.filter(
      (project) =>
        project.ownerUserId === userId || project.members.includes(userId),
    );
    return makePage(projects, page, limit);
  }

  replaceProjectMembers(
    projectId: string,
    memberIds: string[],
    actorUserId: string,
  ): Promise<ProjectRecord | null> {
    return this.update((state) => {
      const project = state.projects.find((record) => record.id === projectId);
      if (!project) {
        return null;
      }
      const previousMembers = [...project.members];
      const nextMembers = [
        ...new Set(
          memberIds.filter((memberId) => memberId !== project.ownerUserId),
        ),
      ];
      if (
        JSON.stringify([...previousMembers].sort()) !==
        JSON.stringify([...nextMembers].sort())
      ) {
        project.members = nextMembers;
        project.updatedAt = new Date().toISOString();
        appendAuditEvent(state, {
          actorUserId,
          action: "project.members_changed",
          resourceType: "project",
          resourceId: projectId,
          projectId,
          before: { memberIds: previousMembers },
          after: { memberIds: nextMembers },
        });
      }
      return project;
    });
  }

  async createDocument(document: DocumentRecord): Promise<DocumentRecord> {
    return this.update((state) => {
      if (state.documents.some((record) => record.id === document.id)) {
        throw new Error(`Duplicate record ID: ${document.id}`);
      }
      state.documents.push(document);
      appendAuditEvent(state, {
        actorUserId: document.uploadedByUserId,
        action: "document.uploaded",
        resourceType: "document",
        resourceId: document.id,
        projectId: document.projectId,
        after: { mimeType: document.mimeType, sizeBytes: document.sizeBytes },
      });
      return document;
    });
  }

  async listDocuments(
    projectId: string,
    includeArchived = false,
  ): Promise<DocumentRecord[]> {
    return structuredClone(
      this.getState().documents.filter(
        (document) =>
          document.projectId === projectId &&
          (includeArchived || document.status === "uploaded"),
      ),
    );
  }

  async getDocument(documentId: string): Promise<DocumentRecord | null> {
    return this.findRecord("documents", documentId);
  }

  archiveDocument(
    documentId: string,
    actorUserId: string,
  ): Promise<DocumentRecord | null> {
    return this.update((state) => {
      const document = state.documents.find(
        (record) => record.id === documentId,
      );
      if (!document) {
        return null;
      }
      if (document.status === "uploaded") {
        const previousStatus = document.status;
        document.status = "archived";
        document.archivedAt = new Date().toISOString();
        document.archivedByUserId = actorUserId;
        appendAuditEvent(state, {
          actorUserId,
          action: "document.archived",
          resourceType: "document",
          resourceId: documentId,
          projectId: document.projectId,
          before: { status: previousStatus },
          after: { status: document.status, archivedAt: document.archivedAt },
        });
      }
      return document;
    });
  }

  restoreDocument(
    documentId: string,
    actorUserId: string,
  ): Promise<DocumentRecord | null> {
    return this.update((state) => {
      const document = state.documents.find(
        (record) => record.id === documentId,
      );
      if (!document) {
        return null;
      }
      if (document.status === "archived") {
        const archivedAt = document.archivedAt;
        document.status = "uploaded";
        delete document.archivedAt;
        delete document.archivedByUserId;
        appendAuditEvent(state, {
          actorUserId,
          action: "document.restored",
          resourceType: "document",
          resourceId: documentId,
          projectId: document.projectId,
          before: { status: "archived", archivedAt },
          after: { status: document.status },
        });
      }
      return document;
    });
  }

  async createRequirement(
    requirement: RequirementRecord,
  ): Promise<RequirementRecord> {
    return this.update((state) => {
      if (state.requirements.some((record) => record.id === requirement.id)) {
        throw new Error(`Duplicate record ID: ${requirement.id}`);
      }
      state.requirements.push(requirement);
      appendAuditEvent(state, {
        actorUserId: requirement.createdByUserId,
        action: "requirement.created",
        resourceType: "requirement",
        resourceId: requirement.id,
        projectId: requirement.projectId,
        after: { type: requirement.type, status: requirement.status },
      });
      return requirement;
    });
  }

  createRequirements(
    requirements: RequirementRecord[],
  ): Promise<RequirementRecord[]> {
    return this.update((state) => {
      const existingIds = new Set(
        state.requirements.map((requirement) => requirement.id),
      );
      for (const requirement of requirements) {
        if (existingIds.has(requirement.id)) {
          throw new Error(`Duplicate record ID: ${requirement.id}`);
        }
        existingIds.add(requirement.id);
      }
      state.requirements.push(...requirements);
      for (const requirement of requirements) {
        appendAuditEvent(state, {
          actorUserId: requirement.createdByUserId,
          action: "requirement.created",
          resourceType: "requirement",
          resourceId: requirement.id,
          projectId: requirement.projectId,
          after: { type: requirement.type, status: requirement.status },
        });
      }
      return requirements;
    });
  }

  async getRequirement(
    requirementId: string,
  ): Promise<RequirementRecord | null> {
    return this.findRecord("requirements", requirementId);
  }

  async listRequirements(
    projectId: string,
    page: number,
    limit: number,
  ): Promise<Page<RequirementRecord>> {
    const requirements = this.getState().requirements.filter(
      (requirement) => requirement.projectId === projectId,
    );
    return makePage(requirements, page, limit);
  }

  reviseRequirement(
    requirementId: string,
    actorUserId: string,
    patch: Partial<
      Pick<
        RequirementRecord,
        | "title"
        | "description"
        | "type"
        | "priority"
        | "sourceFacts"
        | "assumptions"
        | "openQuestions"
      >
    >,
  ): Promise<RequirementRecord | null> {
    return this.update((state) => {
      const requirement = state.requirements.find(
        (record) => record.id === requirementId,
      );
      if (!requirement) {
        return null;
      }
      if (!["draft", "changes_requested"].includes(requirement.status)) {
        throw new ArtifactReviewConflictError();
      }
      if (
        state.approvals.some(
          (approval) =>
            approval.artifactType === "requirement" &&
            approval.artifactId === requirement.id &&
            approval.decision === "pending",
        )
      ) {
        throw new ArtifactReviewConflictError();
      }

      state.versions.push({
        id: randomUUID(),
        projectId: requirement.projectId,
        artifactType: "requirement",
        artifactId: requirement.id,
        version: requirement.version,
        snapshot: {
          ...requirement,
          traceability: { ...requirement.traceability },
        },
        actorUserId,
        reason: "Requirement edited",
        createdAt: new Date().toISOString(),
      });
      const previousStatus = requirement.status;
      const previousVersion = requirement.version;
      Object.assign(requirement, patch);
      requirement.version += 1;
      requirement.status = "draft";
      requirement.updatedAt = new Date().toISOString();
      const changedFields = Object.keys(patch);
      appendAuditEvent(state, {
        actorUserId,
        action: "requirement.updated",
        resourceType: "requirement",
        resourceId: requirementId,
        projectId: requirement.projectId,
        before: {
          changedFields,
          status: previousStatus,
          version: previousVersion,
        },
        after: { changedFields, version: requirement.version },
      });
      return requirement;
    });
  }

  async getArtifact(
    artifactType: ApprovalArtifactType,
    artifactId: string,
  ): Promise<RequirementRecord | ArtifactRecord | null> {
    if (artifactType === "requirement") {
      return this.getRequirement(artifactId);
    }
    const artifact = await this.findRecord<ArtifactRecord, "artifacts">(
      "artifacts",
      artifactId,
    );
    return artifact?.type === artifactType ? artifact : null;
  }

  async getArtifactById(artifactId: string): Promise<ArtifactRecord | null> {
    return this.findRecord<ArtifactRecord, "artifacts">(
      "artifacts",
      artifactId,
    );
  }

  async listArtifacts(
    projectId: string,
    page: number,
    limit: number,
    allowedTypes?: ArtifactRecord["type"][],
    requestedType?: ArtifactRecord["type"],
  ): Promise<Page<ArtifactRecord>> {
    return makePage(
      this.getState().artifacts.filter(
        (artifact) =>
          artifact.projectId === projectId &&
          (!allowedTypes || allowedTypes.includes(artifact.type)) &&
          (!requestedType || artifact.type === requestedType),
      ),
      page,
      limit,
    );
  }

  async createArtifact(artifact: ArtifactRecord): Promise<ArtifactRecord> {
    return this.update((state) => {
      if (state.artifacts.some((record) => record.id === artifact.id)) {
        throw new Error(`Duplicate record ID: ${artifact.id}`);
      }
      state.artifacts.push(artifact);
      appendAuditEvent(state, {
        actorUserId: artifact.createdByUserId,
        action: "artifact.created",
        resourceType: "artifact",
        resourceId: artifact.id,
        projectId: artifact.projectId,
        after: { type: artifact.type, status: artifact.status },
      });
      return artifact;
    });
  }

  createArtifacts(artifacts: ArtifactRecord[]): Promise<ArtifactRecord[]> {
    return this.update((state) => {
      const existingIds = new Set(
        state.artifacts.map((artifact) => artifact.id),
      );
      for (const artifact of artifacts) {
        if (existingIds.has(artifact.id)) {
          throw new Error(`Duplicate record ID: ${artifact.id}`);
        }
        existingIds.add(artifact.id);
      }
      state.artifacts.push(...artifacts);
      for (const artifact of artifacts) {
        appendAuditEvent(state, {
          actorUserId: artifact.createdByUserId,
          action: "artifact.created",
          resourceType: "artifact",
          resourceId: artifact.id,
          projectId: artifact.projectId,
          after: { type: artifact.type, status: artifact.status },
        });
      }
      return artifacts;
    });
  }

  reviseArtifact(
    artifactId: string,
    actorUserId: string,
    patch: Partial<
      Pick<ArtifactRecord, "title" | "description" | "requirementIds" | "data">
    >,
  ): Promise<ArtifactRecord | null> {
    return this.update((state) => {
      const artifact = state.artifacts.find(
        (record) => record.id === artifactId,
      );
      if (!artifact) {
        return null;
      }
      if (!["draft", "changes_requested"].includes(artifact.status)) {
        throw new ArtifactReviewConflictError();
      }
      if (
        state.approvals.some(
          (approval) =>
            approval.artifactType === artifact.type &&
            approval.artifactId === artifact.id &&
            approval.decision === "pending",
        )
      ) {
        throw new ArtifactReviewConflictError();
      }

      state.versions.push({
        id: randomUUID(),
        projectId: artifact.projectId,
        artifactType: artifact.type,
        artifactId: artifact.id,
        version: artifact.version,
        snapshot: structuredClone(artifact),
        actorUserId,
        reason: "Artifact edited",
        createdAt: new Date().toISOString(),
      });
      const previousStatus = artifact.status;
      const previousVersion = artifact.version;
      Object.assign(artifact, patch);
      artifact.version += 1;
      artifact.status = "draft";
      artifact.updatedAt = new Date().toISOString();
      const changedFields = Object.keys(patch);
      appendAuditEvent(state, {
        actorUserId,
        action: "artifact.updated",
        resourceType: "artifact",
        resourceId: artifactId,
        projectId: artifact.projectId,
        before: {
          changedFields,
          status: previousStatus,
          version: previousVersion,
        },
        after: { changedFields, version: artifact.version },
      });
      return artifact;
    });
  }

  async createApproval(approval: ApprovalRecord): Promise<ApprovalRecord> {
    return this.update((state) => {
      if (state.approvals.some((record) => record.id === approval.id)) {
        throw new Error(`Duplicate record ID: ${approval.id}`);
      }
      const artifact =
        approval.artifactType === "requirement"
          ? state.requirements.find(
              (record) => record.id === approval.artifactId,
            )
          : state.artifacts.find(
              (record) =>
                record.id === approval.artifactId &&
                record.type === approval.artifactType,
            );
      const pendingApprovalExists = state.approvals.some(
        (record) =>
          record.artifactType === approval.artifactType &&
          record.artifactId === approval.artifactId &&
          record.decision === "pending",
      );
      if (!artifact || artifact.status !== "draft" || pendingApprovalExists) {
        throw new ApprovalSubmissionError();
      }
      if (approval.artifactType === "requirement") {
        (artifact as RequirementRecord).status = "submitted";
      } else {
        (artifact as ArtifactRecord).status = "submitted";
      }
      artifact.updatedAt = new Date().toISOString();
      state.approvals.push(approval);
      appendAuditEvent(state, {
        actorUserId: approval.submittedByUserId,
        action: "approval.submitted",
        resourceType: "approval",
        resourceId: approval.id,
        projectId: approval.projectId,
        after: {
          decision: approval.decision,
          artifactType: approval.artifactType,
          artifactId: approval.artifactId,
        },
      });
      return approval;
    });
  }

  addDeliveryFeedback(
    approvalId: string,
    reviewerUserId: string,
    comments: string,
  ): Promise<ApprovalRecord | null> {
    return this.update((state) => {
      const approval = state.approvals.find(
        (record) => record.id === approvalId,
      );
      if (!approval) {
        return null;
      }
      const createdAt = new Date().toISOString();
      approval.deliveryFeedback = approval.deliveryFeedback ?? [];
      approval.deliveryFeedback.push({
        reviewerUserId,
        comments,
        createdAt,
      });
      approval.updatedAt = createdAt;
      appendAuditEvent(state, {
        actorUserId: reviewerUserId,
        action: "delivery.feedback_added",
        resourceType: "approval",
        resourceId: approval.id,
        projectId: approval.projectId,
        after: { feedbackLength: approval.deliveryFeedback.length },
      });
      return approval;
    });
  }

  async getApproval(approvalId: string): Promise<ApprovalRecord | null> {
    return this.findRecord("approvals", approvalId);
  }

  async listApprovals(
    projectId: string,
    page: number,
    limit: number,
    decision?: ApprovalDecision,
    artifactTypes?: ApprovalArtifactType[],
  ): Promise<Page<ApprovalRecord>> {
    const approvals = this.getState()
      .approvals.filter(
        (approval) =>
          approval.projectId === projectId &&
          (decision === undefined || approval.decision === decision) &&
          (!artifactTypes || artifactTypes.includes(approval.artifactType)),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return makePage(approvals, page, limit);
  }

  async listApprovalsForArtifact(
    artifactType: ApprovalArtifactType,
    artifactId: string,
  ): Promise<ApprovalRecord[]> {
    return this.getState()
      .approvals.filter(
        (approval) =>
          approval.artifactType === artifactType &&
          approval.artifactId === artifactId,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  decideApproval(
    approvalId: string,
    reviewerUserId: string,
    decision: Exclude<ApprovalDecision, "pending">,
    comments: string,
  ): Promise<ApprovalRecord | null> {
    return this.update((state) => {
      const approval = state.approvals.find(
        (record) => record.id === approvalId,
      );
      if (!approval) {
        return null;
      }
      if (approval.decision !== "pending") {
        throw new ApprovalTransitionError();
      }

      const currentArtifact =
        approval.artifactType === "requirement"
          ? state.requirements.find(
              (record) => record.id === approval.artifactId,
            )
          : state.artifacts.find(
              (record) =>
                record.id === approval.artifactId &&
                record.type === approval.artifactType,
            );
      if (!currentArtifact) {
        return null;
      }
      if (!["draft", "submitted"].includes(currentArtifact.status)) {
        throw new ApprovalTransitionError();
      }

      state.versions.push({
        id: randomUUID(),
        projectId: approval.projectId,
        artifactType: approval.artifactType,
        artifactId: approval.artifactId,
        version: currentArtifact.version,
        snapshot: { ...currentArtifact },
        actorUserId: reviewerUserId,
        reason: `Approval decision: ${decision}`,
        createdAt: new Date().toISOString(),
      });
      currentArtifact.status =
        decision === "approved"
          ? "approved"
          : decision === "rejected"
            ? "rejected"
            : "changes_requested";
      currentArtifact.version += 1;
      currentArtifact.updatedAt = new Date().toISOString();
      approval.reviewerUserId = reviewerUserId;
      approval.decision = decision;
      approval.reviewerComments = comments;
      approval.updatedAt = new Date().toISOString();
      appendAuditEvent(state, {
        actorUserId: reviewerUserId,
        action: "approval.decided",
        resourceType: "approval",
        resourceId: approval.id,
        projectId: approval.projectId,
        before: { decision: "pending" },
        after: { decision },
      });
      return approval;
    });
  }

  async listVersions(
    artifactType: ApprovalArtifactType,
    artifactId: string,
  ): Promise<VersionRecord[]> {
    return structuredClone(
      this.getState()
        .versions.filter(
          (version) =>
            version.artifactType === artifactType &&
            version.artifactId === artifactId,
        )
        .sort((left, right) => left.version - right.version),
    );
  }

  async createExecution(execution: ExecutionRecord): Promise<ExecutionRecord> {
    return this.update((state) => {
      if (state.executions.some((record) => record.id === execution.id)) {
        throw new Error(`Duplicate record ID: ${execution.id}`);
      }
      state.executions.push(execution);
      appendAuditEvent(state, {
        actorUserId: execution.createdByUserId,
        action: "workflow.started",
        resourceType: "execution",
        resourceId: execution.id,
        projectId: execution.projectId,
        after: { workflowName: execution.workflowName },
      });
      return execution;
    });
  }

  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    return this.findRecord("executions", executionId);
  }

  updateExecution(
    executionId: string,
    patch: Partial<
      Pick<
        ExecutionRecord,
        | "status"
        | "nodeStates"
        | "result"
        | "error"
        | "model"
        | "usage"
        | "startedAt"
        | "completedAt"
        | "durationMs"
      >
    >,
  ): Promise<ExecutionRecord | null> {
    return this.update((state) => {
      const execution = state.executions.find(
        (record) => record.id === executionId,
      );
      if (!execution) {
        return null;
      }
      Object.assign(execution, patch);
      execution.updatedAt = new Date().toISOString();
      return execution;
    });
  }

  async getProjectExport(projectId: string): Promise<{
    project: ProjectRecord;
    documents: Array<Omit<DocumentRecord, "contentBase64">>;
    requirements: RequirementRecord[];
    artifacts: ArtifactRecord[];
    approvals: ApprovalRecord[];
  } | null> {
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }
    const state = this.getState();
    return {
      project,
      documents: state.documents
        .filter(
          (document) =>
            document.projectId === projectId && document.status === "uploaded",
        )
        .map(({ contentBase64: _contentBase64, ...document }) => document),
      requirements: structuredClone(
        state.requirements.filter((record) => record.projectId === projectId),
      ),
      artifacts: structuredClone(
        state.artifacts.filter((record) => record.projectId === projectId),
      ),
      approvals: structuredClone(
        state.approvals.filter((record) => record.projectId === projectId),
      ),
    };
  }

  insertUser(
    user: Omit<UserRecord, "id" | "active" | "sessionVersion"> & {
      active?: boolean;
      sessionVersion?: number;
    },
  ): Promise<UserRecord> {
    if (
      !hasExclusiveAdminRole(user.roles) ||
      new Set(user.roles).size !== user.roles.length
    ) {
      throw new InvalidUserRolesError();
    }
    return this.update((state) => {
      if (state.users.some((record) => record.email === user.email)) {
        throw new DuplicateUserError();
      }

      const record: UserRecord = {
        ...user,
        active: user.active ?? true,
        sessionVersion: user.sessionVersion ?? 0,
        id: randomUUID(),
      };
      state.users.push({
        ...record,
        sessionVersion: record.sessionVersion ?? 0,
      });
      appendAuditEvent(state, {
        actorUserId: record.id,
        action: record.googleSubject
          ? "google.account_created"
          : "user.registered",
        resourceType: "user",
        resourceId: record.id,
        after: { email: record.email },
      });
      return record;
    });
  }

  createInvitedUser(input: {
    email: string;
    roles: UserRole[];
    tokenHash: string;
    expiresAt: string;
    actorUserId: string;
  }): Promise<{ user: UserRecord; resent: boolean }> {
    if (
      !hasExclusiveAdminRole(input.roles) ||
      new Set(input.roles).size !== input.roles.length
    ) {
      throw new InvalidUserRolesError();
    }
    return this.update((state) => {
      const now = new Date().toISOString();
      const existing = state.users.find(
        (record) => record.email === input.email,
      );
      if (existing) {
        const hasInvitation = state.passwordResetTokens.some(
          (token) =>
            token.userId === existing.id && token.purpose === "invitation",
        );
        if (existing.active || existing.passwordHash || !hasInvitation) {
          throw new DuplicateUserError();
        }
        const previousRoles = [...existing.roles];
        existing.roles = [...input.roles];
        existing.updatedAt = now;
        state.passwordResetTokens = state.passwordResetTokens.map((token) =>
          token.userId === existing.id && !token.usedAt
            ? { ...token, usedAt: now }
            : token,
        );
        state.passwordResetTokens.push({
          id: randomUUID(),
          userId: existing.id,
          tokenHash: input.tokenHash,
          purpose: "invitation",
          expiresAt: input.expiresAt,
          createdAt: now,
        });
        appendAuditEvent(state, {
          actorUserId: input.actorUserId,
          action: "user.invitation_resent",
          resourceType: "user",
          resourceId: existing.id,
          before: { roles: previousRoles },
          after: { email: existing.email, roles: [...existing.roles] },
        });
        return {
          user: { ...existing, roles: normalizeUserRoles(existing.roles) },
          resent: true,
        };
      }

      const user: UserRecord = {
        id: randomUUID(),
        email: input.email,
        roles: [...input.roles],
        active: false,
        sessionVersion: 0,
        createdAt: now,
        updatedAt: now,
      };
      state.users.push({
        ...user,
        sessionVersion: user.sessionVersion ?? 0,
      });
      state.passwordResetTokens.push({
        id: randomUUID(),
        userId: user.id,
        tokenHash: input.tokenHash,
        purpose: "invitation",
        expiresAt: input.expiresAt,
        createdAt: now,
      });
      appendAuditEvent(state, {
        actorUserId: input.actorUserId,
        action: "user.invited",
        resourceType: "user",
        resourceId: user.id,
        after: { email: user.email, roles: [...user.roles] },
      });
      return { user, resent: false };
    });
  }

  async userCanAccessProject(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    return this.getState().projects.some(
      (project) =>
        project.id === projectId &&
        (project.ownerUserId === userId || project.members.includes(userId)),
    );
  }

  private insertRecord<T extends { id: string }, C extends keyof StorageFile>(
    collectionName: C,
    record: T,
  ): Promise<T> {
    return this.update((state) => {
      const records = state[collectionName] as unknown as T[];
      if (records.some((existing) => existing.id === record.id)) {
        throw new Error(`Duplicate record ID: ${record.id}`);
      }
      records.push(record);
      return record;
    });
  }

  private async findRecord<
    T extends { id: string },
    C extends keyof StorageFile,
  >(collectionName: C, recordId: string): Promise<T | null> {
    const records = this.getState()[collectionName] as unknown as T[];
    const record = records.find((item) => item.id === recordId);
    return record ? structuredClone(record) : null;
  }

  private update<T>(change: (state: StorageFile) => T): Promise<T> {
    const operation = this.writeQueue.then(async () => {
      const nextState = structuredClone(this.getState());
      const result = change(nextState);
      await this.persist(nextState);
      this.state = nextState;
      return structuredClone(result);
    });
    this.writeQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async persist(state: StorageFile): Promise<void> {
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });

    try {
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      await unlink(temporaryPath);
      throw error;
    }
  }

  private getState(): StorageFile {
    if (!this.state) {
      throw new Error("JSON storage is not connected");
    }
    return this.state;
  }
}

function createEmptyStorage(): StorageFile {
  return {
    version: 2,
    users: [],
    projects: [],
    documents: [],
    requirements: [],
    artifacts: [],
    templates: [],
    approvals: [],
    auditEvents: [],
    versions: [],
    executions: [],
    passwordResetTokens: [],
    oauthStates: [],
  };
}

function appendAuditEvent(
  state: StorageFile,
  event: Omit<AuditEventRecord, "id" | "createdAt">,
): void {
  state.auditEvents.push({
    ...event,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

function resolveAuditResource(
  event: AuditEventRecord,
  state: StorageFile,
): { label?: string; projectId?: string } {
  switch (event.resourceType) {
    case "user":
      return {
        label: state.users.find((user) => user.id === event.resourceId)?.email,
      };
    case "project": {
      const project = state.projects.find(
        (record) => record.id === event.resourceId,
      );
      return { label: project?.name, projectId: event.resourceId };
    }
    case "document": {
      const document = state.documents.find(
        (record) => record.id === event.resourceId,
      );
      return { label: document?.fileName, projectId: document?.projectId };
    }
    case "requirement": {
      const requirement = state.requirements.find(
        (record) => record.id === event.resourceId,
      );
      return { label: requirement?.title, projectId: requirement?.projectId };
    }
    case "artifact": {
      const artifact = state.artifacts.find(
        (record) => record.id === event.resourceId,
      );
      return { label: artifact?.type, projectId: artifact?.projectId };
    }
    case "execution": {
      const execution = state.executions.find(
        (record) => record.id === event.resourceId,
      );
      return {
        label: execution?.workflowName,
        projectId: execution?.projectId,
      };
    }
    case "approval": {
      const approval = state.approvals.find(
        (record) => record.id === event.resourceId,
      );
      const artifactType = event.after?.artifactType;
      return {
        label:
          approval?.artifactType ??
          (typeof artifactType === "string" ? artifactType : undefined),
        projectId: approval?.projectId,
      };
    }
    case "template":
      return {
        label: state.templates.find((record) => record.id === event.resourceId)
          ?.name,
      };
    case "audit_event":
      return { label: "Audit history" };
  }
}

function makePage<T>(records: T[], page: number, limit: number): Page<T> {
  const start = (page - 1) * limit;
  return {
    items: structuredClone(records.slice(start, start + limit)),
    page,
    limit,
    total: records.length,
  };
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
