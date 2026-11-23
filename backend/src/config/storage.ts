import { constants } from "node:fs";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { AppConfig } from "./env";
import { DuplicateUserError, type UserRecord, type UserRepository } from "../modules/auth/user.repository";
import type { ProjectRepository } from "../common/middleware/project-access";
import {
  approvalSchema,
  artifactSchema,
  documentRecordSchema,
  executionSchema,
  projectSchema,
  requirementSchema,
  versionSchema,
  type ApprovalDecision,
  type ApprovalRecord,
  type ArtifactRecord,
  type ApprovalArtifactType,
  type DocumentRecord,
  type ExecutionRecord,
  type ProjectRecord,
  type RequirementRecord,
  type VersionRecord
} from "../modules/domain/domain.schemas";

const userRecordSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  passwordHash: z.string().min(1),
  roles: z.array(z.enum(["user", "reviewer", "admin", "project_owner"])),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict();

const legacyProjectSchema = z.object({
  id: z.string().min(1),
  ownerUserId: z.string().min(1),
  members: z.array(z.string()).default([])
}).passthrough();

const legacyStorageFileSchema = z.object({
  version: z.literal(1),
  users: z.array(userRecordSchema),
  projects: z.array(legacyProjectSchema)
}).strict();

const storageFileSchema = z.object({
  version: z.literal(2),
  users: z.array(userRecordSchema),
  projects: z.array(projectSchema),
  documents: z.array(documentRecordSchema),
  requirements: z.array(requirementSchema),
  artifacts: z.array(artifactSchema),
  approvals: z.array(approvalSchema),
  versions: z.array(versionSchema),
  executions: z.array(executionSchema)
}).strict();

type StorageFile = z.infer<typeof storageFileSchema>;

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
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
  updateUserRoles(userId: string, roles: UserRecord["roles"]): Promise<UserRecord | null>;
  createProject(project: ProjectRecord): Promise<ProjectRecord>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  listProjectsForUser(userId: string, page: number, limit: number): Promise<Page<ProjectRecord>>;
  replaceProjectMembers(projectId: string, memberIds: string[]): Promise<ProjectRecord | null>;
  createDocument(document: DocumentRecord): Promise<DocumentRecord>;
  getDocument(documentId: string): Promise<DocumentRecord | null>;
  listDocuments(projectId: string): Promise<DocumentRecord[]>;
  createRequirement(requirement: RequirementRecord): Promise<RequirementRecord>;
  createRequirements(requirements: RequirementRecord[]): Promise<RequirementRecord[]>;
  getRequirement(requirementId: string): Promise<RequirementRecord | null>;
  listRequirements(projectId: string, page: number, limit: number): Promise<Page<RequirementRecord>>;
  reviseRequirement(
    requirementId: string,
    actorUserId: string,
    patch: Partial<Pick<RequirementRecord, "title" | "description" | "type" | "priority" | "sourceFacts" | "assumptions" | "openQuestions">>
  ): Promise<RequirementRecord | null>;
  getArtifact(artifactType: ApprovalArtifactType, artifactId: string): Promise<RequirementRecord | ArtifactRecord | null>;
  getArtifactById(artifactId: string): Promise<ArtifactRecord | null>;
  createArtifact(artifact: ArtifactRecord): Promise<ArtifactRecord>;
  createArtifacts(artifacts: ArtifactRecord[]): Promise<ArtifactRecord[]>;
  reviseArtifact(
    artifactId: string,
    actorUserId: string,
    patch: Partial<Pick<ArtifactRecord, "title" | "description" | "requirementIds" | "data">>
  ): Promise<ArtifactRecord | null>;
  listArtifacts(projectId: string, page: number, limit: number): Promise<Page<ArtifactRecord>>;
  createApproval(approval: ApprovalRecord): Promise<ApprovalRecord>;
  getApproval(approvalId: string): Promise<ApprovalRecord | null>;
  listApprovals(
    projectId: string,
    page: number,
    limit: number,
    decision?: ApprovalDecision
  ): Promise<Page<ApprovalRecord>>;
  decideApproval(
    approvalId: string,
    reviewerUserId: string,
    decision: Exclude<ApprovalDecision, "pending">,
    comments: string
  ): Promise<ApprovalRecord | null>;
  listVersions(artifactType: ApprovalArtifactType, artifactId: string): Promise<VersionRecord[]>;
  createExecution(execution: ExecutionRecord): Promise<ExecutionRecord>;
  getExecution(executionId: string): Promise<ExecutionRecord | null>;
  updateExecution(
    executionId: string,
    patch: Partial<Pick<ExecutionRecord, "status" | "nodeStates" | "result" | "error" | "model" | "usage" | "startedAt" | "completedAt" | "durationMs">>
  ): Promise<ExecutionRecord | null>;
  getProjectExport(projectId: string): Promise<{
    project: ProjectRecord;
    documents: Array<Omit<DocumentRecord, "contentBase64">>;
    requirements: RequirementRecord[];
    artifacts: ArtifactRecord[];
    approvals: ApprovalRecord[];
  } | null>;
}

export class JsonFileStorage implements Storage, UserRepository, ProjectRepository {
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
      throw new Error(`JSON storage file contains invalid JSON: ${this.filePath}`);
    }

    const parsedStorage = storageFileSchema.safeParse(parsedJson);
    if (parsedStorage.success) {
      this.state = parsedStorage.data;
      return;
    }

    const legacyStorage = legacyStorageFileSchema.safeParse(parsedJson);
    if (!legacyStorage.success) {
      throw new Error(`JSON storage file has an unsupported or invalid structure: ${this.filePath}`);
    }

    const migratedState = createEmptyStorage();
    migratedState.users = legacyStorage.data.users;
    migratedState.projects = legacyStorage.data.projects.map((project) => ({
      id: project.id,
      name: typeof project.name === "string" ? project.name : `Project ${project.id}`,
      description: typeof project.description === "string" ? project.description : "",
      ownerUserId: project.ownerUserId,
      members: project.members,
      status: "active",
      createdAt: typeof project.createdAt === "string" ? project.createdAt : new Date(0).toISOString(),
      updatedAt: typeof project.updatedAt === "string" ? project.updatedAt : new Date(0).toISOString()
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
    return user ? structuredClone(user) : null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const user = this.getState().users.find((record) => record.id === userId);
    return user ? structuredClone(user) : null;
  }

  updateUserRoles(userId: string, roles: UserRecord["roles"]): Promise<UserRecord | null> {
    return this.update((state) => {
      const user = state.users.find((record) => record.id === userId);
      if (!user) {
        return null;
      }
      user.roles = roles;
      user.updatedAt = new Date().toISOString();
      return user;
    });
  }

  async createProject(project: ProjectRecord): Promise<ProjectRecord> {
    return this.insertRecord("projects", project);
  }

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    return this.findRecord("projects", projectId);
  }

  async listProjectsForUser(userId: string, page: number, limit: number): Promise<Page<ProjectRecord>> {
    const projects = this.getState().projects.filter((project) =>
      project.ownerUserId === userId || project.members.includes(userId)
    );
    return makePage(projects, page, limit);
  }

  replaceProjectMembers(projectId: string, memberIds: string[]): Promise<ProjectRecord | null> {
    return this.update((state) => {
      const project = state.projects.find((record) => record.id === projectId);
      if (!project) {
        return null;
      }
      project.members = [...new Set(memberIds.filter((memberId) => memberId !== project.ownerUserId))];
      project.updatedAt = new Date().toISOString();
      return project;
    });
  }

  async createDocument(document: DocumentRecord): Promise<DocumentRecord> {
    return this.insertRecord("documents", document);
  }

  async listDocuments(projectId: string): Promise<DocumentRecord[]> {
    return structuredClone(this.getState().documents.filter((document) => document.projectId === projectId));
  }

  async getDocument(documentId: string): Promise<DocumentRecord | null> {
    return this.findRecord("documents", documentId);
  }

  async createRequirement(requirement: RequirementRecord): Promise<RequirementRecord> {
    return this.insertRecord("requirements", requirement);
  }

  createRequirements(requirements: RequirementRecord[]): Promise<RequirementRecord[]> {
    return this.update((state) => {
      const existingIds = new Set(state.requirements.map((requirement) => requirement.id));
      for (const requirement of requirements) {
        if (existingIds.has(requirement.id)) {
          throw new Error(`Duplicate record ID: ${requirement.id}`);
        }
        existingIds.add(requirement.id);
      }
      state.requirements.push(...requirements);
      return requirements;
    });
  }

  async getRequirement(requirementId: string): Promise<RequirementRecord | null> {
    return this.findRecord("requirements", requirementId);
  }

  async listRequirements(projectId: string, page: number, limit: number): Promise<Page<RequirementRecord>> {
    const requirements = this.getState().requirements.filter((requirement) => requirement.projectId === projectId);
    return makePage(requirements, page, limit);
  }

  reviseRequirement(
    requirementId: string,
    actorUserId: string,
    patch: Partial<Pick<RequirementRecord, "title" | "description" | "type" | "priority" | "sourceFacts" | "assumptions" | "openQuestions">>
  ): Promise<RequirementRecord | null> {
    return this.update((state) => {
      const requirement = state.requirements.find((record) => record.id === requirementId);
      if (!requirement) {
        return null;
      }

      state.versions.push({
        id: randomUUID(),
        projectId: requirement.projectId,
        artifactType: "requirement",
        artifactId: requirement.id,
        version: requirement.version,
        snapshot: { ...requirement, traceability: { ...requirement.traceability } },
        actorUserId,
        reason: "Requirement edited",
        createdAt: new Date().toISOString()
      });
      Object.assign(requirement, patch);
      requirement.version += 1;
      requirement.status = "draft";
      requirement.updatedAt = new Date().toISOString();
      return requirement;
    });
  }

  async getArtifact(artifactType: ApprovalArtifactType, artifactId: string): Promise<RequirementRecord | ArtifactRecord | null> {
    if (artifactType === "requirement") {
      return this.getRequirement(artifactId);
    }
    const artifact = await this.findRecord<ArtifactRecord, "artifacts">("artifacts", artifactId);
    return artifact?.type === artifactType ? artifact : null;
  }

  async getArtifactById(artifactId: string): Promise<ArtifactRecord | null> {
    return this.findRecord<ArtifactRecord, "artifacts">("artifacts", artifactId);
  }

  async listArtifacts(projectId: string, page: number, limit: number): Promise<Page<ArtifactRecord>> {
    return makePage(this.getState().artifacts.filter((artifact) => artifact.projectId === projectId), page, limit);
  }

  async createArtifact(artifact: ArtifactRecord): Promise<ArtifactRecord> {
    return this.insertRecord("artifacts", artifact);
  }

  createArtifacts(artifacts: ArtifactRecord[]): Promise<ArtifactRecord[]> {
    return this.update((state) => {
      const existingIds = new Set(state.artifacts.map((artifact) => artifact.id));
      for (const artifact of artifacts) {
        if (existingIds.has(artifact.id)) {
          throw new Error(`Duplicate record ID: ${artifact.id}`);
        }
        existingIds.add(artifact.id);
      }
      state.artifacts.push(...artifacts);
      return artifacts;
    });
  }

  reviseArtifact(
    artifactId: string,
    actorUserId: string,
    patch: Partial<Pick<ArtifactRecord, "title" | "description" | "requirementIds" | "data">>
  ): Promise<ArtifactRecord | null> {
    return this.update((state) => {
      const artifact = state.artifacts.find((record) => record.id === artifactId);
      if (!artifact) {
        return null;
      }
      if (state.approvals.some((approval) =>
        approval.artifactType === artifact.type
        && approval.artifactId === artifact.id
        && approval.decision === "pending"
      )) {
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
        createdAt: new Date().toISOString()
      });
      Object.assign(artifact, patch);
      artifact.version += 1;
      artifact.status = "draft";
      artifact.updatedAt = new Date().toISOString();
      return artifact;
    });
  }

  async createApproval(approval: ApprovalRecord): Promise<ApprovalRecord> {
    return this.update((state) => {
      if (state.approvals.some((record) => record.id === approval.id)) {
        throw new Error(`Duplicate record ID: ${approval.id}`);
      }
      const artifact = approval.artifactType === "requirement"
        ? state.requirements.find((record) => record.id === approval.artifactId)
        : state.artifacts.find((record) => record.id === approval.artifactId && record.type === approval.artifactType);
      const pendingApprovalExists = state.approvals.some((record) =>
        record.artifactType === approval.artifactType
        && record.artifactId === approval.artifactId
        && record.decision === "pending"
      );
      if (!artifact || artifact.status !== "draft" || pendingApprovalExists) {
        throw new ApprovalSubmissionError();
      }
      state.approvals.push(approval);
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
    decision?: ApprovalDecision
  ): Promise<Page<ApprovalRecord>> {
    const approvals = this.getState().approvals
      .filter((approval) => approval.projectId === projectId && (decision === undefined || approval.decision === decision))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return makePage(approvals, page, limit);
  }

  decideApproval(
    approvalId: string,
    reviewerUserId: string,
    decision: Exclude<ApprovalDecision, "pending">,
    comments: string
  ): Promise<ApprovalRecord | null> {
    return this.update((state) => {
      const approval = state.approvals.find((record) => record.id === approvalId);
      if (!approval) {
        return null;
      }
      if (approval.decision !== "pending") {
        throw new ApprovalTransitionError();
      }

      const currentArtifact = approval.artifactType === "requirement"
        ? state.requirements.find((record) => record.id === approval.artifactId)
        : state.artifacts.find((record) => record.id === approval.artifactId && record.type === approval.artifactType);
      if (!currentArtifact) {
        return null;
      }
      if (currentArtifact.status !== "draft") {
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
        createdAt: new Date().toISOString()
      });
      currentArtifact.status = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft";
      currentArtifact.version += 1;
      currentArtifact.updatedAt = new Date().toISOString();
      approval.reviewerUserId = reviewerUserId;
      approval.decision = decision;
      approval.comments = comments;
      approval.updatedAt = new Date().toISOString();
      return approval;
    });
  }

  async listVersions(artifactType: ApprovalArtifactType, artifactId: string): Promise<VersionRecord[]> {
    return structuredClone(this.getState().versions
      .filter((version) => version.artifactType === artifactType && version.artifactId === artifactId)
      .sort((left, right) => left.version - right.version));
  }

  async createExecution(execution: ExecutionRecord): Promise<ExecutionRecord> {
    return this.insertRecord("executions", execution);
  }

  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    return this.findRecord("executions", executionId);
  }

  updateExecution(
    executionId: string,
    patch: Partial<Pick<ExecutionRecord, "status" | "nodeStates" | "result" | "error" | "model" | "usage" | "startedAt" | "completedAt" | "durationMs">>
  ): Promise<ExecutionRecord | null> {
    return this.update((state) => {
      const execution = state.executions.find((record) => record.id === executionId);
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
        .filter((document) => document.projectId === projectId)
        .map(({ contentBase64: _contentBase64, ...document }) => document),
      requirements: structuredClone(state.requirements.filter((record) => record.projectId === projectId)),
      artifacts: structuredClone(state.artifacts.filter((record) => record.projectId === projectId)),
      approvals: structuredClone(state.approvals.filter((record) => record.projectId === projectId))
    };
  }

  insertUser(user: Omit<UserRecord, "id">): Promise<UserRecord> {
    return this.update((state) => {
      if (state.users.some((record) => record.email === user.email)) {
        throw new DuplicateUserError();
      }

      const record: UserRecord = { ...user, id: randomUUID() };
      state.users.push(record);
      return record;
    });
  }

  async userCanAccessProject(projectId: string, userId: string): Promise<boolean> {
    return this.getState().projects.some((project) =>
      project.id === projectId
      && (project.ownerUserId === userId || project.members.includes(userId))
    );
  }

  private insertRecord<T extends { id: string }, C extends keyof StorageFile>(
    collectionName: C,
    record: T
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

  private async findRecord<T extends { id: string }, C extends keyof StorageFile>(
    collectionName: C,
    recordId: string
  ): Promise<T | null> {
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
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async persist(state: StorageFile): Promise<void> {
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
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
    approvals: [],
    versions: [],
    executions: []
  };
}

function makePage<T>(records: T[], page: number, limit: number): Page<T> {
  const start = (page - 1) * limit;
  return {
    items: structuredClone(records.slice(start, start + limit)),
    page,
    limit,
    total: records.length
  };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
