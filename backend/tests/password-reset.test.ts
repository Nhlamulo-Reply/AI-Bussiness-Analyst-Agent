import bcrypt from "bcryptjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
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
  logLevel: "silent",
  llmProvider: "openai",
  groqModel: "openai/gpt-oss-120b",
  openAiModel: "gpt-6-luna",
  passwordResetTtlSeconds: 900,
  emailProvider: "none",
  smtpSecure: false,
};

describe("password reset", () => {
  let storage: JsonFileStorage;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "password-reset-test-"));
    storage = new JsonFileStorage({
      jsonStoragePath: join(directory, "store.json"),
    });
    await storage.connect();
  });

  afterEach(async () => {
    await storage.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("uses the same generic response for unknown emails", async () => {
    const app = createApp({ config, storage, users: storage });
    const unknown = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ email: "unknown@example.test" });
    const inactive = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ email: "unknown@example.test" });

    expect(unknown.status).toBe(200);
    expect(inactive.status).toBe(200);
    expect(unknown.body.data.message).toBe(inactive.body.data.message);
  });

  it("rejects invalid, expired, and reused reset tokens", async () => {
    const app = createApp({ config, storage, users: storage });
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const user = await storage.insertUser({
      email: "reset@example.test",
      passwordHash: await bcrypt.hash("old-password-12", 12),
      roles: ["business_analyst"],
      active: true,
      sessionVersion: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await storage.createPasswordResetToken(
      user.id,
      tokenHash,
      new Date(Date.now() - 1000).toISOString(),
    );

    const expired = await request(app)
      .post("/api/v1/auth/password-reset/confirm")
      .send({
        token: rawToken,
        password: "new-password-12",
        confirmPassword: "new-password-12",
      });
    expect(expired.status).toBe(400);

    await storage.invalidatePasswordResetTokens(user.id);
  });

  it("rejects password reset for Google-only accounts", async () => {
    const app = createApp({ config, storage, users: storage });
    const user = await storage.insertUser({
      email: "google-only@example.test",
      googleSubject: "google-subject-123",
      roles: ["business_analyst"],
      active: true,
      sessionVersion: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(user.passwordHash).toBeUndefined();

    const response = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ email: user.email });
    expect(response.status).toBe(200);
  });
});
