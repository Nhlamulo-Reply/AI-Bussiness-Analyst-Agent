import { loadConfig } from "../src/config/env";

describe("loadConfig", () => {
  const validEnvironment = {
    JWT_SECRET: "a-secure-test-secret-with-at-least-32-characters"
  };

  it("loads defaults while requiring a JSON storage path and strong JWT secret", () => {
    expect(loadConfig(validEnvironment)).toMatchObject({
      environment: "development",
      port: 3000,
      jsonStoragePath: "./data/ai-business-analyst.json",
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
