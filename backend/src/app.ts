import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import type { Logger } from "pino";
import type { AppConfig } from "./config/env";
import type { Database } from "./config/database";
import type { UserRepository } from "./modules/auth/user.repository";
import { createLogger } from "./config/logger";
import { AppError } from "./common/errors/app-error";
import { errorHandler, notFoundHandler } from "./common/middleware/error-handler";
import { createRequestId } from "./common/middleware/request-context";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { openApiDocument } from "./docs/openapi";

export interface AppDependencies {
  config: AppConfig;
  database: Pick<Database, "ping">;
  users: UserRepository;
  logger?: Logger;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const logger = dependencies.logger ?? createLogger(dependencies.config);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({
    logger,
    genReqId: createRequestId,
    serializers: {
      req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      res: (response) => ({ statusCode: response.statusCode })
    }
  }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health/live", (request: Request, response: Response) => {
    response.status(200).json({
      success: true,
      data: { status: "ok" },
      requestId: request.id
    });
  });

  app.get("/api/v1/health/ready", async (request: Request, response: Response, next) => {
    try {
      await dependencies.database.ping();
      response.status(200).json({
        success: true,
        data: { status: "ready", database: "connected" },
        requestId: request.id
      });
    } catch {
      next(new AppError(503, "SERVICE_UNAVAILABLE", "The service is not ready."));
    }
  });

  app.use("/api/v1/auth", createAuthRouter(dependencies.users, dependencies.config));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
