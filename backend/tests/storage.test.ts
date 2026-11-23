import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  JsonFileStorage,
  LastActiveAdminError,
} from "../src/config/storage";
import { DuplicateUserError } from "../src/modules/auth/user.repository";

describe("JsonFileStorage", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "business-analyst-storage-"),
    );
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("creates the JSON store and keeps users across storage instances", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });
    await storage.connect();

    const user = await storage.insertUser({
      email: "analyst@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["business_analyst"],
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await storage.close();

    const persistedContents = JSON.parse(await readFile(filePath, "utf8")) as {
      version: number;
      users: Array<{ id: string; email: string; active: boolean }>;
      projects: unknown[];
    };
    const reloadedStorage = new JsonFileStorage({ jsonStoragePath: filePath });
    await reloadedStorage.connect();

    expect(persistedContents.version).toBe(2);
    expect(persistedContents.users).toEqual([
      {
        id: user.id,
        email: user.email,
        passwordHash: "bcrypt-hash",
        roles: ["business_analyst"],
        active: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    ]);
    expect(await reloadedStorage.findByEmail(user.email)).toEqual(user);
    await reloadedStorage.close();
  });

  it("loads existing JSON records with defaults for newly added lifecycle and template fields", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });
    await storage.connect();
    const user = await storage.insertUser({
      email: "legacy@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["business_analyst"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await storage.close();

    const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
      users: Array<Record<string, unknown>>;
      templates: unknown[];
    };
    const legacyUsers = persisted.users.map((record) => {
      const legacyRecord = { ...record };
      delete legacyRecord.active;
      return legacyRecord;
    });
    const legacyState: Record<string, unknown> = {
      ...persisted,
      users: legacyUsers,
    };
    delete legacyState.templates;
    await writeFile(filePath, JSON.stringify(legacyState));

    const reloaded = new JsonFileStorage({ jsonStoragePath: filePath });
    await reloaded.connect();
    expect(await reloaded.findById(user.id)).toMatchObject({ active: true });
    expect(await reloaded.listTemplates()).toEqual([]);
    await reloaded.close();
  });

  it("serializes writes and rejects duplicate email addresses", async () => {
    const storage = new JsonFileStorage({
      jsonStoragePath: join(temporaryDirectory, "store.json"),
    });
    await storage.connect();
    const user = {
      email: "duplicate@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["business_analyst" as const],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const results = await Promise.allSettled([
      storage.insertUser(user),
      storage.insertUser(user),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(DuplicateUserError),
    });
    await storage.close();
  });

  it("protects the last active administrator and atomically records lifecycle events", async () => {
    const storage = new JsonFileStorage({
      jsonStoragePath: join(temporaryDirectory, "store.json"),
    });
    await storage.connect();
    const now = new Date().toISOString();
    const admin = await storage.insertUser({
      email: "admin@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["admin"],
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const actor = await storage.insertUser({
      email: "actor@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["business_analyst"],
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      storage.updateUserActiveStatus(admin.id, false, actor.id),
    ).rejects.toBeInstanceOf(LastActiveAdminError);
    await expect(
      storage.updateUserRoles(admin.id, ["business_analyst"], actor.id),
    ).rejects.toBeInstanceOf(LastActiveAdminError);
    await storage.updateUserActiveStatus(actor.id, false, admin.id);
    await storage.updateUserActiveStatus(actor.id, true, admin.id);
    const exportedEvents = await storage.exportAuditEvents(admin.id);
    const persistedEvents = await storage.listAuditEvents(1, 100);

    expect(await storage.findById(admin.id)).toMatchObject({ active: true });
    expect(exportedEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "user.registered",
        "user.deactivated",
        "user.reactivated",
        "audit.exported",
      ]),
    );
    expect(persistedEvents.total).toBe(exportedEvents.length);
    await storage.close();
  });

  it("fails safely when the existing JSON file is malformed", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    await writeFile(filePath, "not-json");
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });

    await expect(storage.connect()).rejects.toThrow("contains invalid JSON");
    expect(await readFile(filePath, "utf8")).toBe("not-json");
  });

  it("checks project ownership and membership from stored JSON", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    await writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        users: [],
        projects: [
          {
            id: "project-one",
            ownerUserId: "owner-one",
            members: ["member-one"],
          },
        ],
      }),
    );
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });
    await storage.connect();

    expect(await storage.userCanAccessProject("project-one", "owner-one")).toBe(
      true,
    );
    expect(
      await storage.userCanAccessProject("project-one", "member-one"),
    ).toBe(true);
    expect(
      await storage.userCanAccessProject("project-one", "other-user"),
    ).toBe(false);
    expect(await storage.getProject("project-one")).toMatchObject({
      businessObjective: "",
      inScope: "",
      outOfScope: "",
      stakeholders: [],
      constraints: [],
      desiredOutputs: [],
    });
    await storage.close();
  });

  it("loads older version-2 project records with defaults for new intake fields", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    const timestamp = new Date().toISOString();
    await writeFile(
      filePath,
      JSON.stringify({
        version: 2,
        users: [],
        projects: [
          {
            id: "project-one",
            name: "Existing project",
            description: "An existing project description.",
            ownerUserId: "owner-one",
            members: [],
            status: "active",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        documents: [],
        requirements: [],
        artifacts: [],
        approvals: [],
        auditEvents: [],
        versions: [],
        executions: [],
      }),
    );
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });
    await storage.connect();

    expect(await storage.getProject("project-one")).toMatchObject({
      businessObjective: "",
      inScope: "",
      outOfScope: "",
      stakeholders: [],
      constraints: [],
      desiredOutputs: [],
    });
    await storage.close();
  });
});
