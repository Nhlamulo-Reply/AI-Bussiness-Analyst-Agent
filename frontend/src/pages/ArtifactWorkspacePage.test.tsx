import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  AuthContext,
  type AuthContextValue,
} from "../features/auth/auth-context";
import type { AuthUser } from "../features/auth/auth.schemas";
import type { Artifact } from "../features/artifacts/artifact.schemas";
import { ApiError } from "../lib/api-client";
import { clearSession } from "../lib/auth-store";
import { ArtifactWorkspaceRoute } from "./ArtifactWorkspacePage";

const apiMocks = vi.hoisted(() => ({
  listArtifacts: vi.fn(),
  findArtifactById: vi.fn(),
  createArtifact: vi.fn(),
  patchArtifact: vi.fn(),
  listArtifactVersions: vi.fn(),
  createRequirement: vi.fn(),
  listRequirementVersions: vi.fn(),
  listRequirements: vi.fn(),
  patchRequirement: vi.fn(),
}));

vi.mock("../features/artifacts/artifact-api", () => ({
  createArtifact: apiMocks.createArtifact,
  findArtifactById: apiMocks.findArtifactById,
  listArtifactVersions: apiMocks.listArtifactVersions,
  listArtifacts: apiMocks.listArtifacts,
  patchArtifact: apiMocks.patchArtifact,
}));

vi.mock("../features/requirements/requirement-api", () => ({
  createRequirement: apiMocks.createRequirement,
  listRequirementVersions: apiMocks.listRequirementVersions,
  listRequirements: apiMocks.listRequirements,
  patchRequirement: apiMocks.patchRequirement,
}));

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["user"],
};

function makeArtifact(id: string, overrides: Partial<Artifact> = {}): Artifact {
  return {
    id,
    projectId: "project-1",
    type: "story",
    title: "Recover account access",
    description: "Allow an account holder to recover access.",
    status: "draft",
    requirementIds: ["requirement-1"],
    data: { priority: "high", unknownField: { keep: true } },
    version: 2,
    createdByUserId: user.id,
    createdAt: "2026-03-04T05:06:07.000Z",
    updatedAt: "2026-03-05T05:06:07.000Z",
    ...overrides,
  };
}

const requirement = {
  id: "requirement-1",
  projectId: "project-1",
  title: "Confirm account ownership",
  description: "Verify access before recovery.",
  type: "functional" as const,
  status: "draft" as const,
  priority: "medium" as const,
  sourceFacts: [],
  assumptions: [],
  openQuestions: [],
  traceability: { documentIds: [] },
  version: 1,
  createdByUserId: user.id,
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

const version = {
  id: "version-1",
  projectId: "project-1",
  artifactType: "story" as const,
  artifactId: "artifact-1",
  version: 1,
  snapshot: makeArtifact("artifact-1", {
    title: "Earlier story",
    version: 1,
  }),
  actorUserId: "editor-user",
  reason: "Artifact edited",
  createdAt: "2026-03-04T05:06:07.000Z",
};

function renderWorkspace(initialEntry = "/app/projects/project-1/artifacts") {
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
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              element={<ArtifactWorkspaceRoute />}
              path="/app/projects/:projectId/artifacts"
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("artifact workspace", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
    apiMocks.listArtifacts.mockResolvedValue({
      items: [makeArtifact("artifact-1")],
      page: 1,
      limit: 12,
      total: 1,
    });
    apiMocks.findArtifactById.mockResolvedValue(makeArtifact("artifact-1"));
    apiMocks.listRequirements.mockResolvedValue({
      items: [requirement],
      page: 1,
      limit: 100,
      total: 1,
    });
    apiMocks.listArtifactVersions.mockResolvedValue([version]);
    apiMocks.createArtifact.mockImplementation(
      async (_projectId: string, input: Partial<Artifact>) =>
        makeArtifact("artifact-created", {
          ...input,
          version: 1,
          status: "draft",
        } as Artifact),
    );
    apiMocks.patchArtifact.mockResolvedValue(
      makeArtifact("artifact-1", { version: 3 }),
    );
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

  it("shows artifacts for every type and opens a generic details and version inspector", async () => {
    const userActions = userEvent.setup();
    apiMocks.listArtifacts.mockResolvedValue({
      items: [
        makeArtifact("artifact-1"),
        makeArtifact("artifact-2", {
          type: "risk",
          title: "Recovery delay risk",
        }),
        makeArtifact("artifact-3", {
          type: "acceptance_criteria",
          title: "Recovery acceptance criteria",
        }),
        makeArtifact("artifact-4", {
          type: "business_rule",
          title: "Recovery business rule",
        }),
        makeArtifact("artifact-5", {
          type: "epic",
          title: "Account recovery epic",
        }),
        makeArtifact("artifact-6", {
          type: "dependency",
          title: "Identity provider dependency",
        }),
        makeArtifact("artifact-7", {
          type: "implementation_plan",
          title: "Recovery implementation plan",
        }),
      ],
      page: 1,
      limit: 12,
      total: 7,
    });
    renderWorkspace();

    expect(
      await screen.findByRole("heading", { name: "Deliverables" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Recovery delay risk")).toBeInTheDocument();
    expect(
      await screen.findByText("Recovery acceptance criteria"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Identity provider dependency"),
    ).toBeInTheDocument();

    await userActions.click(
      screen.getByRole("button", { name: /Recover account access/ }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Version history" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("unknownField")).toHaveLength(2);
    expect(
      within(dialog).getByText("Confirm account ownership"),
    ).toBeInTheDocument();
    await userActions.click(
      within(dialog).getByText("Show version 1 snapshot"),
    );
    expect(within(dialog).getByText("Earlier story")).toBeInTheDocument();
  });

  it("creates an artifact draft with structured data and requirement links", async () => {
    const userActions = userEvent.setup();
    renderWorkspace();

    await userActions.click(
      await screen.findByRole("button", { name: "New deliverable" }),
    );
    const dialog = screen.getByRole("dialog");
    await userActions.selectOptions(
      within(dialog).getByRole("combobox", { name: /^Artifact type/ }),
      "risk",
    );
    await userActions.type(
      within(dialog).getByRole("textbox", { name: "Title" }),
      "Recovery provider outage",
    );
    await userActions.click(
      within(dialog).getByRole("checkbox", {
        name: /Confirm account ownership/,
      }),
    );
    await userActions.clear(
      within(dialog).getByRole("textbox", { name: /Structured data/ }),
    );
    fireEvent.change(
      within(dialog).getByRole("textbox", { name: /Structured data/ }),
      {
        target: {
          value: '{"impact":"high","mitigation":"Use a fallback provider"}',
        },
      },
    );
    await userActions.click(
      within(dialog).getByRole("button", { name: "Create draft" }),
    );

    expect(apiMocks.createArtifact).toHaveBeenCalledWith("project-1", {
      type: "risk",
      title: "Recovery provider outage",
      description: "",
      requirementIds: ["requirement-1"],
      data: {
        impact: "high",
        mitigation: "Use a fallback provider",
      },
    });
    expect(
      await screen.findByText("was created as a draft."),
    ).toBeInTheDocument();
  });

  it("keeps edit values and explains the pending-approval conflict", async () => {
    const userActions = userEvent.setup();
    apiMocks.patchArtifact.mockRejectedValue(
      new ApiError(
        409,
        "CONFLICT",
        "An artifact cannot be edited while its approval is pending.",
      ),
    );
    renderWorkspace();

    await userActions.click(
      await screen.findByRole("button", { name: /Recover account access/ }),
    );
    const details = screen.getByRole("dialog");
    await userActions.click(
      within(details).getByRole("button", { name: "Edit artifact" }),
    );
    const editDialog = screen.getByRole("dialog");
    const title = within(editDialog).getByRole("textbox", { name: "Title" });
    await userActions.clear(title);
    await userActions.type(title, "Updated recovery story");
    await userActions.click(
      within(editDialog).getByRole("button", { name: "Save revision" }),
    );

    expect(
      await screen.findByText("Editing is paused during review"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/wait until the review is resolved/i),
    ).toBeInTheDocument();
    expect(
      within(editDialog).getByRole("textbox", { name: "Title" }),
    ).toHaveValue("Updated recovery story");
    expect(apiMocks.patchArtifact).toHaveBeenCalledTimes(1);
  });

  it("opens a workflow-linked artifact and marks it as an AI-generated draft", async () => {
    const workflowArtifact = makeArtifact("workflow-artifact", {
      title: "Generated recovery story",
    });
    apiMocks.listArtifacts.mockResolvedValue({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
    });
    apiMocks.findArtifactById.mockResolvedValue(workflowArtifact);
    renderWorkspace(
      "/app/projects/project-1/artifacts?artifactId=workflow-artifact&source=workflow",
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("AI-generated draft")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", {
        name: "Generated recovery story",
      }),
    ).toBeInTheDocument();
    expect(apiMocks.findArtifactById).toHaveBeenCalledWith(
      "project-1",
      "workflow-artifact",
      expect.any(AbortSignal),
    );
  });
});
