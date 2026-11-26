import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { TrashPage } from "./TrashPage";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

const item = {
  id: "project-1",
  resourceType: "project",
  projectId: "project-1",
  projectName: "Customer onboarding",
  label: "Customer onboarding",
  trashedAt: "2026-10-25T10:00:00.000Z",
  purgeAfter: "2026-11-24T10:00:00.000Z",
  trashedByUserId: "user-1",
  canRestore: true,
  canPurge: false,
};

function renderTrashPage() {
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
    if (url.includes("/trash?")) {
      return Promise.resolve(
        Response.json({
          success: true,
          data: { items: [item], page: 1, limit: 12, total: 1 },
          requestId: "request-trash",
        }),
      );
    }
    if (url.endsWith("/trash/project/project-1/restore")) {
      return Promise.resolve(
        Response.json({
          success: true,
          data: {
            id: item.id,
            resourceType: item.resourceType,
            projectId: item.projectId,
            projectName: item.projectName,
            label: item.label,
            trashedAt: item.trashedAt,
            purgeAfter: item.purgeAfter,
            trashedByUserId: item.trashedByUserId,
          },
          requestId: "request-restore",
        }),
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/app/trash"]}>
          <Routes>
            <Route path="/app/trash" element={<TrashPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return fetchMock;
}

describe("TrashPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("restores authorized items and never offers permanent deletion to project users", async () => {
    const fetchMock = renderTrashPage();
    const userActions = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Bin" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Customer onboarding" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete permanently" }),
    ).not.toBeInTheDocument();
    await userActions.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/trash/project/project-1/restore",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
