import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/auth-context";
import type { AuthUser } from "../auth/auth.schemas";
import { ApiError } from "../../lib/api-client";
import { ApprovalSubmissionPanel } from "./ApprovalSubmissionPanel";

const apiMocks = vi.hoisted(() => ({
  createApproval: vi.fn(),
}));

vi.mock("./approval-api", () => ({
  createApproval: apiMocks.createApproval,
}));

const user: AuthUser = {
  id: "submitter-1",
  email: "analyst@example.com",
  roles: ["user"],
};

const pendingApproval = {
  id: "approval-1",
  projectId: "project-1",
  artifactType: "requirement" as const,
  artifactId: "requirement-1",
  submittedByUserId: user.id,
  decision: "pending" as const,
  comments: "Please review this draft.",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

function renderPanel(status: "draft" | "reviewed" | "approved" | "rejected") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const authValue: AuthContextValue = {
    session: { accessToken: "test-token", user },
    isAuthenticated: true,
    isInitializing: false,
    initializationError: null,
    signIn: async () => {},
    register: async () => {},
    signOut: vi.fn(),
    retrySessionValidation: async () => {},
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <ApprovalSubmissionPanel
          artifactId="requirement-1"
          artifactType="requirement"
          projectId="project-1"
          status={status}
        />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ApprovalSubmissionPanel", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("submits a draft and displays the returned pending approval", async () => {
    const userActions = userEvent.setup();
    apiMocks.createApproval.mockResolvedValue(pendingApproval);
    renderPanel("draft");

    await userActions.click(
      screen.getByRole("button", { name: "Request review" }),
    );
    await userActions.type(
      screen.getByRole("textbox", { name: "Reviewer note (optional)" }),
      "  Please review this draft.  ",
    );
    await userActions.click(
      screen.getByRole("button", { name: "Submit for review" }),
    );

    expect(apiMocks.createApproval).toHaveBeenCalledWith({
      artifactType: "requirement",
      artifactId: "requirement-1",
      projectId: "project-1",
      comments: "Please review this draft.",
    });
    expect(await screen.findByText("Submitted for review")).toBeInTheDocument();
    expect(screen.getByText("approval-1")).toBeInTheDocument();
    expect(
      screen.getByText(/submitter cannot review their own request/i),
    ).toBeInTheDocument();
  });

  it("explains when the draft is no longer eligible for review submission", async () => {
    const userActions = userEvent.setup();
    apiMocks.createApproval.mockRejectedValue(
      new ApiError(409, "CONFLICT", "The draft is not eligible."),
    );
    renderPanel("draft");

    await userActions.click(
      screen.getByRole("button", { name: "Request review" }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Submit for review" }),
    );

    expect(
      await screen.findByText(
        /no longer an eligible draft or already has a pending review/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not offer review submission for non-draft resources", () => {
    renderPanel("approved");
    expect(
      screen.queryByRole("button", { name: "Request review" }),
    ).not.toBeInTheDocument();
  });
});
