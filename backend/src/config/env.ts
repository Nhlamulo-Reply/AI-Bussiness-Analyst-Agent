import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGO_URI: z.string().min(1).refine(
    (value) => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
    "Must be a MongoDB connection URI"
  ),
  MONGO_DATABASE: z.string().min(1),
  JWT_SECRET: z.string().min(32, "Must contain at least 32 characters"),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
});

export type AppConfig = {
  environment: "development" | "test" | "production";
  port: number;
  mongoUri: string;
  mongoDatabase: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
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
    mongoUri: parsed.data.MONGO_URI,
    mongoDatabase: parsed.data.MONGO_DATABASE,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtTtlSeconds: parsed.data.JWT_TTL_SECONDS,
    logLevel: parsed.data.LOG_LEVEL
  };
}
