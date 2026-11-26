import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { RequireAuth, RequireRole } from "./AuthGuards";
import { PendingAccessPage } from "../pages/PendingAccessPage";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

function GuardTestApp({ initialEntry }: { initialEntry: string }) {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<SignInPage />} />
          <Route
            path="/pending-access"
            element={
              <RequireAuth allowUnassignedRoles>
                <PendingAccessPage />
              </RequireAuth>
            }
          />
          <Route path="/app" element={<p>Workspace overview</p>} />
          <Route
            path="/app/projects/:projectId/approvals"
            element={
              <RequireAuth>
                <RequireRole roles={["product_owner", "admin"]}>
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

function SignInPage() {
  const location = useLocation();
  const state = location.state as { from?: { search?: string } } | null;
  return (
    <>
      <p>Sign-in page</p>
      <p data-testid="return-search">{state?.from?.search ?? ""}</p>
    </>
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

  it("preserves email deep-link queries through the sign-in redirect", async () => {
    render(
      <GuardTestApp
        initialEntry="/app/projects/project-1/approvals?approvalId=approval-1"
      />,
    );

    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
    expect(screen.getByTestId("return-search")).toHaveTextContent(
      "?approvalId=approval-1",
    );
  });

  it("shows a clear forbidden state for an authenticated non-Product-Owner", async () => {
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

  it("redirects signed-in users without assigned roles to pending access", async () => {
    const userActions = userEvent.setup();
    const pendingUser: AuthUser = { ...user, roles: [] };
    setSession({ accessToken: "pending-token", user: pendingUser });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: { user: pendingUser },
          requestId: "request-pending",
        }),
      ),
    );

    render(<GuardTestApp initialEntry="/app/projects/project-1/approvals" />);

    expect(
      await screen.findByRole("heading", {
        name: "Your account is awaiting review",
      }),
    ).toBeInTheDocument();
    await userActions.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("allows an authenticated Product Owner to enter the restricted route", async () => {
    const productOwner: AuthUser = { ...user, roles: ["product_owner"] };
    setSession({ accessToken: "product-owner-token", user: productOwner });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: { user: productOwner },
          requestId: "request-6",
        }),
      ),
    );

    render(<GuardTestApp initialEntry="/app/projects/project-1/approvals" />);

    expect(await screen.findByText("Approval workspace")).toBeInTheDocument();
  });
});
