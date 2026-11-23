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
import type { Requirement } from "../features/requirements/requirement.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { CreateRequirementRoute } from "./CreateRequirementPage";
import { RequirementListRoute } from "./RequirementListPage";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

const sourceDocument = {
  id: "document-1",
  projectId: "project-1",
  uploadedByUserId: "user-1",
  fileName: "account-policy.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1200,
  status: "uploaded",
  createdAt: "2026-03-01T09:00:00.000Z",
};

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: "requirement-1",
    projectId: "project-1",
    title: "Verify account ownership",
    description: "Confirm the user can access their current email.",
    type: "functional",
    status: "draft",
    priority: "medium",
    sourceFacts: ["Email changes require verification."],
    assumptions: [],
    openQuestions: [],
    traceability: { documentIds: ["document-1"] },
    version: 1,
    createdByUserId: "user-1",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(data: unknown) {
  return Promise.resolve(
    Response.json({
      success: true,
      data,
      requestId: "request-test",
    }),
  );
}

function renderRequirements(initialEntry: string) {
  setSession({ accessToken: "test-token", user });
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
  const firstPage = Array.from({ length: 12 }, (_, index) =>
    makeRequirement({
      id: `requirement-${index + 1}`,
      title: `Requirement ${index + 1}`,
      status: index === 1 ? "approved" : "draft",
      traceability: { documentIds: [] },
    }),
  );
  let createdRequirement: Requirement | undefined;
  const versionHistory: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/auth/me")) {
        return jsonResponse({ user });
      }
      if (url.endsWith("/projects/project-1/documents")) {
        return jsonResponse([sourceDocument]);
      }
      if (url.includes("/requirements?")) {
        const requestUrl = new URL(url, "http://localhost");
        const page = requestUrl.searchParams.get("page");
        if (page === "2") {
          return jsonResponse({
            items: createdRequirement ? [createdRequirement] : [],
            page: 2,
            limit: 12,
            total: 13,
          });
        }
        return jsonResponse({
          items: firstPage,
          page: 1,
          limit: 12,
          total: createdRequirement ? 13 : 12,
        });
      }
      if (url.endsWith("/requirements/requirement-created/versions")) {
        return jsonResponse(versionHistory);
      }
      if (
        url.endsWith("/projects/project-1/requirements") &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body)) as {
          title: string;
          description: string;
          type: Requirement["type"];
          priority: Requirement["priority"];
          sourceFacts: string[];
          assumptions: string[];
          openQuestions: string[];
          documentIds: string[];
        };
        createdRequirement = makeRequirement({
          id: "requirement-created",
          title: body.title,
          description: body.description,
          type: body.type,
          priority: body.priority,
          sourceFacts: body.sourceFacts,
          assumptions: body.assumptions,
          openQuestions: body.openQuestions,
          traceability: { documentIds: body.documentIds },
        });
        return jsonResponse(createdRequirement);
      }
      if (
        url.endsWith("/requirements/requirement-created") &&
        method === "PATCH" &&
        createdRequirement
      ) {
        const body = JSON.parse(String(init?.body)) as Partial<Requirement>;
        versionHistory.push({
          id: "version-1",
          projectId: "project-1",
          artifactType: "requirement",
          artifactId: createdRequirement.id,
          version: createdRequirement.version,
          snapshot: createdRequirement,
          actorUserId: user.id,
          reason: "Requirement edited",
          createdAt: "2026-03-02T10:00:00.000Z",
        });
        createdRequirement = {
          ...createdRequirement,
          ...body,
          status: "draft",
          version: createdRequirement.version + 1,
          updatedAt: "2026-03-02T10:00:00.000Z",
        };
        return jsonResponse(createdRequirement);
      }

      return jsonResponse([]);
    },
  );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/app/projects/:projectId/requirements"
              element={<RequirementListRoute />}
            />
            <Route
              path="/app/projects/:projectId/requirements/new"
              element={<CreateRequirementRoute />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  return { fetchMock };
}

describe("requirements management pages", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
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
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("creates a document-linked requirement, opens its details, and edits into a new draft version", async () => {
    const userActions = userEvent.setup();
    const { fetchMock } = renderRequirements(
      "/app/projects/project-1/requirements/new",
    );

    await screen.findByRole("heading", { name: "Capture a requirement" });
    await screen.findByText("account-policy.pdf");
    await userActions.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Confirm account ownership",
    );
    await userActions.selectOptions(
      screen.getByRole("combobox", { name: "Type" }),
      "business",
    );
    await userActions.type(
      screen.getByRole("textbox", { name: "Source facts" }),
      "Email changes require verification.",
    );
    await userActions.click(
      screen.getByRole("checkbox", { name: /account-policy\.pdf/ }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Create requirement" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Requirement details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Confirm account ownership" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Requirement created as a draft/),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/requirements?page=2&limit=12",
      expect.objectContaining({ credentials: "omit" }),
    );

    await userActions.click(screen.getByRole("button", { name: "Edit" }));
    const titleField = screen.getByRole("textbox", { name: "Title" });
    await userActions.clear(titleField);
    await userActions.type(titleField, "Verify ownership before email changes");
    await userActions.click(
      screen.getByRole("button", { name: "Save changes" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Verify ownership before email changes",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Saved as version 2. This requirement is now a draft.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Version 1")).toBeInTheDocument();

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/requirements/requirement-created") &&
        init?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      title: "Verify ownership before email changes",
    });
  }, 10_000);

  it("filters only the current server page and displays requirement traceability", async () => {
    const userActions = userEvent.setup();
    renderRequirements("/app/projects/project-1/requirements");

    expect(
      await screen.findByText("Requirement 1", { exact: true }),
    ).toBeInTheDocument();
    await userActions.selectOptions(
      screen.getByRole("combobox", {
        name: "Filter requirements by status",
      }),
      "approved",
    );
    expect(
      screen.getByText("Requirement 2", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Requirement 1", { exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Search and filters apply to this page only."),
    ).toBeInTheDocument();

    await userActions.click(screen.getByText("Requirement 2", { exact: true }));
    expect(
      await screen.findByRole("dialog", { name: "Requirement details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Email changes require verification."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No source documents are linked."),
    ).toBeInTheDocument();
  });
});
