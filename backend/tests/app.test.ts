import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app";
import type { AppConfig } from "../src/config/env";
import { JsonFileStorage } from "../src/config/storage";
import { openApiDocument } from "../src/docs/openapi";
import type { UserRecord } from "../src/modules/auth/user.repository";

const config: AppConfig = {
  environment: "test",
  port: 3000,
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
  emailProvider: "none",
  smtpSecure: false,
};

let app: ReturnType<typeof createApp>;
let storage: JsonFileStorage;
let temporaryDirectory: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "business-analyst-api-"));
  storage = new JsonFileStorage({
    jsonStoragePath: join(temporaryDirectory, "store.json"),
  });
  await storage.connect();
  app = createApp({ config, storage, users: storage });
});

afterEach(async () => {
  await storage.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("backend foundation", () => {
  it("returns live and ready health responses", async () => {
    const live = await request(app).get("/api/v1/health/live");
    const ready = await request(app).get("/api/v1/health/ready");

    expect(live.status).toBe(200);
    expect(live.body.data.status).toBe("ok");
    expect(live.headers["x-request-id"]).toBe(live.body.requestId);
    expect(ready.status).toBe(200);
    expect(ready.body.data.storage).toBe("json");
  });

  it("reports readiness failure without exposing storage errors", async () => {
    await storage.close();
    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain(temporaryDirectory);
  });

  it("validates credentials and returns the standard error envelope", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("x-request-id", "validation-test")
      .send({ email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR", requestId: "validation-test" },
    });
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it("returns a validation error for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.requestId).toBe(
      response.headers["x-request-id"],
    );
  });

  it("registers users without roles until an administrator assigns access", async () => {
    const registration = await request(app).post("/api/v1/auth/register").send({
      email: " Analyst@Example.com ",
      password: "a-long-test-password",
    });
    const token = registration.body.data.accessToken as string;
    const profile = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({
      email: "analyst@example.com",
      roles: [],
    });
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe("analyst@example.com");
    expect(profile.body.data.user.roles).toEqual([]);

    const inaccessibleProjectCreation = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pending account project" });
    const pendingLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "analyst@example.com", password: "a-long-test-password" });
    const failedLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "analyst@example.com", password: "a-different-password" });

    expect(inaccessibleProjectCreation.status).toBe(403);
    expect(pendingLogin.status).toBe(200);
    expect(pendingLogin.body.data.user.roles).toEqual([]);
    expect(failedLogin.status).toBe(401);
    expect(failedLogin.body.error.code).toBe("INVALID_CREDENTIALS");

    await storage.updateUserRoles(registration.body.data.user.id, [
      "business_analyst",
    ]);
    const staleProfile = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "analyst@example.com", password: "a-long-test-password" });

    expect(staleProfile.status).toBe(401);
    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe(registration.body.data.user.id);
    expect(login.body.data.user.roles).toEqual(["business_analyst"]);
  });

  it("rejects unauthenticated and inaccessible project requests", async () => {
    const unauthenticated = await request(app).get("/api/v1/auth/me");
    const user = await registerUser("person@example.com");
    const inaccessible = await request(app)
      .get(`/api/v1/projects/${randomUUID()}`)
      .set("Authorization", `Bearer ${user.token}`);

    expect(unauthenticated.status).toBe(401);
    expect(inaccessible.status).toBe(404);
  });

  it("creates projects, paginates access, and hides projects from non-members", async () => {
    const ownerRegistration = await registerUser("owner@example.com");
    const ownerToken = ownerRegistration.token;
    const outsider = await registerUser("outsider@example.com");
    const projectResponse = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Requirements project",
        businessObjective: "Reduce onboarding drop-off.",
        inScope: "Account setup and first use.",
        stakeholders: ["Operations manager", "Support team"],
        constraints: ["Launch before Q4."],
        desiredOutputs: ["Prioritized requirements"],
      });
    const listResponse = await request(app)
      .get("/api/v1/projects?page=1&limit=1")
      .set("Authorization", `Bearer ${ownerToken}`);
    const invalidPage = await request(app)
      .get("/api/v1/projects?page=0")
      .set("Authorization", `Bearer ${ownerToken}`);
    const hiddenResponse = await request(app)
      .get(`/api/v1/projects/${projectResponse.body.data.id}`)
      .set("Authorization", `Bearer ${outsider.token}`);

    expect(projectResponse.status).toBe(201);
    expect(projectResponse.body.data).toMatchObject({
      businessObjective: "Reduce onboarding drop-off.",
      inScope: "Account setup and first use.",
      outOfScope: "",
      stakeholders: ["Operations manager", "Support team"],
      constraints: ["Launch before Q4."],
      desiredOutputs: ["Prioritized requirements"],
    });
    expect(listResponse.body.data).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
    });
    expect(invalidPage.status).toBe(400);
    expect(hiddenResponse.status).toBe(404);
  });

  it("does not allow administrators to list projects", async () => {
    const registration = await registerUser("admin-projects@example.com");
    const updatedUser = await storage.updateUserRoles(registration.id, [
      "admin",
    ]);
    expect(updatedUser?.roles).toEqual(["admin"]);

    const adminToken = await login("admin-projects@example.com");
    const response = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("allows owners to revise project briefs and audits sensitive project changes", async () => {
    const owner = await registerUser("project-audit-owner@example.com");
    const member = await registerUser("project-audit-member@example.com");
    const project = await createProject(owner.token);
    const update = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        businessObjective: "Private objective details.",
        stakeholders: ["Operations lead"],
      });
    const memberUpdate = await request(app)
      .patch(`/api/v1/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ memberIds: [member.id] });
    const forbiddenUpdate = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inScope: "Unauthorized edit." });
    const upload = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("Requirements source."), {
        filename: "requirements.txt",
        contentType: "text/plain",
      });
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Initial requirement", type: "business" });
    const revisedRequirement = await request(app)
      .patch(`/api/v1/requirements/${requirement.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Revised requirement" });
    const artifact = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "business_rule", title: "Initial rule" });
    const revisedArtifact = await request(app)
      .patch(`/api/v1/artifacts/${artifact.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Revised rule" });
    const auditEvents = await storage.listAuditEvents(1, 100);
    const actions = auditEvents.items.map((event) => event.action);

    expect(update.status).toBe(200);
    expect(update.body.data.businessObjective).toBe(
      "Private objective details.",
    );
    expect(memberUpdate.status).toBe(200);
    expect(forbiddenUpdate.status).toBe(403);
    expect(upload.status).toBe(201);
    expect(requirement.status).toBe(201);
    expect(revisedRequirement.status).toBe(200);
    expect(artifact.status).toBe(201);
    expect(revisedArtifact.status).toBe(200);
    expect(actions).toEqual(
      expect.arrayContaining([
        "project.created",
        "project.updated",
        "project.members_changed",
        "document.uploaded",
        "requirement.created",
        "requirement.updated",
        "artifact.created",
        "artifact.updated",
      ]),
    );
    expect(JSON.stringify(auditEvents.items)).not.toContain(
      "Private objective details.",
    );
  });

  it("validates uploads, redacts stored document contents, and excludes them from exports", async () => {
    const owner = await registerUser("documents@example.com");
    const project = await createProject(owner.token);
    const upload = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("%PDF-1.4\nsample"), {
        filename: "brief.pdf",
        contentType: "application/pdf",
      });
    const invalid = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("not a PDF"), {
        filename: "brief.pdf",
        contentType: "application/pdf",
      });
    const empty = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.alloc(0), {
        filename: "empty.txt",
        contentType: "text/plain",
      });
    const oversized = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, 0x61), {
        filename: "large.txt",
        contentType: "text/plain",
      });
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "=1+1", type: "functional" });
    const documentList = await request(app)
      .get(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`);
    const exportResponse = await request(app)
      .get(`/api/v1/projects/${project.id}/export?format=json`)
      .set("Authorization", `Bearer ${owner.token}`);
    const csvExport = await request(app)
      .get(`/api/v1/projects/${project.id}/export?format=csv`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(upload.status).toBe(201);
    expect(upload.body.data).not.toHaveProperty("contentBase64");
    expect(documentList.body.data[0]).not.toHaveProperty("contentBase64");
    expect(invalid.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.text).not.toContain("contentBase64");
    expect(exportResponse.text).not.toContain(
      Buffer.from("%PDF-1.4\nsample").toString("base64"),
    );
    expect(csvExport.text).toContain('"\'=1+1"');
    expect(requirement.status).toBe(201);
  });

  it("soft-archives documents for owners, retains bytes, and restores them", async () => {
    const owner = await registerUser("archive-owner@example.com");
    const member = await registerUser("archive-member@example.com");
    const project = await createProject(owner.token);
    await request(app)
      .patch(`/api/v1/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ memberIds: [member.id] });
    const upload = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("keep these bytes"), {
        filename: "archive-me.txt",
        contentType: "text/plain",
      });
    const documentId = upload.body.data.id as string;
    const forbiddenArchive = await request(app)
      .patch(`/api/v1/projects/${project.id}/documents/${documentId}/archive`)
      .set("Authorization", `Bearer ${member.token}`);
    const forbiddenArchivedList = await request(app)
      .get(`/api/v1/projects/${project.id}/documents?includeArchived=true`)
      .set("Authorization", `Bearer ${member.token}`);
    const archived = await request(app)
      .patch(`/api/v1/projects/${project.id}/documents/${documentId}/archive`)
      .set("Authorization", `Bearer ${owner.token}`);
    const activeListAfterArchive = await request(app)
      .get(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`);
    const archivedList = await request(app)
      .get(`/api/v1/projects/${project.id}/documents?includeArchived=true`)
      .set("Authorization", `Bearer ${owner.token}`);
    const exportAfterArchive = await request(app)
      .get(`/api/v1/projects/${project.id}/export?format=json`)
      .set("Authorization", `Bearer ${owner.token}`);
    const storedDocument = await storage.getDocument(documentId);
    const restored = await request(app)
      .patch(`/api/v1/projects/${project.id}/documents/${documentId}/restore`)
      .set("Authorization", `Bearer ${owner.token}`);
    const activeListAfterRestore = await request(app)
      .get(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(upload.status).toBe(201);
    expect(forbiddenArchive.status).toBe(403);
    expect(forbiddenArchivedList.status).toBe(403);
    expect(archived.status).toBe(200);
    expect(archived.body.data).toMatchObject({
      id: documentId,
      status: "archived",
      archivedByUserId: owner.id,
    });
    expect(archived.body.data.archivedAt).toEqual(expect.any(String));
    expect(activeListAfterArchive.body.data).toEqual([]);
    expect(archivedList.body.data).toHaveLength(1);
    expect(archivedList.body.data[0]).not.toHaveProperty("contentBase64");
    expect(exportAfterArchive.text).not.toContain("archive-me.txt");
    expect(storedDocument?.contentBase64).toBe(
      Buffer.from("keep these bytes").toString("base64"),
    );
    expect(restored.body.data).toMatchObject({
      id: documentId,
      status: "uploaded",
    });
    expect(restored.body.data).not.toHaveProperty("archivedAt");
    expect(activeListAfterRestore.body.data).toHaveLength(1);
    const auditEvents = await storage.listAuditEvents(1, 100);
    expect(auditEvents.items.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "document.archived",
        "document.restored",
        "project.exported",
      ]),
    );
  });

  it("moves an owner project to Trash, hides its resources, and restores it", async () => {
    const owner = await registerUser("trash-project-owner@example.com");
    const member = await registerUser("trash-project-member@example.com");
    const project = await createProject(owner.token);
    await request(app)
      .patch(`/api/v1/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ memberIds: [member.id] });
    const upload = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("keep this source"), {
        filename: "trash-source.txt",
        contentType: "text/plain",
      });

    const forbiddenTrash = await request(app)
      .delete(`/api/v1/trash/project/${project.id}`)
      .set("Authorization", `Bearer ${member.token}`);
    const trashed = await request(app)
      .delete(`/api/v1/trash/project/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const inaccessible = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${member.token}`);
    const hiddenProjects = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`);
    const trash = await request(app)
      .get("/api/v1/trash")
      .set("Authorization", `Bearer ${owner.token}`);
    const restored = await request(app)
      .patch(`/api/v1/trash/project/${project.id}/restore`)
      .set("Authorization", `Bearer ${owner.token}`);
    const visibleDocuments = await request(app)
      .get(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(upload.status).toBe(201);
    expect(forbiddenTrash.status).toBe(403);
    expect(trashed.status).toBe(200);
    expect(trashed.body.data).toMatchObject({
      resourceType: "project",
      id: project.id,
      label: "Test project",
    });
    expect(inaccessible.status).toBe(404);
    expect(hiddenProjects.body.data.total).toBe(0);
    expect(trash.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: project.id,
          canRestore: true,
          canPurge: false,
        }),
      ]),
    );
    expect(restored.status).toBe(200);
    expect(visibleDocuments.body.data).toHaveLength(1);
    const events = await storage.listAuditEvents(1, 100);
    expect(events.items.map((event) => event.action)).toEqual(
      expect.arrayContaining(["project.trashed", "project.restored"]),
    );
  });

  it("trashes only an author's draft requirements and artifacts without approval history", async () => {
    const owner = await registerUser("trash-drafts@example.com");
    const project = await createProject(owner.token);
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Draft requirement", type: "business" });
    const artifact = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "story", title: "Draft story" });

    const trashedRequirement = await request(app)
      .delete(`/api/v1/trash/requirement/${requirement.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const trashedArtifact = await request(app)
      .delete(`/api/v1/trash/artifact/${artifact.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const requirementList = await request(app)
      .get(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`);
    const artifactList = await request(app)
      .get(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(trashedRequirement.status).toBe(200);
    expect(trashedArtifact.status).toBe(200);
    expect(requirementList.body.data.total).toBe(0);
    expect(artifactList.body.data.total).toBe(0);

    const restoredRequirement = await request(app)
      .patch(
        `/api/v1/trash/requirement/${requirement.body.data.id}/restore`,
      )
      .set("Authorization", `Bearer ${owner.token}`);
    const restoredArtifact = await request(app)
      .patch(`/api/v1/trash/artifact/${artifact.body.data.id}/restore`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(restoredRequirement.status).toBe(200);
    expect(restoredArtifact.status).toBe(200);
  });

  it("keeps submitted approval records out of Trash", async () => {
    const owner = await registerUser("trash-approved-record@example.com");
    const project = await createProject(owner.token);
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Submitted requirement", type: "business" });
    const approval = await request(app)
      .post("/api/v1/approvals")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        projectId: project.id,
        artifactType: "requirement",
        artifactId: requirement.body.data.id,
        comments: "Ready for review.",
      });

    const trashSubmittedRequirement = await request(app)
      .delete(`/api/v1/trash/requirement/${requirement.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const trashApproval = await request(app)
      .delete(`/api/v1/trash/approval/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const savedApproval = await storage.getApproval(approval.body.data.id);

    expect(approval.status).toBe(201);
    expect(trashSubmittedRequirement.status).toBe(403);
    expect(trashApproval.status).toBe(404);
    expect(savedApproval?.decision).toBe("pending");
  });

  it("restricts permanent purge to admins after 30 days and keeps audit labels", async () => {
    const owner = await registerUser("trash-purge-owner@example.com");
    const adminCandidate = await registerUser("trash-purge-admin@example.com");
    await storage.updateUserRoles(adminCandidate.id, ["admin"]);
    const adminToken = await login("trash-purge-admin@example.com");
    const adminRecord = await storage.findById(adminCandidate.id);
    if (!adminRecord) throw new Error("Trash test admin could not be found.");
    const longLivedAdminToken = createTestToken(
      adminRecord,
      60 * 60 * 24 * 60,
    );
    const project = await createProject(owner.token);
    const trashed = await request(app)
      .delete(`/api/v1/trash/project/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const earlyPurge = await request(app)
      .delete(`/api/v1/trash/project/${project.id}/purge`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        confirmation: "Test project",
        reason: "Owner requested permanent deletion.",
      });
    const forbiddenPurge = await request(app)
      .delete(`/api/v1/trash/project/${project.id}/purge`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        confirmation: "Test project",
        reason: "Owner requested permanent deletion.",
      });

    expect(trashed.status).toBe(200);
    expect(earlyPurge.status).toBe(409);
    expect(forbiddenPurge.status).toBe(403);

    const futureTime = Date.now() + 31 * 24 * 60 * 60 * 1000;
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(futureTime);
    try {
      const eligibleTrash = await request(app)
        .get("/api/v1/trash")
        .set("Authorization", `Bearer ${longLivedAdminToken}`);
      const purged = await request(app)
        .delete(`/api/v1/trash/project/${project.id}/purge`)
        .set("Authorization", `Bearer ${longLivedAdminToken}`)
        .send({
          confirmation: "Test project",
          reason: "Owner requested permanent deletion.",
        });
      const auditEvents = await storage.listAuditEventsWithLabels(1, 100);

      expect(eligibleTrash.body.data.items[0].canPurge).toBe(true);
      expect(purged.status).toBe(200);
      expect(
        auditEvents.items.find(
          (event) =>
            event.resourceId === project.id &&
            event.action === "project.purged",
        ),
      ).toMatchObject({
        resourceId: project.id,
        resourceLabel: "Test project",
        projectName: "Test project",
      });
    } finally {
      dateNow.mockRestore();
    }
  });

  it("allows exactly one token-authorized first-admin bootstrap and exposes admin audit data", async () => {
    const bootstrapToken = "one-time-bootstrap-token-with-at-least-32-chars";
    const bootstrapApp = createApp({
      config: { ...config, adminBootstrapToken: bootstrapToken },
      storage,
      users: storage,
    });

    const firstCandidate = await registerPendingUser(
      "bootstrap-first@example.com",
    );
    const secondCandidate = await registerPendingUser(
      "bootstrap-second@example.com",
    );
    const forbiddenUserList = await request(bootstrapApp)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${firstCandidate.token}`);
    const forbiddenAuditList = await request(bootstrapApp)
      .get("/api/v1/admin/audit-events")
      .set("Authorization", `Bearer ${firstCandidate.token}`);
    const disabled = await request(app)
      .post("/api/v1/users/bootstrap-admin")
      .set("Authorization", `Bearer ${firstCandidate.token}`)
      .send({ token: bootstrapToken });
    const invalidToken = await request(bootstrapApp)
      .post("/api/v1/users/bootstrap-admin")
      .set("Authorization", `Bearer ${firstCandidate.token}`)
      .send({ token: "incorrect-token-with-more-than-32-characters" });
    const claims = await Promise.all([
      request(bootstrapApp)
        .post("/api/v1/users/bootstrap-admin")
        .set("Authorization", `Bearer ${firstCandidate.token}`)
        .send({ token: bootstrapToken }),
      request(bootstrapApp)
        .post("/api/v1/users/bootstrap-admin")
        .set("Authorization", `Bearer ${secondCandidate.token}`)
        .send({ token: bootstrapToken }),
    ]);

    expect(disabled.status).toBe(404);
    expect(invalidToken.status).toBe(403);
    expect(forbiddenUserList.status).toBe(403);
    expect(forbiddenAuditList.status).toBe(403);
    expect(claims.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const claimedResponse = claims.find((response) => response.status === 200);
    const claimedUserId = claimedResponse?.body.data.id as string;
    const claimedEmail =
      claimedUserId === firstCandidate.id
        ? "bootstrap-first@example.com"
        : "bootstrap-second@example.com";
    expect(claimedResponse?.body.data).toMatchObject({
      roles: ["admin"],
      requiresLogin: true,
    });

    const adminToken = await login(claimedEmail);
    const target = await registerUser("bootstrap-managed-user@example.com");
    const userList = await request(bootstrapApp)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    const incompatibleRoleUpdate = await request(bootstrapApp)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ roles: ["business_analyst", "admin"] });
    const roleUpdate = await request(bootstrapApp)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ roles: ["business_analyst", "product_owner"] });
    const pendingRoleUpdate = await request(bootstrapApp)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ roles: [] });
    const invalidatedTargetSession = await request(bootstrapApp)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${target.token}`);
    const auditResponse = await request(bootstrapApp)
      .get("/api/v1/admin/audit-events")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(userList.status).toBe(200);
    expect(userList.body.data.items).toHaveLength(3);
    expect(
      userList.body.data.items.every(
        (user: object) =>
          !("passwordHash" in user) &&
          !("sessionVersion" in user) &&
          !("googleSubject" in user),
      ),
    ).toBe(true);
    expect(incompatibleRoleUpdate.status).toBe(400);
    expect(roleUpdate.status).toBe(200);
    expect(pendingRoleUpdate.status).toBe(200);
    expect(pendingRoleUpdate.body.data.roles).toEqual([]);
    expect(invalidatedTargetSession.status).toBe(401);
    expect(auditResponse.status).toBe(200);
    expect(
      auditResponse.body.data.items.map(
        (event: { action: string }) => event.action,
      ),
    ).toEqual(
      expect.arrayContaining(["admin.bootstrap", "user.roles_changed"]),
    );
    expect(
      auditResponse.body.data.items.find(
        (event: { action: string; resourceId: string }) =>
          event.action === "user.roles_changed" &&
          event.resourceId === target.id,
      ),
    ).toMatchObject({
      actorUserId: claimedUserId,
      actorEmail: claimedEmail,
      resourceId: target.id,
      resourceLabel: "bootstrap-managed-user@example.com",
    });
  });

  it("deactivates accounts, revokes JWTs immediately, and allows reactivation", async () => {
    const admin = await registerUser("lifecycle-admin@example.com");
    const member = await registerUser("lifecycle-member@example.com");
    await storage.updateUserRoles(admin.id, ["admin"]);
    const adminToken = await login("lifecycle-admin@example.com");

    const selfDeactivation = await request(app)
      .patch(`/api/v1/admin/users/${admin.id}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    const deactivated = await request(app)
      .patch(`/api/v1/admin/users/${member.id}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    const existingSession = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${member.token}`);
    const inactiveLogin = await request(app).post("/api/v1/auth/login").send({
      email: "lifecycle-member@example.com",
      password: "a-long-test-password",
    });

    expect(selfDeactivation.status).toBe(400);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.active).toBe(false);
    expect(existingSession.status).toBe(401);
    expect(inactiveLogin.status).toBe(401);

    const reactivated = await request(app)
      .patch(`/api/v1/admin/users/${member.id}/active`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: true });
    const newLogin = await request(app).post("/api/v1/auth/login").send({
      email: "lifecycle-member@example.com",
      password: "a-long-test-password",
    });
    const events = await storage.listAuditEvents(1, 100);

    expect(reactivated.status).toBe(200);
    expect(newLogin.status).toBe(200);
    expect(events.items.map((event) => event.action)).toEqual(
      expect.arrayContaining(["user.deactivated", "user.reactivated"]),
    );
  });

  it("keeps administrator access project-metadata-only and audits membership changes", async () => {
    const adminCandidate = await registerUser("metadata-admin@example.com");
    const owner = await registerUser("metadata-owner@example.com");
    const member = await registerUser("metadata-member@example.com");
    const project = await createProject(owner.token);
    const bootstrapToken = "metadata-admin-bootstrap-token-with-32-chars";
    const bootstrapApp = createApp({
      config: { ...config, adminBootstrapToken: bootstrapToken },
      storage,
      users: storage,
    });

    const bootstrap = await request(bootstrapApp)
      .post("/api/v1/users/bootstrap-admin")
      .set("Authorization", `Bearer ${adminCandidate.token}`)
      .send({ token: bootstrapToken });
    const adminToken = await login("metadata-admin@example.com");
    const projectList = await request(bootstrapApp)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${adminToken}`);
    const projectDetail = await request(bootstrapApp)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const accessList = await request(bootstrapApp)
      .get("/api/v1/admin/project-access?page=1&limit=10")
      .set("Authorization", `Bearer ${adminToken}`);
    const memberUpdate = await request(bootstrapApp)
      .put(`/api/v1/admin/project-access/${project.id}/members`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ memberIds: [member.id] });
    const adminMembershipAttempt = await request(bootstrapApp)
      .put(`/api/v1/admin/project-access/${project.id}/members`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ memberIds: [member.id, adminCandidate.id] });
    const memberProject = await request(bootstrapApp)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${member.token}`);
    const auditEvents = await storage.listAuditEvents(1, 100);
    const membershipEvent = auditEvents.items.find(
      (event) =>
        event.action === "project.members_changed" &&
        event.actorUserId === adminCandidate.id,
    );

    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.data.roles).toEqual(["admin"]);
    expect(projectList.status).toBe(403);
    expect(projectDetail.status).toBe(403);
    expect(accessList.status).toBe(200);
    expect(accessList.body.data.items).toContainEqual({
      id: project.id,
      name: "Test project",
      status: "active",
      ownerUserId: owner.id,
      memberCount: 0,
    });
    expect(JSON.stringify(accessList.body.data)).not.toMatch(
      /description|businessObjective|documents|requirements|artifacts|approvals/i,
    );
    expect(memberUpdate.status).toBe(200);
    expect(memberUpdate.body.data).toEqual({
      id: project.id,
      name: "Test project",
      status: "active",
      ownerUserId: owner.id,
      memberIds: [member.id],
      memberCount: 1,
    });
    expect(adminMembershipAttempt.status).toBe(400);
    expect(memberProject.status).toBe(200);
    expect(membershipEvent).toMatchObject({
      actorUserId: adminCandidate.id,
      before: { memberIds: [] },
      after: { memberIds: [member.id] },
    });
  });

  it("searches admin membership pages and incrementally adds and removes members", async () => {
    const adminCandidate = await registerUser("membership-admin@example.com");
    const owner = await registerUser("membership-owner@example.com");
    const member = await registerUser("membership-member@example.com");
    const project = await createProject(owner.token);
    const bootstrapToken = "membership-admin-bootstrap-token-with-32-chars";
    const bootstrapApp = createApp({
      config: { ...config, adminBootstrapToken: bootstrapToken },
      storage,
      users: storage,
    });

    await request(bootstrapApp)
      .post("/api/v1/users/bootstrap-admin")
      .set("Authorization", `Bearer ${adminCandidate.token}`)
      .send({ token: bootstrapToken });
    const adminToken = await login("membership-admin@example.com");

    const projectSearch = await request(bootstrapApp)
      .get("/api/v1/admin/project-access?page=1&limit=10&search=Test%20project")
      .set("Authorization", `Bearer ${adminToken}`);
    const userSearch = await request(bootstrapApp)
      .get(
        "/api/v1/admin/users?page=1&limit=10&search=membership-member%40example.com",
      )
      .set("Authorization", `Bearer ${adminToken}`);
    const membersBefore = await request(bootstrapApp)
      .get(`/api/v1/admin/project-access/${project.id}/members?page=1&limit=10`)
      .set("Authorization", `Bearer ${adminToken}`);
    const memberAdded = await request(bootstrapApp)
      .post(`/api/v1/admin/project-access/${project.id}/members`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ memberId: member.id });
    const membersAfterAdd = await request(bootstrapApp)
      .get(
        `/api/v1/admin/project-access/${project.id}/members?search=membership-member`,
      )
      .set("Authorization", `Bearer ${adminToken}`);
    const memberLogin = await login("membership-member@example.com");
    const projectAfterFreshLogin = await request(bootstrapApp)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${memberLogin}`);
    const memberRemoved = await request(bootstrapApp)
      .delete(`/api/v1/admin/project-access/${project.id}/members/${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const projectAfterRemoval = await request(bootstrapApp)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${memberLogin}`);
    const auditEvents = await storage.listAuditEvents(1, 100);

    expect(projectSearch.status).toBe(200);
    expect(projectSearch.body.data.items).toContainEqual(
      expect.objectContaining({ id: project.id, memberCount: 0 }),
    );
    expect(userSearch.status).toBe(200);
    expect(userSearch.body.data.items).toEqual([
      expect.objectContaining({
        id: member.id,
        email: "membership-member@example.com",
      }),
    ]);
    expect(membersBefore.body.data).toMatchObject({
      items: [],
      page: 1,
      total: 0,
    });
    expect(memberAdded.status).toBe(200);
    expect(memberAdded.body.data).toMatchObject({
      projectId: project.id,
      memberId: member.id,
      memberCount: 1,
      alreadyMember: false,
    });
    expect(membersAfterAdd.body.data.items).toEqual([
      expect.objectContaining({
        id: member.id,
        email: "membership-member@example.com",
      }),
    ]);
    expect(projectAfterFreshLogin.status).toBe(200);
    expect(memberRemoved.body.data).toMatchObject({
      memberId: member.id,
      memberCount: 0,
      removed: true,
    });
    expect(projectAfterRemoval.status).toBe(404);
    expect(
      auditEvents.items.filter(
        (event) =>
          event.action === "project.members_changed" &&
          event.actorUserId === adminCandidate.id,
      ),
    ).toHaveLength(2);
  });

  it("creates one-time admin invitations and activates the account only after password setup", async () => {
    const admin = await registerUser("invite-admin@example.com");
    await storage.updateUserRoles(admin.id, ["admin"]);
    const adminToken = await login("invite-admin@example.com");
    const invitation = await request(app)
      .post("/api/v1/admin/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "invited-owner@example.com",
        roles: ["product_owner"],
      });
    const inviteUrl = new URL(invitation.body.data.invitationUrl as string);
    const inviteToken = inviteUrl.searchParams.get("token");
    const resentInvitation = await request(app)
      .post("/api/v1/admin/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "invited-owner@example.com",
        roles: ["product_owner"],
      });
    const resentInviteUrl = new URL(
      resentInvitation.body.data.invitationUrl as string,
    );
    const resentInviteToken = resentInviteUrl.searchParams.get("token");
    const invitedUser = await storage.findByEmail("invited-owner@example.com");
    const revokedInvite = await request(app)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        token: inviteToken,
        password: "invited-owner-password-12",
        confirmPassword: "invited-owner-password-12",
      });
    const accountSetup = await request(app)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        token: resentInviteToken,
        password: "invited-owner-password-12",
        confirmPassword: "invited-owner-password-12",
      });
    const reusedInvite = await request(app)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        token: inviteToken,
        password: "invited-owner-password-12",
        confirmPassword: "invited-owner-password-12",
      });
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: "invited-owner@example.com",
      password: "invited-owner-password-12",
    });
    const auditEvents = await storage.listAuditEvents(1, 100);

    expect(invitation.status).toBe(201);
    expect(invitation.body.data.user).toMatchObject({
      email: "invited-owner@example.com",
      roles: ["product_owner"],
      active: false,
    });
    expect(invitedUser).toMatchObject({ active: false });
    expect(inviteUrl.pathname).toBe("/reset-password");
    expect(invitation.body.data.expiresAt).toEqual(expect.any(String));
    expect(invitation.body.data.invitationResent).toBe(false);
    expect(resentInvitation.status).toBe(200);
    expect(resentInvitation.body.data.invitationResent).toBe(true);
    expect(resentInviteToken).not.toBe(inviteToken);
    expect(revokedInvite.status).toBe(400);
    expect(accountSetup.status).toBe(200);
    expect(reusedInvite.status).toBe(400);
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.roles).toEqual(["product_owner"]);
    expect(auditEvents.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "user.invited",
          actorUserId: admin.id,
        }),
        expect.objectContaining({
          action: "user.invitation_resent",
          actorUserId: admin.id,
        }),
        expect.objectContaining({
          action: "user.invitation_accepted",
          actorUserId: invitedUser?.id,
        }),
      ]),
    );

    const mixedRoleInvitation = await request(app)
      .post("/api/v1/admin/users/invitations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "invalid-role-invite@example.com",
        roles: ["admin", "business_analyst"],
      });
    expect(mixedRoleInvitation.status).toBe(400);
  });

  it("enforces role-scoped project resources and keeps delivery feedback separate from approval", async () => {
    const owner = await registerUser("resource-owner@example.com");
    const productOwner = await registerUser(
      "resource-product-owner@example.com",
    );
    const deliveryLead = await registerUser(
      "resource-delivery-lead@example.com",
    );
    await storage.updateUserRoles(productOwner.id, ["product_owner"]);
    await storage.updateUserRoles(deliveryLead.id, ["delivery_lead"]);
    const productOwnerToken = await login("resource-product-owner@example.com");
    const deliveryLeadToken = await login("resource-delivery-lead@example.com");
    const project = await createProject(owner.token);
    const membership = await request(app)
      .patch(`/api/v1/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ memberIds: [productOwner.id, deliveryLead.id] });
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Customer outcome", type: "business" });
    const businessArtifact = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "story", title: "Customer story" });
    const deliveryArtifact = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "risk", title: "Delivery risk" });
    const businessArtifactsForOwner = await request(app)
      .get(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${productOwnerToken}`);
    const deliveryArtifactsForLead = await request(app)
      .get(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const deliveryRequirements = await request(app)
      .get(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const deliveryDocuments = await request(app)
      .get(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const deliveryApproval = await request(app)
      .post("/api/v1/approvals")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        projectId: project.id,
        artifactType: "risk",
        artifactId: deliveryArtifact.body.data.id,
      });
    const deliveryQueue = await request(app)
      .get(`/api/v1/projects/${project.id}/delivery-reviews`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const analystQueue = await request(app)
      .get(`/api/v1/projects/${project.id}/delivery-reviews`)
      .set("Authorization", `Bearer ${owner.token}`);
    const deliveryApprovalDetail = await request(app)
      .get(`/api/v1/approvals/${deliveryApproval.body.data.id}`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const deliveryDecision = await request(app)
      .patch(`/api/v1/approvals/${deliveryApproval.body.data.id}`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`)
      .send({ decision: "approved" });
    const feedback = await request(app)
      .post(
        `/api/v1/approvals/${deliveryApproval.body.data.id}/delivery-feedback`,
      )
      .set("Authorization", `Bearer ${deliveryLeadToken}`)
      .send({ comments: "Schedule a feasibility review." });
    const productOwnerDecision = await request(app)
      .patch(`/api/v1/approvals/${deliveryApproval.body.data.id}`)
      .set("Authorization", `Bearer ${productOwnerToken}`)
      .send({
        decision: "approved",
        reviewerComments: "The risk is acceptable with mitigation.",
      });
    const feedbackAfterDecision = await request(app)
      .post(
        `/api/v1/approvals/${deliveryApproval.body.data.id}/delivery-feedback`,
      )
      .set("Authorization", `Bearer ${deliveryLeadToken}`)
      .send({ comments: "Monitor this risk during rollout." });
    const feedbackId = feedback.body.data.deliveryFeedback[0].id as string;
    const forbiddenFeedbackWithdrawal = await request(app)
      .patch(
        `/api/v1/approvals/${deliveryApproval.body.data.id}/delivery-feedback/${feedbackId}/withdraw`,
      )
      .set("Authorization", `Bearer ${productOwnerToken}`);
    const withdrawnFeedback = await request(app)
      .patch(
        `/api/v1/approvals/${deliveryApproval.body.data.id}/delivery-feedback/${feedbackId}/withdraw`,
      )
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const repeatedFeedbackWithdrawal = await request(app)
      .patch(
        `/api/v1/approvals/${deliveryApproval.body.data.id}/delivery-feedback/${feedbackId}/withdraw`,
      )
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const decidedDeliveryQueue = await request(app)
      .get(`/api/v1/projects/${project.id}/delivery-reviews?decision=approved`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const deliveryHistoryForAnalyst = await request(app)
      .get(`/api/v1/approvals/artifact/risk/${deliveryArtifact.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    const deliveryHistoryForOwner = await request(app)
      .get(`/api/v1/approvals/artifact/risk/${deliveryArtifact.body.data.id}`)
      .set("Authorization", `Bearer ${productOwnerToken}`);
    const forbiddenBusinessHistory = await request(app)
      .get(`/api/v1/approvals/artifact/story/${businessArtifact.body.data.id}`)
      .set("Authorization", `Bearer ${deliveryLeadToken}`);
    const approvalAfterFeedback = await request(app)
      .get(`/api/v1/approvals/${deliveryApproval.body.data.id}`)
      .set("Authorization", `Bearer ${productOwnerToken}`);
    const ownerArtifactVersions = await request(app)
      .get(
        `/api/v1/artifacts/${deliveryArtifact.body.data.id}/versions?type=risk`,
      )
      .set("Authorization", `Bearer ${productOwnerToken}`);
    const leadArtifactVersions = await request(app)
      .get(
        `/api/v1/artifacts/${businessArtifact.body.data.id}/versions?type=story`,
      )
      .set("Authorization", `Bearer ${deliveryLeadToken}`);

    expect(membership.status).toBe(200);
    expect(requirement.status).toBe(201);
    expect(businessArtifact.status).toBe(201);
    expect(deliveryArtifact.status).toBe(201);
    expect(businessArtifactsForOwner.body.data.items).toEqual([
      expect.objectContaining({ type: "story" }),
    ]);
    expect(deliveryArtifactsForLead.body.data.items).toEqual([
      expect.objectContaining({ type: "risk" }),
    ]);
    expect(deliveryRequirements.status).toBe(403);
    expect(deliveryDocuments.status).toBe(403);
    expect(deliveryApproval.status).toBe(201);
    expect(deliveryQueue.status).toBe(200);
    expect(deliveryQueue.body.data.items).toEqual([
      expect.objectContaining({
        approval: expect.objectContaining({
          id: deliveryApproval.body.data.id,
        }),
        resource: expect.objectContaining({
          id: deliveryArtifact.body.data.id,
          type: "risk",
        }),
      }),
    ]);
    expect(analystQueue.status).toBe(403);
    expect(deliveryApprovalDetail.status).toBe(403);
    expect(deliveryDecision.status).toBe(403);
    expect(feedback.status).toBe(200);
    expect(productOwnerDecision.status).toBe(200);
    expect(feedbackAfterDecision.status).toBe(200);
    expect(forbiddenFeedbackWithdrawal.status).toBe(403);
    expect(withdrawnFeedback.status).toBe(200);
    expect(repeatedFeedbackWithdrawal.status).toBe(409);
    expect(forbiddenBusinessHistory.status).toBe(403);
    expect(decidedDeliveryQueue.body.data.items).toEqual([
      expect.objectContaining({
        approval: expect.objectContaining({
          id: deliveryApproval.body.data.id,
          decision: "approved",
        }),
      }),
    ]);
    for (const history of [
      deliveryHistoryForAnalyst,
      deliveryHistoryForOwner,
    ]) {
      expect(history.status).toBe(200);
      expect(history.body.data.items).toEqual([
        expect.objectContaining({
          reviewerComments: "The risk is acceptable with mitigation.",
          deliveryFeedback: [
            expect.objectContaining({
              id: feedbackId,
              comments: "Schedule a feasibility review.",
              withdrawnByUserId: deliveryLead.id,
            }),
            expect.objectContaining({
              comments: "Monitor this risk during rollout.",
            }),
          ],
        }),
      ]);
    }
    expect(approvalAfterFeedback.body.data.approval).toMatchObject({
      decision: "approved",
      reviewerComments: "The risk is acceptable with mitigation.",
      deliveryFeedback: [
        expect.objectContaining({
          reviewerUserId: deliveryLead.id,
          comments: "Schedule a feasibility review.",
        }),
        expect.objectContaining({
          reviewerUserId: deliveryLead.id,
          comments: "Monitor this risk during rollout.",
        }),
      ],
    });
    expect(ownerArtifactVersions.status).toBe(403);
    expect(leadArtifactVersions.status).toBe(403);
  });

  it("manages typed templates and exports the full audit log as JSON and CSV", async () => {
    const admin = await registerUser("template-admin@example.com");
    await storage.updateUserRoles(admin.id, ["admin"]);
    const token = await login("template-admin@example.com");
    const created = await request(app)
      .post("/api/v1/admin/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "project_intake",
        name: "Product discovery",
        description: "Guidance for project intake",
        instructions: "Capture users, outcomes, and constraints.",
      });

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("active");
    const projectOwner = await registerUser(
      "template-project-owner@example.com",
    );
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${projectOwner.token}`)
      .send({
        name: "Templated project",
        intakeTemplateId: created.body.data.id,
      });
    expect(project.status).toBe(201);
    expect(project.body.data.intakeTemplateId).toBe(created.body.data.id);

    const deactivated = await request(app)
      .patch(`/api/v1/admin/templates/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });
    const inactiveIntakeProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${projectOwner.token}`)
      .send({
        name: "Should not use inactive template",
        intakeTemplateId: created.body.data.id,
      });
    const availableTemplates = await request(app)
      .get("/api/v1/templates?type=project_intake")
      .set("Authorization", `Bearer ${token}`);
    const jsonExport = await request(app)
      .get("/api/v1/admin/audit-events/export?format=json")
      .set("Authorization", `Bearer ${token}`);
    const csvExport = await request(app)
      .get("/api/v1/admin/audit-events/export?format=csv")
      .set("Authorization", `Bearer ${token}`);

    expect(deactivated.status).toBe(200);
    expect(inactiveIntakeProject.status).toBe(400);
    expect(availableTemplates.body.data).toEqual([]);
    expect(jsonExport.headers["content-disposition"]).toContain(
      "audit-events.json",
    );
    expect(
      jsonExport.body.map((event: { action: string }) => event.action),
    ).toEqual(
      expect.arrayContaining([
        "template.created",
        "template.deactivated",
        "audit.exported",
      ]),
    );
    expect(csvExport.headers["content-type"]).toContain("text/csv");
    expect(csvExport.text).toContain("audit.exported");
  });

  it("supports role assignment, project membership, requirement versions, and approval transitions", async () => {
    const firstAdmin = await registerUser("initial-admin@example.com");
    await storage.updateUserRoles(firstAdmin.id, ["admin"]);
    const adminLogin = await login("initial-admin@example.com");
    const owner = await registerUser("approver-owner@example.com");
    const reviewer = await registerUser("reviewer@example.com");
    const regularMember = await registerUser("regular-member@example.com");

    const roleUpdate = await request(app)
      .patch(`/api/v1/users/${reviewer.id}/roles`)
      .set("Authorization", `Bearer ${adminLogin}`)
      .send({ roles: ["business_analyst", "product_owner"] });
    await request(app)
      .patch(`/api/v1/users/${owner.id}/roles`)
      .set("Authorization", `Bearer ${adminLogin}`)
      .send({ roles: ["business_analyst", "product_owner"] });
    const ownerReviewerLogin = await login("approver-owner@example.com");
    const staleOwnerSession = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(staleOwnerSession.status).toBe(401);
    owner.token = ownerReviewerLogin;
    const reviewerLogin = await login("reviewer@example.com");
    const project = await createProject(owner.token);
    const members = await request(app)
      .patch(`/api/v1/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ memberIds: [reviewer.id, regularMember.id] });
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Business requirement", type: "business" });
    const artifact = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        type: "story",
        title: "User story",
        requirementIds: [requirement.body.data.id],
      });
    const artifactEdit = await request(app)
      .patch(`/api/v1/artifacts/${artifact.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Revised user story",
        data: { acceptanceNote: "reviewed" },
      });
    const otherProject = await createProject(owner.token);
    const foreignRequirement = await request(app)
      .post(`/api/v1/projects/${otherProject.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Foreign requirement", type: "business" });
    const invalidArtifactEdit = await request(app)
      .patch(`/api/v1/artifacts/${artifact.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ requirementIds: [foreignRequirement.body.data.id] });
    const edit = await request(app)
      .patch(`/api/v1/requirements/${requirement.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ description: "Approved description" });
    const versions = await request(app)
      .get(`/api/v1/requirements/${requirement.body.data.id}/versions`)
      .set("Authorization", `Bearer ${owner.token}`);
    const approval = await request(app)
      .post("/api/v1/approvals")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        projectId: project.id,
        artifactType: "requirement",
        artifactId: requirement.body.data.id,
      });
    expect(approval.status).toBe(201);
    const approvalQueue = await request(app)
      .get(
        `/api/v1/projects/${project.id}/approvals?decision=pending&page=1&limit=1`,
      )
      .set("Authorization", `Bearer ${reviewerLogin}`);
    const approvalDetail = await request(app)
      .get(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`);
    const unauthorizedApprovalQueue = await request(app)
      .get(`/api/v1/projects/${project.id}/approvals`)
      .set("Authorization", `Bearer ${regularMember.token}`);
    const inaccessibleApprovalQueue = await request(app)
      .get(`/api/v1/projects/${otherProject.id}/approvals`)
      .set("Authorization", `Bearer ${reviewerLogin}`);
    const invalidApprovalFilter = await request(app)
      .get(`/api/v1/projects/${project.id}/approvals?decision=waiting`)
      .set("Authorization", `Bearer ${reviewerLogin}`);
    const unauthorizedApprovalDetail = await request(app)
      .get(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${regularMember.token}`);
    const ownReview = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${ownerReviewerLogin}`)
      .send({ decision: "approved" });
    const unauthorizedReview = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${regularMember.token}`)
      .send({ decision: "approved" });
    const decision = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`)
      .send({ decision: "approved", comments: "Reviewed." });
    const requirementReviewHistory = await request(app)
      .get(`/api/v1/approvals/artifact/requirement/${requirement.body.data.id}`)
      .set("Authorization", `Bearer ${regularMember.token}`);
    const approvedQueue = await request(app)
      .get(`/api/v1/projects/${project.id}/approvals?decision=approved`)
      .set("Authorization", `Bearer ${reviewerLogin}`);
    const duplicateDecision = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`)
      .send({ decision: "rejected" });
    const artifactApproval = await request(app)
      .post("/api/v1/approvals")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        projectId: project.id,
        artifactType: "story",
        artifactId: artifact.body.data.id,
        comments: "Please review the customer value.",
      });
    const artifactApprovalDetail = await request(app)
      .get(`/api/v1/approvals/${artifactApproval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`);
    const duplicateArtifactApproval = await request(app)
      .post("/api/v1/approvals")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        projectId: project.id,
        artifactType: "story",
        artifactId: artifact.body.data.id,
      });
    const editWhilePending = await request(app)
      .patch(`/api/v1/artifacts/${artifact.body.data.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Changed after submission" });
    const artifactDecision = await request(app)
      .patch(`/api/v1/approvals/${artifactApproval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`)
      .send({
        decision: "changes_requested",
        reviewerComments: "Clarify the outcome.",
      });
    const storyReviewHistory = await request(app)
      .get(`/api/v1/approvals/artifact/story/${artifact.body.data.id}`)
      .set("Authorization", `Bearer ${regularMember.token}`);
    const implementationPlan = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "implementation_plan", title: "Rollout plan" });
    const implementationPlanFilter = await request(app)
      .get(`/api/v1/projects/${project.id}/artifacts?type=implementation_plan`)
      .set("Authorization", `Bearer ${owner.token}`);
    const updatedRequirements = await request(app)
      .get(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`);
    const updatedArtifacts = await request(app)
      .get(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`);
    const artifactVersions = await request(app)
      .get(`/api/v1/artifacts/${artifact.body.data.id}/versions?type=story`)
      .set("Authorization", `Bearer ${owner.token}`);
    const projectExport = await request(app)
      .get(`/api/v1/projects/${project.id}/export?format=json`)
      .set("Authorization", `Bearer ${owner.token}`);
    const markdownExport = await request(app)
      .get(`/api/v1/projects/${project.id}/export?format=markdown`)
      .set("Authorization", `Bearer ${owner.token}`);
    const csvProjectExport = await request(app)
      .get(`/api/v1/projects/${project.id}/export?format=csv`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(roleUpdate.status).toBe(200);
    expect(members.body.data.members).toContain(reviewer.id);
    expect(members.body.data.members).toContain(regularMember.id);
    expect(artifact.status).toBe(201);
    expect(artifactEdit.status).toBe(200);
    expect(artifactEdit.body.data).toMatchObject({
      title: "Revised user story",
      status: "draft",
      version: 2,
    });
    expect(invalidArtifactEdit.status).toBe(400);
    expect(edit.body.data.version).toBe(2);
    expect(versions.body.data).toHaveLength(1);
    expect(approvalQueue.status).toBe(200);
    expect(approvalQueue.body.data).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
      items: [{ id: approval.body.data.id, decision: "pending" }],
    });
    expect(approvalDetail.status).toBe(200);
    expect(approvalDetail.body.data).toMatchObject({
      approval: { id: approval.body.data.id },
      resource: {
        id: requirement.body.data.id,
        title: "Business requirement",
        status: "submitted",
      },
    });
    expect(unauthorizedApprovalQueue.status).toBe(403);
    expect(inaccessibleApprovalQueue.status).toBe(404);
    expect(invalidApprovalFilter.status).toBe(400);
    expect(unauthorizedApprovalDetail.status).toBe(403);
    expect(ownReview.status).toBe(403);
    expect(unauthorizedReview.status).toBe(403);
    expect(decision.status).toBe(200);
    expect(approvedQueue.body.data).toMatchObject({
      total: 1,
      items: [{ id: approval.body.data.id, decision: "approved" }],
    });
    expect(decision.body.data.decision).toBe("approved");
    expect(decision.body.data).toMatchObject({
      reviewerUserId: reviewer.id,
      comments: "",
      reviewerComments: "Reviewed.",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(requirementReviewHistory.body.data.items).toEqual([
      expect.objectContaining({
        comments: "",
        reviewerComments: "Reviewed.",
      }),
    ]);
    expect(duplicateDecision.status).toBe(409);
    expect(artifactDecision.status).toBe(200);
    expect(storyReviewHistory.body.data.items).toEqual([
      expect.objectContaining({
        comments: "Please review the customer value.",
        reviewerComments: "Clarify the outcome.",
      }),
    ]);
    expect(implementationPlan.status).toBe(201);
    expect(implementationPlanFilter.body.data.items).toEqual([
      expect.objectContaining({
        id: implementationPlan.body.data.id,
        type: "implementation_plan",
      }),
    ]);
    expect(artifactApprovalDetail.status).toBe(200);
    expect(artifactApprovalDetail.body.data.resource).toMatchObject({
      id: artifact.body.data.id,
      type: "story",
      title: "Revised user story",
    });
    expect(duplicateArtifactApproval.status).toBe(409);
    expect(editWhilePending.status).toBe(409);
    expect(updatedRequirements.body.data.items[0]).toMatchObject({
      status: "approved",
      version: 3,
    });
    expect(updatedArtifacts.body.data.items[0]).toMatchObject({
      status: "changes_requested",
      version: 3,
    });
    expect(artifactVersions.body.data).toHaveLength(2);
    expect(artifactVersions.body.data[0]).toMatchObject({
      version: 1,
      actorUserId: owner.id,
      reason: "Artifact edited",
      snapshot: { title: "User story", version: 1 },
    });
    expect(artifactVersions.body.data[1]).toMatchObject({
      version: 2,
      actorUserId: reviewer.id,
      reason: "Approval decision: changes_requested",
      snapshot: { title: "Revised user story", version: 2 },
    });
    expect(projectExport.body.artifacts[0]).toMatchObject({
      status: "changes_requested",
    });
    expect(projectExport.body.requirements[0]).toMatchObject({
      status: "approved",
    });
    expect(markdownExport.text).toContain(
      "| story | Revised user story | changes_requested |",
    );
    expect(markdownExport.text).toContain(
      "| requirement | Business requirement | approved |",
    );
    expect(csvProjectExport.text).toContain(
      '"story","' +
        artifact.body.data.id +
        '","Revised user story","changes_requested"',
    );
    expect(csvProjectExport.text).toContain(
      '"requirement","' +
        requirement.body.data.id +
        '","Business requirement","approved"',
    );
  });

  it("requires authentication and reports an unconfigured AI provider for workflow submissions", async () => {
    const user = await registerUser("workflow@example.com");
    const project = await createProject(user.token);
    const unauthenticated = await request(app)
      .post("/api/v1/requirements/analyze")
      .send({ projectId: project.id });
    const response = await request(app)
      .post("/api/v1/requirements/analyze")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ projectId: project.id });

    expect(unauthenticated.status).toBe(401);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("AI_PROVIDER_NOT_CONFIGURED");
  });

  it("limits workflow submissions per client IP", async () => {
    const user = await registerUser("workflow-rate-limit@example.com");
    const project = await createProject(user.token);
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/requirements/analyze")
        .set("Authorization", `Bearer ${user.token}`)
        .send({ projectId: project.id });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10).every((status) => status === 503)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("documents runtime success responses for representative API routes in OpenAPI", async () => {
    const live = await request(app).get("/api/v1/health/live");
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "openapi@example.com", password: "a-long-test-password" });
    await storage.updateUserRoles(registration.body.data.user.id, [
      "business_analyst",
    ]);
    const token = await login("openapi@example.com");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "OpenAPI contract project" });
    const projectId = project.body.data.id as string;
    const artifact = await request(app)
      .post(`/api/v1/projects/${projectId}/artifacts`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "story", title: "Contract story" });
    const artifactId = artifact.body.data.id as string;
    const projectEdit = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ businessObjective: "Revised project objective." });
    const artifactEdit = await request(app)
      .patch(`/api/v1/artifacts/${artifactId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Updated from the API contract test." });
    const projectExport = await request(app)
      .get(`/api/v1/projects/${projectId}/export?format=json`)
      .set("Authorization", `Bearer ${token}`);

    expect(openApiDocument.paths["/health/live"].get.responses).toHaveProperty(
      String(live.status),
    );
    expect(
      openApiDocument.paths["/auth/register"].post.responses,
    ).toHaveProperty(String(registration.status));
    expect(openApiDocument.paths["/projects"].post.responses).toHaveProperty(
      String(project.status),
    );
    expect(projectEdit.status).toBe(200);
    expect(
      openApiDocument.paths["/projects/{id}"].patch.responses,
    ).toHaveProperty(String(projectEdit.status));
    expect(
      openApiDocument.paths["/projects/{id}/artifacts"].post.responses,
    ).toHaveProperty(String(artifact.status));
    expect(
      openApiDocument.paths["/artifacts/{id}"].patch.responses,
    ).toHaveProperty(String(artifactEdit.status));
    expect(
      openApiDocument.paths["/projects/{id}/export"].get.responses,
    ).toHaveProperty(String(projectExport.status));
    expect(
      openApiDocument.paths["/admin/users/invitations"].post,
    ).toBeDefined();
    expect(openApiDocument.paths["/admin/project-access"].get).toBeDefined();
    expect(
      openApiDocument.paths["/admin/project-access/{id}/members"].get,
    ).toBeDefined();
    expect(
      openApiDocument.paths["/admin/project-access/{id}/members"].post,
    ).toBeDefined();
    expect(
      openApiDocument.paths["/admin/project-access/{id}/members"].put,
    ).toBeDefined();
    expect(
      openApiDocument.paths["/admin/project-access/{id}/members/{memberId}"]
        .delete,
    ).toBeDefined();
    expect(
      openApiDocument.paths["/projects/{projectId}/delivery-reviews"].get,
    ).toBeDefined();
    expect(
      openApiDocument.paths["/approvals/{id}/delivery-feedback"].post,
    ).toBeDefined();
    expect(
      openApiDocument.paths["/approvals/artifact/{type}/{artifactId}"].get,
    ).toBeDefined();
  });
});

async function registerUser(
  email: string,
): Promise<{ id: string; token: string }> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "a-long-test-password" });
  const id = response.body.data.user.id as string;
  const user = await storage.updateUserRoles(id, ["business_analyst"]);
  if (!user) throw new Error("Registered test user could not be found.");
  return {
    id,
    token: createTestToken(user),
  };
}

async function registerPendingUser(
  email: string,
): Promise<{ id: string; token: string }> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "a-long-test-password" });
  return {
    id: response.body.data.user.id,
    token: response.body.data.accessToken,
  };
}

async function login(email: string): Promise<string> {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: "a-long-test-password" });
  return response.body.data.accessToken as string;
}

function createTestToken(
  user: UserRecord,
  expiresInSeconds = config.jwtTtlSeconds,
): string {
  return sign(
    {
      email: user.email,
      roles: user.roles,
      sessionVersion: user.sessionVersion ?? 0,
    },
    config.jwtSecret,
    { subject: user.id, expiresIn: expiresInSeconds },
  );
}

async function createProject(token: string): Promise<{ id: string }> {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test project" });
  if (response.status !== 201 || typeof response.body.data?.id !== "string") {
    throw new Error(
      `Test project creation failed: ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.data as { id: string };
}
