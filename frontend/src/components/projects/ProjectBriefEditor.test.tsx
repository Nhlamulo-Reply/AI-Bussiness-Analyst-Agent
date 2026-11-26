import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../features/auth/AuthProvider";
import type { AuthUser } from "../../features/auth/auth.schemas";
import type { Project } from "../../features/projects/project.schemas";
import { clearSession, setSession } from "../../lib/auth-store";
import { ProjectOverviewPage } from "../../pages/ProjectOverviewPage";

const user: AuthUser = {
  id: "owner-1",
  email: "owner@example.com",
  roles: ["business_analyst"],
};

const project: Project = {
  id: "project-1",
  name: "Customer onboarding",
  description: "Improve the first-use experience.",
  businessObjective: "Reduce customer effort.",
  inScope: "Account setup.",
  outOfScope: "Billing changes.",
  stakeholders: ["Operations manager"],
  constraints: ["Launch before Q4."],
  desiredOutputs: ["Prioritized requirements"],
  ownerUserId: user.id,
  members: [],
  status: "active",
  createdAt: "2026-03-02T03:04:05.000Z",
  updatedAt: "2026-03-02T03:04:05.000Z",
};

describe("ProjectBriefEditor", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("saves updated project context through the owner-only API", async () => {
    setSession({ accessToken: "test-token", user });
    const updatedProject = {
      ...project,
      businessObjective: "Reduce onboarding abandonment.",
      updatedAt: "2026-03-03T03:04:05.000Z",
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/me")) {
          return Response.json({
            success: true,
            data: { user },
            requestId: "request-auth",
          });
        }
        if (url.endsWith("/projects/project-1")) {
          if (options?.method === "PATCH") {
            return Response.json({
              success: true,
              data: updatedProject,
              requestId: "request-update",
            });
          }
          return Response.json({
            success: true,
            data: project,
            requestId: "request-project",
          });
        }
        throw new Error(`Unexpected API request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    const userActions = userEvent.setup();

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

    await userActions.click(
      await screen.findByRole("button", { name: "Edit project brief" }),
    );
    const objective = screen.getByRole("textbox", {
      name: "Business objective",
    });
    await userActions.clear(objective);
    await userActions.type(objective, updatedProject.businessObjective);
    await userActions.click(screen.getByRole("button", { name: "Save brief" }));

    expect(await screen.findByText("Project brief saved.")).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(
      ([input, options]) =>
        String(input).endsWith("/projects/project-1") &&
        options?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      name: project.name,
      businessObjective: updatedProject.businessObjective,
      stakeholders: ["Operations manager"],
    });
    expect(screen.getAllByText("Reduce onboarding abandonment.")).toHaveLength(
      2,
    );
  }, 10000);
});
