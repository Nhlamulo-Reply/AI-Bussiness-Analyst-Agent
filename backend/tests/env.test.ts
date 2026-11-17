import { loadConfig } from "../src/config/env";

describe("loadConfig", () => {
  const validEnvironment = {
    MONGO_URI: "mongodb://127.0.0.1:27017/test",
    MONGO_DATABASE: "test",
    JWT_SECRET: "a-secure-test-secret-with-at-least-32-characters"
  };

  it("loads defaults while requiring MongoDB and a strong JWT secret", () => {
    expect(loadConfig(validEnvironment)).toMatchObject({
      environment: "development",
      port: 3000,
      jwtTtlSeconds: 900
    });
  });

  it("rejects unsafe or malformed environment configuration", () => {
    expect(() => loadConfig({ ...validEnvironment, JWT_SECRET: "weak" }))
      .toThrow("JWT_SECRET");
    expect(() => loadConfig({ ...validEnvironment, PORT: "70000" }))
      .toThrow("PORT");
  });
});
