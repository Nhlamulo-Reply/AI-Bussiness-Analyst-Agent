import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app";
import type { AppConfig } from "../src/config/env";
import { JsonFileStorage } from "../src/config/storage";

const config: AppConfig = {
  environment: "test",
  port: 3000,
  jsonStoragePath: "./data/test.json",
  jwtSecret: "a-secure-test-secret-with-at-least-32-characters",
  jwtTtlSeconds: 900,
  logLevel: "silent"
};

let app: ReturnType<typeof createApp>;
let storage: JsonFileStorage;
let temporaryDirectory: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "business-analyst-api-"));
  storage = new JsonFileStorage({ jsonStoragePath: join(temporaryDirectory, "store.json") });
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
      error: { code: "VALIDATION_ERROR", requestId: "validation-test" }
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
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });

  it("registers standard users and authenticates them with a bearer token", async () => {
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: " Analyst@Example.com ", password: "a-long-test-password" });
    const token = registration.body.data.accessToken as string;
    const profile = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);

    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({ email: "analyst@example.com", roles: ["user"] });
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe("analyst@example.com");
    expect(profile.body.data.user.roles).toEqual(["user"]);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "analyst@example.com", password: "a-long-test-password" });
    const failedLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "analyst@example.com", password: "a-different-password" });

    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe(registration.body.data.user.id);
    expect(failedLogin.status).toBe(401);
    expect(failedLogin.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects unauthenticated and inaccessible project requests", async () => {
    const unauthenticated = await request(app).get("/api/v1/auth/me");
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "person@example.com", password: "a-long-test-password" });
    const token = registration.body.data.accessToken as string;
    const inaccessible = await request(app)
      .get(`/api/v1/projects/${randomUUID()}`)
      .set("Authorization", `Bearer ${token}`);

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
      .send({ name: "Requirements project" });
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
    expect(listResponse.body.data).toMatchObject({ page: 1, limit: 1, total: 1 });
    expect(invalidPage.status).toBe(400);
    expect(hiddenResponse.status).toBe(404);
  });

  it("validates uploads, redacts stored document contents, and excludes them from exports", async () => {
    const owner = await registerUser("documents@example.com");
    const project = await createProject(owner.token);
    const upload = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("%PDF-1.4\nsample"), { filename: "brief.pdf", contentType: "application/pdf" });
    const invalid = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.from("not a PDF"), { filename: "brief.pdf", contentType: "application/pdf" });
    const empty = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.alloc(0), { filename: "empty.txt", contentType: "text/plain" });
    const oversized = await request(app)
      .post(`/api/v1/projects/${project.id}/documents`)
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1, 0x61), { filename: "large.txt", contentType: "text/plain" });
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
    expect(exportResponse.text).not.toContain(Buffer.from("%PDF-1.4\nsample").toString("base64"));
    expect(csvExport.text).toContain('"\'=1+1"');
    expect(requirement.status).toBe(201);
  });

  it("supports role assignment, project membership, requirement versions, and approval transitions", async () => {
    const firstAdmin = await registerUser("initial-admin@example.com");
    await storage.updateUserRoles(firstAdmin.id, ["user", "admin"]);
    const adminLogin = await login("initial-admin@example.com");
    const owner = await registerUser("approver-owner@example.com");
    const reviewer = await registerUser("reviewer@example.com");

    const roleUpdate = await request(app)
      .patch(`/api/v1/users/${reviewer.id}/roles`)
      .set("Authorization", `Bearer ${adminLogin}`)
      .send({ roles: ["user", "reviewer"] });
    await request(app)
      .patch(`/api/v1/users/${owner.id}/roles`)
      .set("Authorization", `Bearer ${adminLogin}`)
      .send({ roles: ["user", "reviewer"] });
    const ownerReviewerLogin = await login("approver-owner@example.com");
    const reviewerLogin = await login("reviewer@example.com");
    const project = await createProject(owner.token);
    const members = await request(app)
      .patch(`/api/v1/projects/${project.id}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ memberIds: [reviewer.id] });
    const requirement = await request(app)
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Business requirement", type: "business" });
    const artifact = await request(app)
      .post(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ type: "story", title: "User story", requirementIds: [requirement.body.data.id] });
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
        artifactId: requirement.body.data.id
      });
    const ownReview = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${ownerReviewerLogin}`)
      .send({ decision: "approved" });
    const decision = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`)
      .send({ decision: "approved", comments: "Reviewed." });
    const duplicateDecision = await request(app)
      .patch(`/api/v1/approvals/${approval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`)
      .send({ decision: "rejected" });
    const artifactApproval = await request(app)
      .post("/api/v1/approvals")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ projectId: project.id, artifactType: "story", artifactId: artifact.body.data.id });
    const artifactDecision = await request(app)
      .patch(`/api/v1/approvals/${artifactApproval.body.data.id}`)
      .set("Authorization", `Bearer ${reviewerLogin}`)
      .send({ decision: "changes_requested", comments: "Clarify the outcome." });
    const updatedRequirements = await request(app)
      .get(`/api/v1/projects/${project.id}/requirements`)
      .set("Authorization", `Bearer ${owner.token}`);
    const updatedArtifacts = await request(app)
      .get(`/api/v1/projects/${project.id}/artifacts`)
      .set("Authorization", `Bearer ${owner.token}`);
    const artifactVersions = await request(app)
      .get(`/api/v1/artifacts/${artifact.body.data.id}/versions?type=story`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(roleUpdate.status).toBe(200);
    expect(members.body.data.members).toContain(reviewer.id);
    expect(artifact.status).toBe(201);
    expect(edit.body.data.version).toBe(2);
    expect(versions.body.data).toHaveLength(1);
    expect(ownReview.status).toBe(403);
    expect(decision.status).toBe(200);
    expect(decision.body.data.decision).toBe("approved");
    expect(duplicateDecision.status).toBe(409);
    expect(artifactDecision.status).toBe(200);
    expect(updatedRequirements.body.data.items[0]).toMatchObject({ status: "approved", version: 3 });
    expect(updatedArtifacts.body.data.items[0]).toMatchObject({ status: "draft", version: 2 });
    expect(artifactVersions.body.data).toHaveLength(1);
  });

  it("returns explicit not-implemented responses for Phase 5 workflows", async () => {
    const user = await registerUser("workflow@example.com");
    const project = await createProject(user.token);
    const response = await request(app)
      .post("/api/v1/requirements/analyze")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ projectId: project.id });

    expect(response.status).toBe(501);
    expect(response.body.error.code).toBe("NOT_IMPLEMENTED");
    expect(response.body.error.message).toContain("no results were generated");
  });
});

async function registerUser(email: string): Promise<{ id: string; token: string }> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password: "a-long-test-password" });
  return { id: response.body.data.user.id, token: response.body.data.accessToken };
}

async function login(email: string): Promise<string> {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: "a-long-test-password" });
  return response.body.data.accessToken as string;
}

async function createProject(token: string): Promise<{ id: string }> {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test project" });
  return response.body.data as { id: string };
}
