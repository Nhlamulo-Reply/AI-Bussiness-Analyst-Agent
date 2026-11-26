import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { MongoStorage } from "./config/storage";
import { createLogger } from "./config/logger";
import { WorkflowService } from "./workflows/workflow-service";
import { createStructuredOutputProvider } from "./integrations/llm/structured-output-provider";

export async function startServer(): Promise<{
  close: () => Promise<void>;
  port: number;
}> {
  const config = loadConfig();
  const logger = createLogger(config);
  const storage = new MongoStorage(config);

  try {
    await storage.connect();
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
            .replaceAll(config.mongoUri, "[redacted MongoDB URI]")
            .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[redacted MongoDB URI]")
        : "Unknown MongoDB connection error";
    logger.fatal({
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage,
    }, "MongoDB storage initialization failed; server startup aborted");
    throw error;
  }

  const workflowService = new WorkflowService(
    storage,
    createStructuredOutputProvider(config, logger),
    logger
  );
  const app = createApp({ config, storage, users: storage, logger, workflowService });
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, () => {
      server.removeListener("error", reject);
      resolve();
    });
  }).catch(async (error: unknown) => {
    await workflowService.close();
    await storage.close();
    throw error;
  });

  logger.info({ port: config.port }, "HTTP server started");

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (!closing) {
      closing = new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          void workflowService.close().then(() => storage.close()).then(resolve, reject);
        });
      });
    }
    return closing;
  };

  process.once("SIGINT", () => {
    void close().catch((error: unknown) => logger.error({ err: error }, "Graceful shutdown failed"));
  });
  process.once("SIGTERM", () => {
    void close().catch((error: unknown) => logger.error({ err: error }, "Graceful shutdown failed"));
  });

  return { close, port: config.port };
}

if (require.main === module) {
  startServer().catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith("Invalid environment configuration:")) {
      console.error(error.message);
    } else {
      console.error("Backend startup failed; check the configuration and MongoDB connectivity.");
    }
    process.exitCode = 1;
  });
}
