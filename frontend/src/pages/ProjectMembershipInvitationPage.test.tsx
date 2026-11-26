import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { ProjectMembershipInvitationPage } from "./ProjectMembershipInvitationPage";

const user: AuthUser = {
  id: "invitee-1",
  email: "invitee@example.test",
  roles: ["business_analyst"],
};

const invitation = {
  id: "invitation-1",
  projectId: "project-1",
  invitedUserId: user.id,
  invitedByUserId: "owner-1",
  status: "pending" as const,
  createdAt: "2026-11-26T08:00:00.000Z",
  updatedAt: "2026-11-26T08:00:00.000Z",
};

describe("ProjectMembershipInvitationPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    setSession({ accessToken: "invitee-token", user });
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("grants project access only after the invited user accepts", async () => {
    let response: "pending" | "accepted" = "pending";
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async (input: RequestInfo | URL, options?: RequestInit) => {
          const url = String(input);
          const method = options?.method ?? "GET";
          let data: unknown;

          if (url.endsWith("/auth/me")) {
            data = { user };
          } else if (
            url.endsWith("/project-membership-invitations/invitation-1") &&
            method === "GET"
          ) {
            data = {
              invitation: { ...invitation, status: response },
              project: { id: "project-1", name: "Customer onboarding" },
            };
          } else if (
            url.endsWith(
              "/project-membership-invitations/invitation-1/respond",
            ) &&
            method === "POST"
          ) {
            expect(JSON.parse(String(options?.body))).toEqual({
              decision: "accepted",
            });
            response = "accepted";
            data = {
              invitation: {
                ...invitation,
                status: "accepted",
                respondedAt: "2026-11-26T08:05:00.000Z",
                updatedAt: "2026-11-26T08:05:00.000Z",
              },
            };
          } else {
            throw new Error(`Unexpected request: ${method} ${url}`);
          }

          return Response.json({
            success: true,
            data,
            requestId: "invitation-test-request",
          });
        },
      );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const userActions = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter
            initialEntries={[
              "/app/project-membership-invitations/invitation-1",
            ]}
          >
            <Routes>
              <Route
                path="/app/project-membership-invitations/:invitationId"
                element={<ProjectMembershipInvitationPage />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Customer onboarding" }),
    ).toBeInTheDocument();
    await userActions.click(
      screen.getByRole("button", { name: "Accept invitation" }),
    );

    await waitFor(() => {
      expect(response).toBe("accepted");
      expect(
        screen.getByRole("link", { name: "Open project" }),
      ).toHaveAttribute("href", "/app/projects/project-1");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/project-membership-invitations/invitation-1/respond",
      expect.objectContaining({ method: "POST" }),
    );
    queryClient.clear();
  });
});
