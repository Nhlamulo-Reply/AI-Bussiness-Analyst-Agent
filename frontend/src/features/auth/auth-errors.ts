import { ApiError } from "../../lib/api-client";

export function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "We couldn't complete that request. Please try again.";
  }

  if (error.code === "INVALID_CREDENTIALS") {
    return "The email or password is incorrect.";
  }
  if (error.code === "EMAIL_ALREADY_REGISTERED") {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (error.code === "RATE_LIMITED" || error.status === 429) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }
  if (error.code === "NETWORK_ERROR" || error.code === "REQUEST_TIMEOUT") {
    return "We couldn't reach the service. Check your connection and try again.";
  }
  if (error.code === "UNAUTHORIZED" || error.status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (error.code === "FORBIDDEN" || error.status === 403) {
    return "Your account doesn't have permission to do that.";
  }
  if (error.status >= 500) {
    return "The service is temporarily unavailable. Please try again.";
  }

  return error.message;
}
