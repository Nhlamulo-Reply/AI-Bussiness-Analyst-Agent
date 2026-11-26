import pino from "pino";
import type { AppConfig } from "./env";

export function createLogger(config: Pick<AppConfig, "environment" | "logLevel">): pino.Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: ["password", "passwordHash", "token", "authorization", "cookie", "apiKey", "openAiApiKey", "groqApiKey", "geminiApiKey", "inceptionApiKey", "OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "INCEPTION_API_KEY", "*.password", "*.token", "*.apiKey"],
      censor: "[REDACTED]"
    }
  });
}
