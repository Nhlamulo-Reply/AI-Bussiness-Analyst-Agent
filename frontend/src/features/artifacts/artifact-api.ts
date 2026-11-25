import { apiRequest } from "../../lib/api-client";
import {
  artifactPageSchema,
  artifactSchema,
  artifactVersionListSchema,
  type ArtifactPage,
  type ArtifactType,
  type CreateArtifactInput,
  type PatchArtifactInput,
} from "./artifact.schemas";

interface ArtifactListParams {
  projectId: string;
  page: number;
  limit: number;
  type?: ArtifactType;
  signal?: AbortSignal;
}

const maxArtifactLookupPages = 20;

export function listArtifacts({
  projectId,
  page,
  limit,
  type,
  signal,
}: ArtifactListParams): Promise<ArtifactPage> {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (type) search.set("type", type);
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/artifacts?${search}`,
    {
      auth: "required",
      schema: artifactPageSchema,
      signal,
    },
  );
}

export async function findArtifactById(
  projectId: string,
  artifactId: string,
  signal?: AbortSignal,
) {
  const firstPage = await listArtifacts({
    projectId,
    page: 1,
    limit: 100,
    signal,
  });
  const match = firstPage.items.find((artifact) => artifact.id === artifactId);
  if (match) return match;

  const pageCount = Math.ceil(firstPage.total / firstPage.limit);
  const firstScannedPage = Math.max(2, pageCount - maxArtifactLookupPages + 1);
  for (let page = pageCount; page >= firstScannedPage; page -= 1) {
    if (signal?.aborted) {
      throw new DOMException("The request was cancelled.", "AbortError");
    }
    const result = await listArtifacts({
      projectId,
      page,
      limit: firstPage.limit,
      signal,
    });
    const artifact = result.items.find((item) => item.id === artifactId);
    if (artifact) return artifact;
  }
  return null;
}

export function createArtifact(projectId: string, input: CreateArtifactInput) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/artifacts`, {
    method: "POST",
    auth: "required",
    json: input,
    schema: artifactSchema,
  });
}

export function patchArtifact(artifactId: string, input: PatchArtifactInput) {
  return apiRequest(`/artifacts/${encodeURIComponent(artifactId)}`, {
    method: "PATCH",
    auth: "required",
    json: input,
    schema: artifactSchema,
  });
}

export function listArtifactVersions(
  artifactId: string,
  type: ArtifactType,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({ type });
  return apiRequest(
    `/artifacts/${encodeURIComponent(artifactId)}/versions?${search}`,
    {
      auth: "required",
      schema: artifactVersionListSchema,
      signal,
    },
  );
}
