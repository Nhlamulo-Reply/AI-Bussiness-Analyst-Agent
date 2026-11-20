import { apiRequest } from "../../lib/api-client";
import { setSession } from "../../lib/auth-store";
import {
  authResponseSchema,
  currentUserResponseSchema,
  type AuthSession,
  type Credentials,
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
