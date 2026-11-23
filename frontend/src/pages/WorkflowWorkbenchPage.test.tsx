import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  AuthContext,
  type AuthContextValue,
} from "../features/auth/auth-context";
import type { AuthUser } from "../features/auth/auth.schemas";
import type { DocumentMetadata } from "../features/documents/document.schemas";
import type { Requirement } from "../features/requirements/requirement.schemas";
import { ApiError } from "../lib/api-client";
import { clearSession } from "../lib/auth-store";
import { WorkflowWorkbenchRoute } from "./WorkflowWorkbenchPage";

const apiMocks = vi.hoisted(() => ({
  listProjectDocuments: vi.fn(),
  uploadProjectDocument: vi.fn(),
  createRequirement: vi.fn(),
  listRequirementVersions: vi.fn(),
  listRequirements: vi.fn(),
  patchRequirement: vi.fn(),
  listWorkflowArtifacts: vi.fn(),
  submitWorkflow: vi.fn(),
  getWorkflowExecution: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock("../features/documents/document-api", () => ({
  listProjectDocuments: apiMocks.listProjectDocuments,
  uploadProjectDocument: apiMocks.uploadProjectDocument,
}));

vi.mock("../features/requirements/requirement-api", () => ({
  createRequirement: apiMocks.createRequirement,
  listRequirementVersions: apiMocks.listRequirementVersions,
  listRequirements: apiMocks.listRequirements,
  patchRequirement: apiMocks.patchRequirement,
}));

vi.mock("../features/workflows/workflow-api", () => ({
  getWorkflowExecution: apiMocks.getWorkflowExecution,
  listWorkflowArtifacts: apiMocks.listWorkflowArtifacts,
  submitWorkflow: apiMocks.submitWorkflow,
}));
vi.mock("../features/projects/project-api", () => ({
  getProject: apiMocks.getProject,
}));

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

const project = {
  id: "project-1",
  name: "Synthetic analysis",
  description: "Customers need a clear way to recover account access.",
  ownerUserId: user.id,
  members: [],
  status: "active" as const,
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

const document: DocumentMetadata = {
  id: "document-1",
  projectId: "project-1",
  uploadedByUserId: user.id,
  fileName: "business-brief.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1200,
  status: "uploaded",
  createdAt: "2026-03-04T05:06:07.000Z",
};

function makeRequirement(id: string, title: string): Requirement {
  return {
    id,
    projectId: "project-1",
    title,
    description: `${title} should be clear and testable.`,
    type: "functional",
    status: "draft",
    priority: "medium",
    sourceFacts: [],
    assumptions: [],
    openQuestions: [],
    traceability: { documentIds: [] },
    version: 1,
    createdByUserId: user.id,
    createdAt: "2026-03-04T05:06:07.000Z",
    updatedAt: "2026-03-04T05:06:07.000Z",
  };
}

const requirementPage = {
  items: [
    makeRequirement("requirement-1", "Verify account ownership"),
    makeRequirement("requirement-2", "Notify the account holder"),
  ],
  page: 1,
  limit: 100,
  total: 2,
};

const queuedExecution = {
  id: "execution-1",
  projectId: "project-1",
  workflowName: "requirements-analysis" as const,
  status: "queued" as const,
  nodeStates: [],
  createdByUserId: user.id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const completedExecution = {
  ...queuedExecution,
  status: "completed" as const,
  result: {
    summary: "Review the unresolved policy details.",
    requirementIds: ["requirement-1"],
    artifactIds: [],
    stakeholders: ["Account holder"],
    assumptions: [],
    openQuestions: ["Which recovery channel should be used?"],
    recommendations: [],
    uncertainties: [],
    clarificationRequired: false,
    findings: [],
  },
};

function renderWorkbench() {
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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: 2, retryDelay: 0 },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/app/projects/project-1/workflows"]}>
          <Routes>
            <Route
              element={<WorkflowWorkbenchRoute />}
              path="/app/projects/:projectId/workflows"
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("workflow workbench", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
    apiMocks.listProjectDocuments.mockResolvedValue([document]);
    apiMocks.listRequirements.mockResolvedValue(requirementPage);
    apiMocks.listWorkflowArtifacts.mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
    apiMocks.getProject.mockResolvedValue(project);
    apiMocks.submitWorkflow.mockResolvedValue(queuedExecution);
    apiMocks.getWorkflowExecution.mockResolvedValue(completedExecution);
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
  });

  afterEach(() => {
    clearSession();
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("requires explicit document selection and privacy confirmation before submitting", async () => {
    const userActions = userEvent.setup();
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", { name: /Analyze requirements/ }),
    );
    const runButton = screen.getByRole("button", { name: "Review and run" });
    expect(runButton).toBeDisabled();

    await userActions.click(
      screen.getByRole("checkbox", { name: /business-brief\.pdf/ }),
    );
    expect(runButton).toBeEnabled();
    await userActions.click(runButton);

    expect(
      screen.getByText(
        /selected source document text and the project's existing/i,
      ),
    ).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", {
      name: "Confirm and start",
    });
    expect(confirmButton).toBeDisabled();
    expect(apiMocks.submitWorkflow).not.toHaveBeenCalled();

    await userActions.click(
      screen.getByRole("checkbox", {
        name: /I am authorized to share the selected document content/,
      }),
    );
    await userActions.click(confirmButton);

    expect(apiMocks.submitWorkflow).toHaveBeenCalledTimes(1);
    expect(apiMocks.submitWorkflow).toHaveBeenCalledWith(
      "requirements-analysis",
      {
        projectId: "project-1",
        documentIds: ["document-1"],
        shareDocumentContent: true,
      },
    );
    expect(
      await screen.findByText("Review the unresolved policy details."),
    ).toBeInTheDocument();
    expect(screen.getByText("Account holder")).toBeInTheDocument();
  });

  it("runs requirement analysis from project context without sharing documents", async () => {
    const userActions = userEvent.setup();
    apiMocks.listProjectDocuments.mockResolvedValue([]);
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", { name: /Analyze requirements/ }),
    );
    await userActions.click(
      await screen.findByRole("radio", {
        name: /Use project context only/,
      }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Review and run" }),
    );

    expect(
      screen.getByText(/No document text will be sent/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: /authorized to share the selected document content/i,
      }),
    ).not.toBeInTheDocument();

    await userActions.click(
      screen.getByRole("button", { name: "Confirm and start" }),
    );

    expect(apiMocks.submitWorkflow).toHaveBeenCalledWith(
      "requirements-analysis",
      { projectId: "project-1", documentIds: [] },
    );
  });

  it("submits only selected requirements for story generation", async () => {
    const userActions = userEvent.setup();
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", { name: /Generate user stories/ }),
    );
    const runButton = screen.getByRole("button", { name: "Review and run" });
    expect(runButton).toBeDisabled();

    await userActions.click(
      screen.getByRole("checkbox", { name: /Verify account ownership/ }),
    );
    await userActions.click(runButton);
    await userActions.click(
      screen.getByRole("button", { name: "Confirm and start" }),
    );

    expect(apiMocks.submitWorkflow).toHaveBeenCalledWith("story-generation", {
      projectId: "project-1",
      requirementIds: ["requirement-1"],
    });
  });

  it("requires a selected story and sends its ID for acceptance criteria", async () => {
    const userActions = userEvent.setup();
    apiMocks.listWorkflowArtifacts.mockResolvedValue({
      items: [
        {
          id: "story-1",
          projectId: "project-1",
          type: "story",
          title: "Recover account access",
          description: "Allow an account holder to recover access.",
          status: "draft",
          requirementIds: ["requirement-1"],
          data: {},
          version: 1,
          createdByUserId: user.id,
          createdAt: "2026-03-04T05:06:07.000Z",
          updatedAt: "2026-03-04T05:06:07.000Z",
        },
      ],
      page: 1,
      limit: 100,
      total: 1,
    });
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", {
        name: /Generate acceptance criteria/,
      }),
    );
    const runButton = screen.getByRole("button", { name: "Review and run" });
    expect(runButton).toBeDisabled();

    await userActions.click(
      await screen.findByRole("radio", { name: /Recover account access/ }),
    );
    await userActions.click(runButton);
    await userActions.click(
      screen.getByRole("button", { name: "Confirm and start" }),
    );

    expect(apiMocks.submitWorkflow).toHaveBeenCalledWith(
      "acceptance-criteria-generation",
      {
        projectId: "project-1",
        storyId: "story-1",
      },
    );
  });

  it("does not automatically retry a failed workflow POST", async () => {
    const userActions = userEvent.setup();
    apiMocks.submitWorkflow.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Please wait before trying again."),
    );
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", { name: /Generate user stories/ }),
    );
    await userActions.click(
      screen.getByRole("checkbox", { name: /Verify account ownership/ }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Review and run" }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Confirm and start" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Workflow wasn't confirmed" }),
    ).toBeInTheDocument();
    expect(apiMocks.submitWorkflow).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        /may create a duplicate run because this API has no idempotency key/i,
      ),
    ).toBeInTheDocument();
  });

  it("sends only one POST when the confirmation control is clicked rapidly", async () => {
    const userActions = userEvent.setup();
    let resolveSubmission!: (execution: typeof queuedExecution) => void;
    apiMocks.submitWorkflow.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", { name: /Generate user stories/ }),
    );
    await userActions.click(
      screen.getByRole("checkbox", { name: /Verify account ownership/ }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Review and run" }),
    );
    const confirmButton = screen.getByRole("button", {
      name: "Confirm and start",
    });

    await userActions.dblClick(confirmButton);

    expect(apiMocks.submitWorkflow).toHaveBeenCalledTimes(1);
    resolveSubmission(queuedExecution);
    expect(
      await screen.findByText("Review the unresolved policy details."),
    ).toBeInTheDocument();
  });

  it("hides an unvalidated workflow result", async () => {
    const userActions = userEvent.setup();
    apiMocks.getWorkflowExecution.mockResolvedValue({
      ...completedExecution,
      result: { providerError: "Sensitive provider detail" },
    });
    renderWorkbench();

    await userActions.click(
      await screen.findByRole("button", { name: /Generate user stories/ }),
    );
    await userActions.click(
      screen.getByRole("checkbox", { name: /Verify account ownership/ }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Review and run" }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Confirm and start" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Result couldn't be validated",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Sensitive provider detail"),
    ).not.toBeInTheDocument();
  });
});
