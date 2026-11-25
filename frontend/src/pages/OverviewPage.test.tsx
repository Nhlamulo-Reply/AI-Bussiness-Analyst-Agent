import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { OverviewPage } from "./OverviewPage";

const project = {
  id: "project-1",
  name: "Review project",
  description: "",
  businessObjective: "",
  inScope: "",
  outOfScope: "",
  stakeholders: [],
  constraints: [],
  desiredOutputs: [],
  ownerUserId: "owner-1",
  members: ["po-1", "dl-1"],
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
  comments: "Please review.",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

const artifact = {
  id: "risk-1",
  projectId: project.id,
  type: "risk" as const,
  title: "Delivery risk",
  description: "A possible schedule delay.",
  status: "submitted" as const,
  requirementIds: [],
  data: {},
  version: 1,
  createdByUserId: "analyst-1",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

function renderOverview(user: AuthUser) {
  setSession({ accessToken: "overview-token", user });
  const fetchMock = vi
    .fn()
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      let data: unknown;
      if (url.endsWith("/auth/me")) {
        data = { user };
      } else if (url.includes("/projects?page=1&limit=100")) {
        data = { items: [project], page: 1, limit: 100, total: 1 };
      } else if (url.includes("/projects/project-1/approvals?")) {
        data = { items: [approval], page: 1, limit: 100, total: 1 };
      } else if (url.includes("/projects/project-1/delivery-reviews?")) {
        data = {
          items: [{ approval, resource: artifact }],
          page: 1,
          limit: 100,
          total: 1,
        };
      } else {
        throw new Error(`Unexpected request: ${url}`);
      }

      return Response.json({
        success: true,
        data,
        requestId: "overview-test",
      });
    });
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <OverviewPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { fetchMock, queryClient };
}

describe("role-specific overview dashboards", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows a Product Owner approval queue without the analyst dashboard", async () => {
    const user: AuthUser = {
      id: "po-1",
      email: "owner@example.test",
      roles: ["product_owner"],
    };
    const { fetchMock, queryClient } = renderOverview(user);

    expect(
      await screen.findByRole("heading", { name: "Approval queue" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("1 pending approval")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open pending approval queue" }),
    ).toHaveAttribute("href", "/app/projects/project-1/approvals");
    expect(
      screen.queryByRole("link", { name: "Create project" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/projects/project-1/approvals?"),
      expect.any(Object),
    );
    queryClient.clear();
  });

  it("shows Delivery Lead feedback tasks but no approval-decision route", async () => {
    const user: AuthUser = {
      id: "dl-1",
      email: "delivery@example.test",
      roles: ["delivery_lead"],
    };
    const { queryClient } = renderOverview(user);

    expect(
      await screen.findByRole("heading", {
        name: "Delivery feedback queue",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: "Open pending delivery review queue",
      }),
    ).toHaveAttribute("href", "/app/projects/project-1/delivery-reviews");
    expect(
      screen.queryByRole("link", { name: "Open pending approval queue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/a Product Owner remains responsible for the decision/i),
    ).toBeInTheDocument();
    queryClient.clear();
  });
});
