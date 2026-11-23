import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "./auth.service";
import { AuthService } from "./auth.service";
import type { UserRepository } from "./user.repository";
import { authenticate } from "../../common/middleware/authentication";
import { validateBody } from "../../common/middleware/validation";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { AppConfig } from "../../config/env";
import type { Storage } from "../../config/storage";
import { createEmailProvider } from "../../integrations/email/email-provider";
import { AppError } from "../../common/errors/app-error";
import { OAuth2Client } from "google-auth-library";

const credentialsSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(12).max(128)
}).strict();
const passwordResetRequestSchema = z.object({
  email: z.string().trim().pipe(z.email()),
}).strict();
const passwordResetSchema = z.object({
  token: z.string().min(32).max(512),
  password: z.string().min(12).max(128),
  confirmPassword: z.string().min(12).max(128),
}).strict().refine(
  (value) => value.password === value.confirmPassword,
  "Passwords do not match.",
);

export function createAuthRouter(
  users: UserRepository,
  config: AuthConfig & Partial<AppConfig>,
  sessionUsers: Pick<UserRepository, "findById"> = users,
  storage?: Storage,
): Router {
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

  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, resetResponse) => {
      resetResponse.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many password-reset attempts.",
        },
      });
    },
  });

  router.post(
    "/password-reset/request",
    resetLimiter,
    validateBody(passwordResetRequestSchema),
    async (request, resetResponse, next) => {
      try {
        if (!storage) {
          throw new Error("Password reset storage is unavailable.");
        }
        const email = request.body.email.trim().toLowerCase();
        const user = await users.findByEmail(email);
        if (user?.active && user.passwordHash) {
          const rawToken = randomBytes(32).toString("base64url");
          const tokenHash = createHash("sha256").update(rawToken).digest("hex");
          const ttl = config.passwordResetTtlSeconds ?? 900;
          const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
          await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);
          const frontendBase =
            config.passwordResetFrontendUrl ??
            "http://localhost:5173/reset-password";
          const resetUrl = `${frontendBase}?token=${encodeURIComponent(rawToken)}`;
          await createEmailProvider(config as AppConfig).sendPasswordReset(
            email,
            resetUrl,
          );
        }
        resetResponse.status(200).json({
          success: true,
          data: {
            message:
              "If an account exists for this email address, a password-reset link will be sent.",
          },
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/password-reset/confirm",
    resetLimiter,
    validateBody(passwordResetSchema),
    async (request, resetResponse, next) => {
      try {
        if (!storage) {
          throw new Error("Password reset storage is unavailable.");
        }
        const tokenHash = createHash("sha256")
          .update(request.body.token)
          .digest("hex");
        const passwordHash = await bcrypt.hash(request.body.password, 12);
        const result = await storage.consumePasswordResetToken(
          tokenHash,
          passwordHash,
        );
        if (result !== "consumed") {
          throw new AppError(
            400,
            "INVALID_PASSWORD_RESET_TOKEN",
            "The password-reset link is invalid or has expired.",
          );
        }
        resetResponse.status(200).json({
          success: true,
          data: { message: "Password reset successfully." },
          requestId: request.id,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/google", async (request, response, next) => {
    try {
      if (
        !storage ||
        !config.googleClientId ||
        !config.googleClientSecret ||
        !config.googleCallbackUrl
      ) {
        throw new AppError(
          503,
          "GOOGLE_AUTH_NOT_CONFIGURED",
          "Google authentication is not configured.",
        );
      }
      const state = randomBytes(32).toString("base64url");
      const nonce = randomBytes(32).toString("base64url");
      const stateHash = createHash("sha256").update(state).digest("hex");
      const nonceHash = createHash("sha256").update(nonce).digest("hex");
      await storage.createOAuthState(
        stateHash,
        nonceHash,
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      );
      const client = new OAuth2Client({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        redirectUri: config.googleCallbackUrl,
      });
      const authorizationUrl = client.generateAuthUrl({
        access_type: "offline",
        scope: ["openid", "email", "profile"],
        state,
        nonce,
        prompt: "select_account",
      });
      response.redirect(302, authorizationUrl);
    } catch (error) {
      next(error);
    }
  });

  router.get("/google/callback", async (request, response, next) => {
    try {
      if (
        !storage ||
        !config.googleClientId ||
        !config.googleClientSecret ||
        !config.googleCallbackUrl
      ) {
        throw new AppError(
          503,
          "GOOGLE_AUTH_NOT_CONFIGURED",
          "Google authentication is not configured.",
        );
      }
      const code = typeof request.query.code === "string"
        ? request.query.code
        : null;
      const state = typeof request.query.state === "string"
        ? request.query.state
        : null;
      if (!code || !state) {
        throw new AppError(
          400,
          "INVALID_GOOGLE_CALLBACK",
          "Google authentication response is incomplete.",
        );
      }
      const stateHash = createHash("sha256").update(state).digest("hex");
      const client = new OAuth2Client({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        redirectUri: config.googleCallbackUrl,
      });
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new AppError(
          401,
          "INVALID_GOOGLE_TOKEN",
          "Google did not return a valid ID token.",
        );
      }
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleClientId,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub ||
        !payload.email ||
        payload.email_verified !== true ||
        !payload.nonce
      ) {
        throw new AppError(
          401,
          "INVALID_GOOGLE_IDENTITY",
          "Google identity verification failed.",
        );
      }
      const nonceHash = createHash("sha256")
        .update(payload.nonce)
        .digest("hex");
      const storedNonceHash = await storage.getOAuthNonceHash(stateHash);
      if (
        !storedNonceHash ||
        !timingSafeEqual(
          Buffer.from(nonceHash, "hex"),
          Buffer.from(storedNonceHash, "hex"),
        ) ||
        !(await storage.consumeOAuthState(
          stateHash,
          payload.nonce,
        ))
      ) {
        throw new AppError(
          400,
          "INVALID_GOOGLE_STATE",
          "Google authentication state or nonce is invalid.",
        );
      }

      let user = await storage.findByGoogleSubject(payload.sub);
      if (!user) {
        const existingEmailUser = await users.findByEmail(
          payload.email.trim().toLowerCase(),
        );
        if (existingEmailUser) {
          throw new AppError(
            409,
            "ACCOUNT_LINK_REQUIRED",
            "An account exists for this email. Link Google authentication after signing in securely.",
          );
        }
        user = await users.insertUser({
          email: payload.email.trim().toLowerCase(),
          googleSubject: payload.sub,
          roles: ["business_analyst"],
          active: true,
          sessionVersion: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await storage.invalidatePasswordResetTokens(user.id);
      }
      if (!user.active) {
        throw new AppError(
          401,
          "ACCOUNT_INACTIVE",
          "This account is inactive.",
        );
      }
      await storage.recordGoogleLogin(user.id);
      const session = service.createSession({
        ...user,
        sessionVersion: user.sessionVersion ?? 0,
      });
      const frontendUrl =
        config.googleFrontendRedirectUrl ?? "http://localhost:5173/login";
      const redirectUrl = new URL(frontendUrl);
      redirectUrl.searchParams.set("accessToken", session.accessToken);
      response.redirect(302, redirectUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/me",
    authenticate(config.jwtSecret, sessionUsers),
    (request, response) => {
    response.status(200).json({ success: true, data: { user: request.user }, requestId: request.id });
    },
  );

  return router;
}
