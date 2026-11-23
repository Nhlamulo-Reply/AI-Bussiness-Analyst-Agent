import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../auth/auth.schemas";
import { clearSession, setSession } from "../../lib/auth-store";
import {
  createArtifact,
  findArtifactById,
  listArtifactVersions,
  listArtifacts,
  patchArtifact,
} from "./artifact-api";
import type { Artifact } from "./artifact.schemas";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

function makeArtifact(id: string): Artifact {
  return {
    id,
    projectId: "project-1",
    type: "story",
    title: `Artifact ${id}`,
    description: "A project deliverable.",
    status: "draft",
    requirementIds: ["requirement-1"],
    data: { priority: "high", nested: { retained: true } },
    version: 1,
    createdByUserId: user.id,
    createdAt: "2026-03-04T05:06:07.000Z",
    updatedAt: "2026-03-04T05:06:07.000Z",
  };
}

describe("artifact API", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    setSession({ accessToken: "test-token", user });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: {
            items: [makeArtifact("artifact-1")],
            page: 2,
            limit: 12,
            total: 25,
          },
        }),
      ),
    );
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the verified project artifact list, create, update, and history routes", async () => {
    await listArtifacts({ projectId: "project-1", page: 2, limit: 12 });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/projects/project-1/artifacts?page=2&limit=12",
    );

    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        data: makeArtifact("artifact-1"),
      }),
    );
    await createArtifact("project-1", {
      type: "story",
      title: "Recover account access",
      description: "Allow account recovery.",
      requirementIds: ["requirement-1"],
      data: { priority: "high" },
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/projects/project-1/artifacts",
    );
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(
      {
        type: "story",
        title: "Recover account access",
        description: "Allow account recovery.",
        requirementIds: ["requirement-1"],
        data: { priority: "high" },
      },
    );

    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        data: makeArtifact("artifact-1"),
      }),
    );
    await patchArtifact("artifact/one", {
      title: "Updated story",
      data: { priority: "low" },
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/artifacts/artifact%2Fone",
    );
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("PATCH");

    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ success: true, data: [] }),
    );
    await listArtifactVersions("artifact-1", "story");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/artifacts/artifact-1/versions?type=story",
    );
  });

  it("finds linked artifacts across server pages without inventing a read endpoint", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const requestUrl = new URL(String(input), "http://localhost");
      const page = Number(requestUrl.searchParams.get("page"));
      return Response.json({
        success: true,
        data: {
          items: page === 2 ? [makeArtifact("new-artifact")] : [],
          page,
          limit: 100,
          total: 145,
        },
      });
    });

    await expect(
      findArtifactById("project-1", "new-artifact"),
    ).resolves.toMatchObject({ id: "new-artifact" });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      "/api/v1/projects/project-1/artifacts?page=2&limit=100",
    );
  });
});
