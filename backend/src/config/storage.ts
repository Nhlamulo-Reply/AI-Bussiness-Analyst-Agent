import { constants } from "node:fs";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { AppConfig } from "./env";
import { DuplicateUserError, type UserRecord, type UserRepository } from "../modules/auth/user.repository";
import type { ProjectRepository } from "../common/middleware/project-access";

const userRecordSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  passwordHash: z.string().min(1),
  roles: z.array(z.enum(["user", "reviewer", "admin", "project_owner"])),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict();

const projectRecordSchema = z.object({
  id: z.string().min(1),
  ownerUserId: z.string().min(1),
  members: z.array(z.string()).default([])
}).passthrough();

const storageFileSchema = z.object({
  version: z.literal(1),
  users: z.array(userRecordSchema),
  projects: z.array(projectRecordSchema)
}).strict();

type StorageFile = z.infer<typeof storageFileSchema>;

export interface Storage {
  connect(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
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

      const emptyState: StorageFile = { version: 1, users: [], projects: [] };
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
    if (!parsedStorage.success) {
      throw new Error(`JSON storage file has an unsupported or invalid structure: ${this.filePath}`);
    }
    this.state = parsedStorage.data;
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

function isMissingFile(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
