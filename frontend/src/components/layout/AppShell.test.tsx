import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../features/auth/AuthProvider";
import type { AuthUser } from "../../features/auth/auth.schemas";
import { clearSession, setSession } from "../../lib/auth-store";
import { AppShell } from "./AppShell";

function renderProjectShell(user: AuthUser) {
  setSession({ accessToken: "test-token", user });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: { user },
        requestId: "request-7",
      }),
    ),
  );

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/app/projects/project-1"]}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<AppShell />}>
            <Route index element={<p>Project overview content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("AppShell role-aware navigation", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hides approvals navigation from a standard user", async () => {
    renderProjectShell({
      id: "user-1",
      email: "analyst@example.com",
      roles: ["user"],
    });

    expect(
      await screen.findByText("Project overview content"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Approvals" }),
    ).not.toBeInTheDocument();
  });

  it("shows approvals navigation to a reviewer", async () => {
    renderProjectShell({
      id: "reviewer-1",
      email: "reviewer@example.com",
      roles: ["reviewer"],
    });

    expect(
      await screen.findByRole("link", { name: "Approvals" }),
    ).toBeInTheDocument();
  });
});
