import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { RequireAuth, RequireRole } from "./AuthGuards";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["user"],
};

function GuardTestApp({ initialEntry }: { initialEntry: string }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<p>Sign-in page</p>} />
          <Route path="/app" element={<p>Workspace overview</p>} />
          <Route
            path="/app/projects/:projectId/approvals"
            element={
              <RequireAuth>
                <RequireRole roles={["reviewer", "admin"]}>
                  <p>Approval workspace</p>
                </RequireRole>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("authentication route guards", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("redirects unauthenticated users from protected routes to sign in", async () => {
    render(<GuardTestApp initialEntry="/app/projects/project-1/approvals" />);

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("shows a clear forbidden state for an authenticated non-reviewer", async () => {
    setSession({ accessToken: "user-token", user });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: { user },
          requestId: "request-5",
        }),
      ),
    );

    render(<GuardTestApp initialEntry="/app/projects/project-1/approvals" />);

    expect(
      await screen.findByText("You don't have access to this area."),
    ).toBeInTheDocument();
  });

  it("allows an authenticated reviewer to enter the restricted route", async () => {
    const reviewer: AuthUser = { ...user, roles: ["reviewer"] };
    setSession({ accessToken: "reviewer-token", user: reviewer });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: { user: reviewer },
          requestId: "request-6",
        }),
      ),
    );

    render(<GuardTestApp initialEntry="/app/projects/project-1/approvals" />);

    expect(await screen.findByText("Approval workspace")).toBeInTheDocument();
  });
});
