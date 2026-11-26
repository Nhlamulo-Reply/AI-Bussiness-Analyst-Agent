import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonFileStorage, LastActiveAdminError } from "../src/config/storage";
import { executionSchema } from "../src/modules/domain/domain.schemas";
import { DuplicateUserError } from "../src/modules/auth/user.repository";

describe("execution schema", () => {
  it("normalizes null error fields from existing MongoDB records", () => {
    const execution = executionSchema.parse({
      id: "execution-1",
      projectId: "project-1",
      workflowName: "requirements-analysis",
      status: "completed",
      nodeStates: [
        { node: "analysis", status: "completed", error: null },
      ],
      error: null,
      createdByUserId: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(execution.error).toBeUndefined();
    expect(execution.nodeStates[0]?.error).toBeUndefined();
  });
});

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
        sessionVersion: 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    ]);
    expect(await reloadedStorage.findByEmail(user.email)).toEqual(user);
    await reloadedStorage.close();
  });

  it("adds current labels to audit listings without changing stored IDs or exports", async () => {
    const storage = new JsonFileStorage({
      jsonStoragePath: join(temporaryDirectory, "store.json"),
    });
    await storage.connect();
    const now = new Date().toISOString();
    const user = await storage.insertUser({
      email: "analyst@example.test",
      passwordHash: "bcrypt-hash",
      roles: ["business_analyst"],
      createdAt: now,
      updatedAt: now,
    });
    const project = {
      id: "project-audit",
      name: "Customer onboarding",
      description: "",
      businessObjective: "",
      inScope: "",
      outOfScope: "",
      stakeholders: [],
      constraints: [],
      desiredOutputs: [],
      ownerUserId: user.id,
      members: [],
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    };
    await storage.createProject(project);
    await storage.createDocument({
      id: "document-audit",
      projectId: project.id,
      uploadedByUserId: user.id,
      fileName: "onboarding-brief.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4,
      contentBase64: "dGVzdA==",
      status: "uploaded",
      createdAt: now,
    });
    await storage.createRequirement({
      id: "requirement-audit",
      projectId: project.id,
      title: "Support secure account recovery",
      description: "",
      type: "business",
      status: "draft",
      priority: "medium",
      sourceFacts: [],
      assumptions: [],
      openQuestions: [],
      traceability: { documentIds: [] },
      version: 1,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    });
    await storage.createArtifact({
      id: "artifact-audit",
      projectId: project.id,
      type: "story",
      title: "Recover an account",
      description: "",
      status: "draft",
      requirementIds: [],
      data: {},
      version: 1,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    });

    const labeledEvents = await storage.listAuditEventsWithLabels(1, 100);
    const documentEvent = labeledEvents.items.find(
      (event) => event.resourceId === "document-audit",
    );
    const requirementEvent = labeledEvents.items.find(
      (event) => event.resourceId === "requirement-audit",
    );
    const artifactEvent = labeledEvents.items.find(
      (event) => event.resourceId === "artifact-audit",
    );
    const projectEvent = labeledEvents.items.find(
      (event) => event.resourceId === project.id,
    );

    expect(documentEvent).toMatchObject({
      actorUserId: user.id,
      actorEmail: user.email,
      resourceId: "document-audit",
      resourceLabel: "onboarding-brief.pdf",
      projectId: project.id,
      projectName: project.name,
    });
    expect(requirementEvent).toMatchObject({
      resourceId: "requirement-audit",
      resourceLabel: "Support secure account recovery",
      projectName: project.name,
    });
    expect(artifactEvent).toMatchObject({
      resourceId: "artifact-audit",
      resourceLabel: "story",
      projectName: project.name,
    });
    expect(projectEvent).toMatchObject({
      resourceId: project.id,
      projectId: project.id,
      resourceLabel: project.name,
      projectName: project.name,
    });
    expect(JSON.stringify(labeledEvents)).not.toContain("dGVzdA==");

    const rawEvents = await storage.listAuditEvents(1, 100);
    expect(
      rawEvents.items.find((event) => event.resourceId === "document-audit"),
    ).not.toHaveProperty("resourceLabel");
    const exportedEvents = await storage.exportAuditEvents(user.id);
    expect(exportedEvents.every((event) => !("actorEmail" in event))).toBe(
      true,
    );
    await storage.close();
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
