import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { ApprovalWorkspacePage } from "./ApprovalWorkspacePage";

const user: AuthUser = {
  id: "reviewer-1",
  email: "reviewer@example.com",
  roles: ["business_analyst", "product_owner"],
};

const approval = {
  id: "approval-1",
  projectId: "project-1",
  artifactType: "requirement" as const,
  artifactId: "requirement-1",
  submittedByUserId: "submitter-1",
  decision: "pending" as const,
  comments: "Please verify the business need.",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

const resource = {
  id: "requirement-1",
  projectId: "project-1",
  title: "Business requirement",
  description: "A useful requirement.",
  type: "business" as const,
  status: "draft" as const,
  priority: "high" as const,
  sourceFacts: [],
  assumptions: [],
  openQuestions: [],
  traceability: { documentIds: [] },
  version: 1,
  createdByUserId: "submitter-1",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

describe("ApprovalWorkspacePage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    setSession({ accessToken: "reviewer-token", user });
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads an approval and submits a reviewer decision", async () => {
    let decision = "pending";
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async (input: RequestInfo | URL, options?: RequestInit) => {
          const url = String(input);
          const method = options?.method ?? "GET";
          let data: unknown;

          if (url.endsWith("/auth/me")) {
            data = { user };
          } else if (url.includes("/projects/project-1/approvals?")) {
            data = {
              items: decision === "pending" ? [approval] : [],
              page: 1,
              limit: 12,
              total: decision === "pending" ? 1 : 0,
            };
          } else if (
            url.endsWith("/approvals/approval-1") &&
            method === "GET"
          ) {
            data = {
              approval: { ...approval, decision },
              resource,
            };
          } else if (
            url.endsWith("/approvals/approval-1") &&
            method === "PATCH"
          ) {
            decision = JSON.parse(String(options?.body)).decision;
            data = { ...approval, decision, comments: "Approved." };
          } else {
            throw new Error(`Unexpected request: ${method} ${url}`);
          }

          return Response.json({
            success: true,
            data,
            requestId: "approval-test-request",
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
          <MemoryRouter initialEntries={["/app/projects/project-1/approvals"]}>
            <Routes>
              <Route
                path="/app/projects/:projectId/approvals"
                element={<ApprovalWorkspacePage />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await userActions.click(
      await screen.findByRole("button", { name: /Requirement review/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Business requirement" }),
    ).toBeInTheDocument();
    await userActions.type(
      screen.getByRole("textbox", { name: "Reviewer comments" }),
      "Approved.",
    );
    await userActions.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(decision).toBe("approved");
      expect(
        within(
          screen.getByRole("region", { name: "Approval details" }),
        ).getByText("Approved", { exact: true }),
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/approvals/approval-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    queryClient.clear();
  });
});
