import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { ProjectOverviewPage } from "./ProjectOverviewPage";

describe("ProjectOverviewPage role actions", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows Product Owner review actions without Business Analyst editing tools", async () => {
    const user: AuthUser = {
      id: "owner-1",
      email: "owner@example.test",
      roles: ["product_owner"],
    };
    const project = {
      id: "project-1",
      name: "Product project",
      description: "",
      businessObjective: "Improve customer onboarding.",
      inScope: "",
      outOfScope: "",
      stakeholders: [],
      constraints: [],
      desiredOutputs: [],
      ownerUserId: user.id,
      members: [],
      status: "active",
      createdAt: "2026-11-23T07:00:00.000Z",
      updatedAt: "2026-11-23T07:00:00.000Z",
    };
    setSession({ accessToken: "project-token", user });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        const data = url.endsWith("/auth/me") ? { user } : project;
        return Response.json({
          success: true,
          data,
          requestId: "project-overview-test",
        });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/app/projects/project-1"]}>
            <Routes>
              <Route
                path="/app/projects/:projectId"
                element={<ProjectOverviewPage />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Product project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review approvals/ }),
    ).toHaveAttribute("href", "/app/projects/project-1/approvals");
    expect(
      screen.getByRole("link", { name: /Review source documents/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review requirements/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review deliverables/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Run an analysis" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Export project data" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Delivery reviews" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit project brief" }),
    ).toBeInTheDocument();
    queryClient.clear();
  });
});
