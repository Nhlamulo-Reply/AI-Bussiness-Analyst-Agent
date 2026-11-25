import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { DeliveryReviewWorkspacePage } from "./DeliveryReviewWorkspacePage";

const user: AuthUser = {
  id: "delivery-1",
  email: "delivery@example.test",
  roles: ["delivery_lead"],
};

const project = {
  id: "project-1",
  name: "Delivery project",
  description: "",
  businessObjective: "",
  inScope: "",
  outOfScope: "",
  stakeholders: [],
  constraints: [],
  desiredOutputs: [],
  ownerUserId: "owner-1",
  members: [user.id],
  status: "active",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

const approval = {
  id: "approval-1",
  projectId: project.id,
  artifactType: "risk" as const,
  artifactId: "risk-1",
  submittedByUserId: "analyst-1",
  decision: "pending" as const,
  comments: "Please review the mitigation plan.",
  deliveryFeedback: [],
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

const resource = {
  id: "risk-1",
  projectId: project.id,
  type: "risk" as const,
  title: "Implementation risk",
  description: "A delivery risk that needs mitigation.",
  status: "submitted" as const,
  requirementIds: [],
  data: {},
  version: 1,
  createdByUserId: "analyst-1",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

describe("DeliveryReviewWorkspacePage", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    setSession({ accessToken: "delivery-token", user });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adds delivery feedback without presenting approval decisions", async () => {
    let deliveryFeedback: Array<{
      reviewerUserId: string;
      comments: string;
      createdAt: string;
      id?: string;
      withdrawnAt?: string;
      withdrawnByUserId?: string;
    }> = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async (input: RequestInfo | URL, options?: RequestInit) => {
          const url = String(input);
          const method = options?.method ?? "GET";
          let data: unknown;

          if (url.endsWith("/auth/me")) {
            data = { user };
          } else if (url.endsWith("/projects/project-1")) {
            data = project;
          } else if (url.includes("/projects/project-1/delivery-reviews?")) {
            data = {
              items: [
                { approval: { ...approval, deliveryFeedback }, resource },
              ],
              page: 1,
              limit: 12,
              total: 1,
            };
          } else if (
            url.endsWith("/approvals/approval-1/delivery-feedback") &&
            method === "POST"
          ) {
            const body = JSON.parse(String(options?.body)) as {
              comments: string;
            };
            deliveryFeedback = [
              {
                id: "feedback-1",
                reviewerUserId: user.id,
                comments: body.comments,
                createdAt: "2026-11-23T08:00:00.000Z",
              },
            ];
            data = { ...approval, deliveryFeedback };
          } else if (
            url.endsWith(
              "/approvals/approval-1/delivery-feedback/feedback-1/withdraw",
            ) &&
            method === "PATCH"
          ) {
            deliveryFeedback = deliveryFeedback.map((feedback) => ({
              ...feedback,
              withdrawnAt: "2026-11-23T08:30:00.000Z",
              withdrawnByUserId: user.id,
            }));
            data = { ...approval, deliveryFeedback };
          } else {
            throw new Error(`Unexpected request: ${method} ${url}`);
          }

          return Response.json({
            success: true,
            data,
            requestId: "delivery-review-test",
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
            initialEntries={["/app/projects/project-1/delivery-reviews"]}
          >
            <Routes>
              <Route
                path="/app/projects/:projectId/delivery-reviews"
                element={<DeliveryReviewWorkspacePage />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await userActions.click(
      await screen.findByRole("button", { name: /Implementation risk/ }),
    );
    await userActions.type(
      screen.getByRole("textbox", { name: "Delivery feedback" }),
      "Add a rollback plan.",
    );
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reject" }),
    ).not.toBeInTheDocument();
    await userActions.click(
      screen.getByRole("button", { name: "Add feedback" }),
    );

    await waitFor(() => {
      expect(deliveryFeedback[0]?.comments).toBe("Add a rollback plan.");
      expect(screen.getByText(/Add a rollback plan\./)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/approvals/approval-1/delivery-feedback",
      expect.objectContaining({ method: "POST" }),
    );
    await userActions.click(screen.getByRole("button", { name: "Withdraw" }));
    await userActions.click(
      screen.getByRole("button", { name: "Withdraw feedback" }),
    );
    expect(await screen.findByText("Withdrawn")).toBeInTheDocument();
    expect(deliveryFeedback[0]?.withdrawnByUserId).toBe(user.id);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/approvals/approval-1/delivery-feedback/feedback-1/withdraw",
      expect.objectContaining({ method: "PATCH" }),
    );
    queryClient.clear();
  });

  it("allows feedback on an approved review without changing the decision", async () => {
    let deliveryFeedback = [
      {
        reviewerUserId: "delivery-2",
        comments: "Track the mitigation owner.",
        createdAt: "2026-11-23T07:30:00.000Z",
      },
    ];
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async (input: RequestInfo | URL, options?: RequestInit) => {
          const url = String(input);
          const method = options?.method ?? "GET";
          let data: unknown;

          if (url.endsWith("/auth/me")) {
            data = { user };
          } else if (url.endsWith("/projects/project-1")) {
            data = project;
          } else if (url.includes("/projects/project-1/delivery-reviews?")) {
            data = {
              items: [
                {
                  approval: {
                    ...approval,
                    decision: "approved",
                    reviewerComments: "Proceed with a monitoring plan.",
                    deliveryFeedback,
                  },
                  resource,
                },
              ],
              page: 1,
              limit: 12,
              total: 1,
            };
          } else if (
            url.endsWith("/approvals/approval-1/delivery-feedback") &&
            method === "POST"
          ) {
            const body = JSON.parse(String(options?.body)) as {
              comments: string;
            };
            deliveryFeedback = [
              ...deliveryFeedback,
              {
                reviewerUserId: user.id,
                comments: body.comments,
                createdAt: "2026-11-23T08:00:00.000Z",
              },
            ];
            data = {
              ...approval,
              decision: "approved",
              reviewerComments: "Proceed with a monitoring plan.",
              deliveryFeedback,
            };
          } else {
            throw new Error(`Unexpected request: ${method} ${url}`);
          }

          return Response.json({
            success: true,
            data,
            requestId: "decided-delivery-review-test",
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
            initialEntries={["/app/projects/project-1/delivery-reviews"]}
          >
            <Routes>
              <Route
                path="/app/projects/:projectId/delivery-reviews"
                element={<DeliveryReviewWorkspacePage />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    await userActions.click(
      await screen.findByRole("button", { name: /Implementation risk/ }),
    );
    expect(
      await screen.findByText("Proceed with a monitoring plan."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Track the mitigation owner/)).toBeInTheDocument();
    await userActions.type(
      screen.getByRole("textbox", { name: "Delivery feedback" }),
      "Add a contingency owner.",
    );
    await userActions.click(
      screen.getByRole("button", { name: "Add feedback" }),
    );

    await waitFor(() => {
      expect(deliveryFeedback).toHaveLength(2);
      expect(deliveryFeedback[1]?.comments).toBe("Add a contingency owner.");
      expect(
        screen.getAllByText("Approved", { exact: true }).length,
      ).toBeGreaterThan(0);
    });
    queryClient.clear();
  });
});
