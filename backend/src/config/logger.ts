import pino from "pino";
import type { AppConfig } from "./env";

export function createLogger(config: Pick<AppConfig, "environment" | "logLevel">): pino.Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: ["password", "passwordHash", "token", "authorization", "cookie", "apiKey", "openAiApiKey", "OPENAI_API_KEY", "*.password", "*.token", "*.apiKey"],
      censor: "[REDACTED]"
    }
  });
}
