import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { MongoDatabase } from "./config/database";
import { createLogger } from "./config/logger";

export async function startServer(): Promise<{
  close: () => Promise<void>;
  port: number;
}> {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = new MongoDatabase(config);

  try {
    await database.connect();
  } catch (error) {
    logger.fatal({
      errorName: error instanceof Error ? error.name : "UnknownError"
    }, "MongoDB connection failed; server startup aborted");
    throw error;
  }

  const app = createApp({ config, database, users: database, logger });
  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, () => {
      server.removeListener("error", reject);
      resolve();
    });
  }).catch(async (error: unknown) => {
    await database.close();
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
          void database.close().then(resolve, reject);
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
      console.error("Backend startup failed; check the configuration and MongoDB availability.");
    }
    process.exitCode = 1;
  });
}
