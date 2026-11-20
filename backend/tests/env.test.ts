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
      jwtTtlSeconds: 900,
      llmProvider: "openai",
      openAiModel: "gpt-6-luna"
    });
  });

  it("loads the selected Groq provider and model", () => {
    expect(loadConfig({
      ...validEnvironment,
      LLM_PROVIDER: "groq",
      GROQ_API_KEY: "test-groq-key",
      GROQ_MODEL: "openai/gpt-oss-120b"
    })).toMatchObject({
      llmProvider: "groq",
      groqApiKey: "test-groq-key",
      groqModel: "openai/gpt-oss-120b"
    });
  });

  it("rejects unsafe or malformed environment configuration", () => {
    expect(() => loadConfig({ ...validEnvironment, JWT_SECRET: "weak" }))
      .toThrow("JWT_SECRET");
    expect(() => loadConfig({ ...validEnvironment, PORT: "70000" }))
      .toThrow("PORT");
  });
});
