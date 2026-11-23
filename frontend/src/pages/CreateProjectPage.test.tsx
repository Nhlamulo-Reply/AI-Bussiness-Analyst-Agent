import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { ProjectOverviewPage } from "./ProjectOverviewPage";
import { CreateProjectPage } from "./CreateProjectPage";
import { clearSession, setSession } from "../lib/auth-store";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

const createdProject = {
  id: "project-new",
  name: "Customer onboarding",
  description: "Improve the first-use experience.",
  ownerUserId: "user-1",
  members: [],
  status: "active",
  createdAt: "2026-03-02T03:04:05.000Z",
  updatedAt: "2026-03-02T03:04:05.000Z",
};

describe("CreateProjectPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("validates the name and creates then opens the returned project", async () => {
    setSession({ accessToken: "test-token", user });
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/auth/me")) {
          return Promise.resolve(
            Response.json({
              success: true,
              data: { user },
              requestId: "request-auth",
            }),
          );
        }
        if (url.endsWith("/projects") && options?.method === "POST") {
          return Promise.resolve(
            Response.json(
              {
                success: true,
                data: createdProject,
                requestId: "request-create",
              },
              { status: 201 },
            ),
          );
        }
        throw new Error(`Unexpected API request: ${url}`);
      });
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
          <MemoryRouter initialEntries={["/app/projects/new"]}>
            <Routes>
              <Route path="/app/projects/new" element={<CreateProjectPage />} />
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
      screen.getByRole("button", { name: "Create project" }),
    );
    expect(
      await screen.findByText("Enter a project name."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([input, options]) =>
          String(input).endsWith("/projects") && options?.method === "POST",
      ),
    ).toBe(false);

    await userActions.type(
      screen.getByRole("textbox", { name: "Project name" }),
      "Customer onboarding",
    );
    await userActions.type(
      screen.getByRole("textbox", { name: "Description" }),
      "Improve the first-use experience.",
    );
    await userActions.type(
      screen.getByRole("textbox", { name: "Business objective" }),
      "Reduce onboarding drop-off.",
    );
    await userActions.type(
      screen.getByRole("textbox", { name: "Stakeholders" }),
      "Operations manager\nCustomer support team",
    );
    await userActions.click(
      screen.getByRole("button", { name: "Create project" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Customer onboarding" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Customer onboarding",
          description: "Improve the first-use experience.",
          businessObjective: "Reduce onboarding drop-off.",
          inScope: "",
          outOfScope: "",
          stakeholders: ["Operations manager", "Customer support team"],
          constraints: [],
          desiredOutputs: [],
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Choose your next step" }),
    ).toBeInTheDocument();
  }, 10000);
});
