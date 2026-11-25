import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JSON_STORAGE_PATH: z
    .string()
    .trim()
    .min(1)
    .default("./data/ai-business-analyst.json"),
  JWT_SECRET: z.string().min(32, "Must contain at least 32 characters"),
  ADMIN_BOOTSTRAP_TOKEN: z.string().trim().min(32).max(256).optional(),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  LLM_PROVIDER: z.enum(["openai", "groq"]).default("openai"),
  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL: z.string().trim().min(1).max(100).default("gpt-6-luna"),
  GROQ_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z.string().trim().min(1).max(100).default("openai/gpt-oss-120b"),
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().min(1).max(100).default("gemini-4-hydrogen"),
  INCEPTION_API_KEY: z.string().trim().optional(),
  INCEPTION_MODEL: z.string().trim().min(1).max(100).default("mercury-3"),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(900),
  PASSWORD_RESET_FRONTEND_URL: z.string().trim().optional(),
  EMAIL_PROVIDER: z.enum(["none", "smtp"]).default("none"),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().trim().email().optional(),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  GOOGLE_CALLBACK_URL: z.string().trim().optional(),
  GOOGLE_FRONTEND_REDIRECT_URL: z.string().trim().optional(),
});

export type AppConfig = {
  environment: "development" | "test" | "production";
  port: number;
  jsonStoragePath: string;
  jwtSecret: string;
  adminBootstrapToken?: string;
  jwtTtlSeconds: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  llmProvider: "openai" | "groq";
  openAiApiKey?: string;
  openAiModel: string;
  groqApiKey?: string;
  groqModel: string;
  geminiApiKey?: string;
  geminiModel: string;
  inceptionApiKey?: string;
  inceptionModel: string;
  passwordResetTtlSeconds: number;
  passwordResetFrontendUrl?: string;
  emailProvider: "none" | "smtp";
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string;
  emailFrom?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleCallbackUrl?: string;
  googleFrontendRedirectUrl?: string;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    environment: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    jsonStoragePath: parsed.data.JSON_STORAGE_PATH,
    jwtSecret: parsed.data.JWT_SECRET,
    adminBootstrapToken: parsed.data.ADMIN_BOOTSTRAP_TOKEN,
    jwtTtlSeconds: parsed.data.JWT_TTL_SECONDS,
    logLevel: parsed.data.LOG_LEVEL,
    llmProvider: parsed.data.LLM_PROVIDER,
    openAiApiKey: parsed.data.OPENAI_API_KEY || undefined,
    openAiModel: parsed.data.OPENAI_MODEL,
    groqApiKey: parsed.data.GROQ_API_KEY || undefined,
    groqModel: parsed.data.GROQ_MODEL,
    geminiApiKey: parsed.data.GEMINI_API_KEY || undefined,
    geminiModel: parsed.data.GEMINI_MODEL,
    inceptionApiKey: parsed.data.INCEPTION_API_KEY || undefined,
    inceptionModel: parsed.data.INCEPTION_MODEL,
    passwordResetTtlSeconds: parsed.data.PASSWORD_RESET_TTL_SECONDS,
    passwordResetFrontendUrl: parsed.data.PASSWORD_RESET_FRONTEND_URL,
    emailProvider: parsed.data.EMAIL_PROVIDER,
    smtpHost: parsed.data.SMTP_HOST,
    smtpPort: parsed.data.SMTP_PORT,
    smtpSecure: parsed.data.SMTP_SECURE === "true",
    smtpUser: parsed.data.SMTP_USER,
    smtpPass: parsed.data.SMTP_PASS,
    emailFrom: parsed.data.EMAIL_FROM,
    googleClientId: parsed.data.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: parsed.data.GOOGLE_CALLBACK_URL,
    googleFrontendRedirectUrl: parsed.data.GOOGLE_FRONTEND_REDIRECT_URL,
  };
}
