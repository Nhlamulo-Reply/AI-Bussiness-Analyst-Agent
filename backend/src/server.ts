import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { JsonFileStorage } from "./config/storage";
import { createLogger } from "./config/logger";

export async function startServer(): Promise<{
  close: () => Promise<void>;
  port: number;
}> {
  const config = loadConfig();
  const logger = createLogger(config);
  const storage = new JsonFileStorage(config);

  try {
    await storage.connect();
  } catch (error) {
    logger.fatal({
      errorName: error instanceof Error ? error.name : "UnknownError"
    }, "JSON storage initialization failed; server startup aborted");
    throw error;
  }

  const app = createApp({ config, storage, users: storage, logger });
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, () => {
      server.removeListener("error", reject);
      resolve();
    });
  }).catch(async (error: unknown) => {
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
          void storage.close().then(resolve, reject);
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
      console.error("Backend startup failed; check the configuration and JSON storage file access.");
    }
    process.exitCode = 1;
  });
}
