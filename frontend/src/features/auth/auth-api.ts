import { apiRequest } from "../../lib/api-client";
import { setSession } from "../../lib/auth-store";
import {
  authResponseSchema,
  currentUserResponseSchema,
  type AuthSession,
  type Credentials,
  passwordResetResponseSchema,
} from "./auth.schemas";

export async function authenticateUser(
  mode: "login" | "register",
  credentials: Credentials,
): Promise<AuthSession> {
  const response = await apiRequest(`/auth/${mode}`, {
    method: "POST",
    json: credentials,
    schema: authResponseSchema,
  });

  const currentUser = await apiRequest("/auth/me", {
    auth: "required",
    accessToken: response.accessToken,
    schema: currentUserResponseSchema,
  });

  const session = {
    accessToken: response.accessToken,
    user: currentUser.user,
  };
  setSession(session);
  return session;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest("/auth/password-reset/request", {
    method: "POST",
    json: { email },
    schema: passwordResetResponseSchema,
  });
}

export async function confirmPasswordReset(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<void> {
  await apiRequest("/auth/password-reset/confirm", {
    method: "POST",
    json: { token, password, confirmPassword },
    schema: passwordResetResponseSchema,
  });
}
