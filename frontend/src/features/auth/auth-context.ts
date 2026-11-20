import { createContext } from "react";
import type { AuthSession, Credentials } from "./auth.schemas";

export interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  initializationError: string | null;
  signIn: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  signOut: () => void;
  retrySessionValidation: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
