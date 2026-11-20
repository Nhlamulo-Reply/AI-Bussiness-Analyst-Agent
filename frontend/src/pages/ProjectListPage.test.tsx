import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { ProjectListPage } from "./ProjectListPage";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["user"],
};

const projects = [
  {
    id: "project-1",
    name: "Customer onboarding",
    description: "Improve the first-use experience.",
    ownerUserId: "user-1",
    members: [],
    status: "active",
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-03T03:04:05.000Z",
  },
  {
    id: "project-2",
    name: "Archive migration",
    description: "Move legacy records into the new system.",
    ownerUserId: "user-1",
    members: [],
    status: "archived",
    createdAt: "2026-02-02T03:04:05.000Z",
    updatedAt: "2026-02-03T03:04:05.000Z",
  },
];

type ProjectResponseFactory = (url: string) => unknown;

function renderProjectList(responseData: unknown | ProjectResponseFactory) {
  setSession({ accessToken: "test-token", user });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
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
    const data =
      typeof responseData === "function"
        ? (responseData as ProjectResponseFactory)(url)
        : responseData;
    return Promise.resolve(
      Response.json({
        success: true,
        data,
        requestId: "request-projects",
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/app/projects"]}>
          <Routes>
            <Route path="/app/projects" element={<ProjectListPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );

  return fetchMock;
}

describe("ProjectListPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses server pagination and filters only the loaded page", async () => {
    const fetchMock = renderProjectList({
      items: projects,
      page: 1,
      limit: 12,
      total: 15,
    });
    const userActions = userEvent.setup();

    expect(
      await screen.findByRole("link", { name: "Open Customer onboarding" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects?page=1&limit=12",
      expect.objectContaining({ credentials: "omit" }),
    );

    await userActions.selectOptions(
      screen.getByRole("combobox", { name: "Filter by status" }),
      "archived",
    );
    expect(
      screen.getByRole("link", { name: "Open Archive migration" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open Customer onboarding" }),
    ).not.toBeInTheDocument();

    await userActions.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Archive migration/ }),
    ).toHaveAttribute("href", "/app/projects/project-2");
  });

  it("shows a first-project empty state when the API returns no projects", async () => {
    renderProjectList({ items: [], page: 1, limit: 12, total: 0 });

    expect(
      await screen.findByRole("heading", { name: "Start with a project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your first project" }),
    ).toHaveAttribute("href", "/app/projects/new");
  });

  it("requests the next server page using the returned pagination metadata", async () => {
    const firstPage = Array.from({ length: 12 }, (_, index) => ({
      ...projects[0],
      id: `project-${index + 1}`,
      name: `Project ${index + 1}`,
    }));
    const secondPage = {
      ...projects[1],
      id: "project-13",
      name: "Project page two",
    };
    const fetchMock = renderProjectList((url: string) =>
      url.includes("page=2")
        ? { items: [secondPage], page: 2, limit: 12, total: 13 }
        : { items: firstPage, page: 1, limit: 12, total: 13 },
    );
    const userActions = userEvent.setup();

    expect(
      await screen.findByRole("link", { name: "Open Project 1" }),
    ).toBeInTheDocument();
    await userActions.click(
      screen.getByRole("button", { name: "Next project page" }),
    );

    expect(
      await screen.findByRole("link", { name: "Open Project page two" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects?page=2&limit=12",
      expect.objectContaining({ credentials: "omit" }),
    );
    expect(screen.getByText("Page 2 of 2 · 13 projects")).toBeInTheDocument();
  });
});
