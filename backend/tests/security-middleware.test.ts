import express from "express";
import { randomUUID } from "node:crypto";
import { sign } from "jsonwebtoken";
import request from "supertest";
import { errorHandler } from "../src/common/middleware/error-handler";
import { authenticate, requireRoles } from "../src/common/middleware/authentication";
import { requireProjectAccess } from "../src/common/middleware/project-access";

const secret = "a-secure-test-secret-with-at-least-32-characters";

function createToken(roles: Array<"business_analyst" | "product_owner" | "delivery_lead" | "admin">): string {
  return sign({ roles, email: "tester@example.com" }, secret, { subject: randomUUID(), expiresIn: 900 });
}

function findActiveUser(roles: Array<"business_analyst" | "product_owner" | "delivery_lead" | "admin"> = ["business_analyst"]) {
  return {
    findById: async (id: string) => ({
      id,
      email: "tester@example.com",
      passwordHash: "test-hash",
      sessionVersion: 0,
      roles,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  };
}

describe("authorization middleware", () => {
  it("denies authenticated users without the required role", async () => {
    const app = express();
    app.use((req, _response, next) => {
      req.id = "test-request";
      next();
    });
    app.get(
      "/admin",
      authenticate(secret, findActiveUser()),
      requireRoles("admin"),
      (_request, response) => response.sendStatus(204)
    );
    app.use(errorHandler);

    const response = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${createToken(["business_analyst"])}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("checks project ownership/membership after authentication", async () => {
    const app = express();
    const userCanAccessProject = jest.fn(async () => true);
    app.use((req, _response, next) => {
      req.id = "test-request";
      next();
    });
    app.get(
      "/projects/:id",
      authenticate(secret, findActiveUser()),
      requireProjectAccess({ userCanAccessProject }),
      (_request, response) => response.sendStatus(204)
    );
    app.use(errorHandler);

    const response = await request(app)
      .get(`/projects/${randomUUID()}`)
      .set("Authorization", `Bearer ${createToken(["business_analyst"])}`);

    expect(response.status).toBe(204);
    expect(userCanAccessProject).toHaveBeenCalledTimes(1);
  });

  it("conceals projects that the user cannot access", async () => {
    const app = express();
    app.use((req, _response, next) => {
      req.id = "test-request";
      next();
    });
    app.get(
      "/projects/:id",
      authenticate(secret, findActiveUser()),
      requireProjectAccess({ userCanAccessProject: async () => false }),
      (_request, response) => response.sendStatus(204)
    );
    app.use(errorHandler);

    const response = await request(app)
      .get(`/projects/${randomUUID()}`)
      .set("Authorization", `Bearer ${createToken(["business_analyst"])}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
