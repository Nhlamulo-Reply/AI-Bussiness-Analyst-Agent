import type { AuthSession } from "../features/auth/auth.schemas";

let session: AuthSession | null = null;
const listeners = new Set<() => void>();

export function getSession() {
  return session;
}

export function setSession(nextSession: AuthSession) {
  session = nextSession;
  notify();
}

export function clearSession() {
  if (!session) return;
  session = null;
  notify();
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}
