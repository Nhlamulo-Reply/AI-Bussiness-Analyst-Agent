import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app";
import type { AppConfig } from "../src/config/env";
import type { AppDependencies } from "../src/app";
import type { UserRecord, UserRepository } from "../src/modules/auth/user.repository";

const config: AppConfig = {
  environment: "test",
  port: 3000,
  jsonStoragePath: "./data/test.json",
  jwtSecret: "a-secure-test-secret-with-at-least-32-characters",
  jwtTtlSeconds: 900,
  logLevel: "silent"
};

function createHarness(overrides: Partial<AppDependencies> = {}) {
  const records = new Map<string, UserRecord>();
  const users: UserRepository = {
    findByEmail: async (email) => records.get(email) ?? null,
    insertUser: async (user) => {
      const record = { ...user, id: randomUUID() };
      records.set(record.email, record);
      return record;
    }
  };
  const dependencies: AppDependencies = {
    config,
    storage: { ping: async () => undefined },
    users,
    ...overrides
  };
  return { app: createApp(dependencies), records };
}

describe("backend foundation", () => {
  it("returns live and ready health responses", async () => {
    const { app } = createHarness();
    const live = await request(app).get("/api/v1/health/live");
    const ready = await request(app).get("/api/v1/health/ready");

    expect(live.status).toBe(200);
    expect(live.body.data.status).toBe("ok");
    expect(live.headers["x-request-id"]).toBe(live.body.requestId);
    expect(ready.status).toBe(200);
    expect(ready.body.data.storage).toBe("json");
  });

  it("reports readiness failure without exposing storage errors", async () => {
    const { app } = createHarness({
      storage: { ping: async () => { throw new Error("private file path leaked"); } }
    });
    const response = await request(app).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("private file path leaked");
  });

  it("validates credentials and returns the standard error envelope", async () => {
    const { app } = createHarness();
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
    const { app } = createHarness();
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });

  it("registers standard users and authenticates them with a bearer token", async () => {
    const { app } = createHarness();
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
    const { app } = createHarness();
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
});
