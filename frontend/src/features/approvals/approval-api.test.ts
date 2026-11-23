import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setSession } from "../../lib/auth-store";
import {
  createApproval,
  decideApproval,
  getApproval,
  listProjectApprovals,
} from "./approval-api";

const approval = {
  id: "approval-1",
  projectId: "project-1",
  artifactType: "requirement" as const,
  artifactId: "requirement-1",
  submittedByUserId: "user-1",
  decision: "pending" as const,
  comments: "Please review.",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

const requirement = {
  id: "requirement-1",
  projectId: "project-1",
  title: "Business requirement",
  description: "A reviewed description.",
  type: "business" as const,
  status: "draft" as const,
  priority: "high" as const,
  sourceFacts: [],
  assumptions: [],
  openQuestions: [],
  traceability: { documentIds: [] },
  version: 1,
  createdByUserId: "user-1",
  createdAt: "2026-11-23T07:00:00.000Z",
  updatedAt: "2026-11-23T07:00:00.000Z",
};

describe("approval API", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    setSession({
      accessToken: "test-token",
      user: {
        id: "user-1",
        email: "analyst@example.com",
        roles: ["user"],
      },
    });
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the review submission and validates the returned approval", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: approval,
        requestId: "request-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createApproval({
        projectId: "project-1",
        artifactType: "requirement",
        artifactId: "requirement-1",
        comments: "Please review.",
      }),
    ).resolves.toEqual(approval);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/approvals");
    expect(options.method).toBe("POST");
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(options.body))).toEqual({
      projectId: "project-1",
      artifactType: "requirement",
      artifactId: "requirement-1",
      comments: "Please review.",
    });
  });

  it("lists, reads, and decides approvals through authenticated endpoints", async () => {
    const updatedApproval = { ...approval, decision: "approved" as const };
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options: RequestInit) => {
        const data =
          options.method === "PATCH"
            ? updatedApproval
            : options.method === "GET" && String(_url).includes("/approvals?")
              ? { items: [approval], page: 1, limit: 12, total: 1 }
              : { approval, resource: requirement };
        return Promise.resolve(
          Response.json({
            success: true,
            data,
            requestId: "request-2",
          }),
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listProjectApprovals({
        projectId: "project-1",
        page: 1,
        decision: "pending",
      }),
    ).resolves.toMatchObject({ items: [approval], total: 1 });
    await expect(getApproval("approval-1")).resolves.toMatchObject({
      approval,
      resource: { title: "Business requirement" },
    });
    await expect(
      decideApproval("approval-1", {
        decision: "approved",
        comments: "Looks good.",
      }),
    ).resolves.toEqual(updatedApproval);

    expect(
      fetchMock.mock.calls.map(([url, options]) => [url, options.method]),
    ).toEqual([
      [
        "/api/v1/projects/project-1/approvals?page=1&limit=12&decision=pending",
        "GET",
      ],
      ["/api/v1/approvals/approval-1", "GET"],
      ["/api/v1/approvals/approval-1", "PATCH"],
    ]);
    expect(
      new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization"),
    ).toBe("Bearer test-token");
    expect(fetchMock.mock.calls[2][1].body).toBe(
      JSON.stringify({ decision: "approved", comments: "Looks good." }),
    );
  });
});
