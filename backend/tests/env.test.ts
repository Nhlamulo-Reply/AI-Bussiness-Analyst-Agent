import { loadConfig } from "../src/config/env";

describe("loadConfig", () => {
  const validEnvironment = {
    JWT_SECRET: "a-secure-test-secret-with-at-least-32-characters",
  };

  it("loads defaults while requiring a strong JWT secret", () => {
    expect(loadConfig(validEnvironment)).toMatchObject({
      environment: "development",
      port: 3000,
      mongoUri: expect.any(String),
      mongoDatabase: expect.any(String),
      jsonStoragePath: "./data/ai-business-analyst.json",
      jwtTtlSeconds: 900,
      llmProvider: "openai",
      openAiModel: "gpt-6-luna",
      geminiModel: "gemini-4-hydrogen",
      inceptionModel: "mercury-3",
    });
  });

  it("loads the selected Groq provider and model", () => {
    expect(
      loadConfig({
        ...validEnvironment,
        LLM_PROVIDER: "groq",
        GROQ_API_KEY: "test-groq-key",
        GROQ_MODEL: "openai/gpt-oss-120b",
      }),
    ).toMatchObject({
      llmProvider: "groq",
      groqApiKey: "test-groq-key",
      groqModel: "openai/gpt-oss-120b",
    });
  });

  it("loads optional Gemini and Inception fallback credentials and model names", () => {
    expect(
      loadConfig({
        ...validEnvironment,
        GEMINI_API_KEY: "test-gemini-key",
        GEMINI_MODEL: "gemini-fallback-model",
        INCEPTION_API_KEY: "test-inception-key",
        INCEPTION_MODEL: "inception-fallback-model",
      }),
    ).toMatchObject({
      geminiApiKey: "test-gemini-key",
      geminiModel: "gemini-fallback-model",
      inceptionApiKey: "test-inception-key",
      inceptionModel: "inception-fallback-model",
    });
  });

  it("loads a configured MongoDB URI and database name", () => {
    expect(
      loadConfig({
        ...validEnvironment,
        MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net",
        MONGODB_DATABASE: "business_analyst",
      }),
    ).toMatchObject({
      mongoUri: "mongodb+srv://cluster.example.mongodb.net",
      mongoDatabase: "business_analyst",
    });
  });

  it("loads valid MongoDB DNS server overrides and rejects invalid addresses", () => {
    expect(
      loadConfig({
        ...validEnvironment,
        MONGODB_DNS_SERVERS: "1.1.1.1, 8.8.8.8",
      }).mongoDnsServers,
    ).toEqual(["1.1.1.1", "8.8.8.8"]);
    expect(() =>
      loadConfig({
        ...validEnvironment,
        MONGODB_DNS_SERVERS: "not-an-ip",
      }),
    ).toThrow("MONGODB_DNS_SERVERS");
  });

  it("accepts a sufficiently long optional first-admin bootstrap token", () => {
    const config = loadConfig({
      ...validEnvironment,
      ADMIN_BOOTSTRAP_TOKEN: "one-time-bootstrap-token-with-at-least-32-chars",
    });
    expect(config.adminBootstrapToken).toBe(
      "one-time-bootstrap-token-with-at-least-32-chars",
    );
    expect(() =>
      loadConfig({ ...validEnvironment, ADMIN_BOOTSTRAP_TOKEN: "short" }),
    ).toThrow("ADMIN_BOOTSTRAP_TOKEN");
  });

  it("rejects unsafe or malformed environment configuration", () => {
    expect(() =>
      loadConfig({ ...validEnvironment, JWT_SECRET: "weak" }),
    ).toThrow("JWT_SECRET");
    expect(() => loadConfig({ ...validEnvironment, PORT: "70000" })).toThrow(
      "PORT",
    );
  });
});
