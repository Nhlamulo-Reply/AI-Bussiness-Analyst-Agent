import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "./auth.service";
import { AuthService } from "./auth.service";
import type { UserRepository } from "./user.repository";
import { authenticate } from "../../common/middleware/authentication";
import { validateBody } from "../../common/middleware/validation";

const credentialsSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(12).max(128)
}).strict();

export function createAuthRouter(users: UserRepository, config: AuthConfig): Router {
  const router = Router();
  const service = new AuthService(users, config);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many authentication attempts.",
          details: [],
          requestId: request.id
        }
      });
    }
  });

  router.post("/register", loginLimiter, validateBody(credentialsSchema), async (request, response, next) => {
    try {
      const result = await service.register(request.body.email, request.body.password);
      response.status(201).json({ success: true, data: result, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", loginLimiter, validateBody(credentialsSchema), async (request, response, next) => {
    try {
      const result = await service.login(request.body.email, request.body.password);
      response.status(200).json({ success: true, data: result, requestId: request.id });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authenticate(config.jwtSecret), (request, response) => {
    response.status(200).json({ success: true, data: { user: request.user }, requestId: request.id });
  });

  return router;
}
