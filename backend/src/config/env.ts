import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JSON_STORAGE_PATH: z.string().trim().min(1).default("./data/ai-business-analyst.json"),
  JWT_SECRET: z.string().min(32, "Must contain at least 32 characters"),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL: z.string().trim().min(1).max(100).default("gpt-6-luna")
});

export type AppConfig = {
  environment: "development" | "test" | "production";
  port: number;
  jsonStoragePath: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  openAiApiKey?: string;
  openAiModel: string;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    environment: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    jsonStoragePath: parsed.data.JSON_STORAGE_PATH,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtTtlSeconds: parsed.data.JWT_TTL_SECONDS,
    logLevel: parsed.data.LOG_LEVEL,
    openAiApiKey: parsed.data.OPENAI_API_KEY || undefined,
    openAiModel: parsed.data.OPENAI_MODEL
  };
}
