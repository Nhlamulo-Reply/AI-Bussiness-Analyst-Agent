import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "../../lib/api-client";
import { queryClient } from "../../lib/query-client";
import {
  clearSession,
  getSession,
  setSession,
  subscribeToSession,
} from "../../lib/auth-store";
import { authenticateUser } from "./auth-api";
import { getAuthErrorMessage } from "./auth-errors";
import { AuthContext, type AuthContextValue } from "./auth-context";
import {
  currentUserResponseSchema,
  type AuthSession,
  type Credentials,
} from "./auth.schemas";

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    subscribeToSession,
    getSession,
    getSession,
  );
  const previousAccessToken = useRef(session?.accessToken);
  const [isInitializing, setIsInitializing] = useState(Boolean(session));
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (previousAccessToken.current !== session?.accessToken) {
      queryClient.clear();
      previousAccessToken.current = session?.accessToken;
    }
  }, [session?.accessToken]);

  const retrySessionValidation = useCallback(async () => {
    const currentSession = getSession();
    if (!currentSession) {
      setInitializationError(null);
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setInitializationError(null);
    try {
      const currentUser = await requestCurrentUser(currentSession);
      if (getSession()?.accessToken === currentSession.accessToken) {
        setSession({ ...currentSession, user: currentUser });
      }
    } catch (error) {
      if (getSession()?.accessToken === currentSession.accessToken) {
        setInitializationError(getAuthErrorMessage(error));
      }
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession) return;

    let active = true;
    const controller = new AbortController();
    void requestCurrentUser(currentSession, controller.signal)
      .then((user) => {
        if (
          active &&
          getSession()?.accessToken === currentSession.accessToken
        ) {
          setSession({ ...currentSession, user });
        }
      })
      .catch((error: unknown) => {
        if (
          active &&
          getSession()?.accessToken === currentSession.accessToken
        ) {
          setInitializationError(getAuthErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const signIn = useCallback(async (credentials: Credentials) => {
    await authenticateUser("login", credentials);
    setInitializationError(null);
  }, []);

  const register = useCallback(async (credentials: Credentials) => {
    await authenticateUser("register", credentials);
    setInitializationError(null);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setInitializationError(null);
    setIsInitializing(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isInitializing,
      initializationError,
      signIn,
      register,
      signOut,
      retrySessionValidation,
    }),
    [
      initializationError,
      isInitializing,
      register,
      retrySessionValidation,
      session,
      signIn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function requestCurrentUser(session: AuthSession, signal?: AbortSignal) {
  const response = await apiRequest("/auth/me", {
    auth: "required",
    accessToken: session.accessToken,
    schema: currentUserResponseSchema,
    signal,
  });
  return response.user;
}
