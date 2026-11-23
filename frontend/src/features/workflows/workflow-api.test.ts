import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../auth/auth.schemas";
import { clearSession, setSession } from "../../lib/auth-store";
import {
  getWorkflowExecution,
  listWorkflowArtifacts,
  submitWorkflow,
} from "./workflow-api";
import type { Execution, WorkflowName } from "./workflow.schemas";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

const execution: Execution = {
  id: "execution-1",
  projectId: "project-1",
  workflowName: "requirements-analysis",
  status: "queued",
  nodeStates: [],
  createdByUserId: user.id,
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

const workflowEndpoints: Array<[WorkflowName, string]> = [
  ["requirements-analysis", "/requirements/analyze"],
  ["requirements-extraction", "/requirements/extract"],
  ["story-generation", "/stories/generate"],
  ["acceptance-criteria-generation", "/acceptance-criteria/generate"],
  ["requirements-validation", "/requirements/validate"],
  ["risk-analysis", "/risks/analyze"],
  ["roadmap-generation", "/roadmap/generate"],
];

describe("workflow API", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: execution,
          requestId: "request-workflow",
        }),
      ),
    );
    setSession({ accessToken: "test-token", user });
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(workflowEndpoints)(
    "submits %s to its verified endpoint without adding unsupported fields",
    async (workflowName, endpoint) => {
      await submitWorkflow(workflowName, { projectId: "project-1" });

      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(`/api/v1${endpoint}`);
      expect(options?.method).toBe("POST");
      expect(JSON.parse(String(options?.body))).toEqual({
        projectId: "project-1",
      });
    },
  );

  it("requests a paginated artifact page for story selection", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        data: { items: [], page: 1, limit: 100, total: 0 },
      }),
    );

    await expect(
      listWorkflowArtifacts({ projectId: "project-1", page: 1, limit: 100 }),
    ).resolves.toEqual({ items: [], page: 1, limit: 100, total: 0 });

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/projects/project-1/artifacts?page=1&limit=100",
    );
  });

  it("loads an execution using its encoded ID", async () => {
    await getWorkflowExecution("execution/one");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/executions/execution%2Fone",
    );
  });
});
