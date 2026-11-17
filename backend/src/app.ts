import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import type { Logger } from "pino";
import type { AppConfig } from "./config/env";
import type { Storage } from "./config/storage";
import type { UserRepository } from "./modules/auth/user.repository";
import { createLogger } from "./config/logger";
import { AppError } from "./common/errors/app-error";
import { errorHandler, notFoundHandler } from "./common/middleware/error-handler";
import { createRequestId } from "./common/middleware/request-context";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createProjectRouter } from "./modules/projects/project.routes";
import { createRequirementRouter } from "./modules/requirements/requirement.routes";
import { createWorkflowPlaceholderRouter } from "./modules/workflows/workflow-placeholder.routes";
import { createApprovalRouter } from "./modules/approvals/approval.routes";
import { createUserRouter } from "./modules/users/user.routes";
import { createArtifactRouter } from "./modules/artifacts/artifact.routes";
import { openApiDocument } from "./docs/openapi";

export interface AppDependencies {
  config: AppConfig;
  storage: Storage;
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
      await dependencies.storage.ping();
      response.status(200).json({
        success: true,
        data: { status: "ready", storage: "json" },
        requestId: request.id
      });
    } catch {
      next(new AppError(503, "SERVICE_UNAVAILABLE", "The service is not ready."));
    }
  });

  app.use("/api/v1/auth", createAuthRouter(dependencies.users, dependencies.config));
  app.use("/api/v1/projects", createProjectRouter(dependencies.storage, dependencies.config.jwtSecret));
  app.use("/api/v1", createRequirementRouter(dependencies.storage, dependencies.config.jwtSecret));
  app.use("/api/v1", createWorkflowPlaceholderRouter(dependencies.storage, dependencies.config.jwtSecret));
  app.use("/api/v1/approvals", createApprovalRouter(dependencies.storage, dependencies.config.jwtSecret));
  app.use("/api/v1/users", createUserRouter(dependencies.storage, dependencies.config.jwtSecret));
  app.use("/api/v1/artifacts", createArtifactRouter(dependencies.storage, dependencies.config.jwtSecret));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
