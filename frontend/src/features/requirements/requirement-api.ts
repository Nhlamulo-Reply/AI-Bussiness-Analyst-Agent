import { apiRequest } from "../../lib/api-client";
import {
  requirementPageSchema,
  requirementSchema,
  requirementVersionListSchema,
  type CreateRequirementInput,
  type PatchRequirementInput,
} from "./requirement.schemas";

interface RequirementListParams {
  projectId: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}

export function listRequirements({
  projectId,
  page,
  limit,
  signal,
}: RequirementListParams) {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/requirements?${search}`,
    {
      auth: "required",
      schema: requirementPageSchema,
      signal,
    },
  );
}

export function createRequirement(
  projectId: string,
  input: CreateRequirementInput,
) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/requirements`, {
    method: "POST",
    auth: "required",
    json: input,
    schema: requirementSchema,
  });
}

export function patchRequirement(
  requirementId: string,
  input: PatchRequirementInput,
) {
  return apiRequest(`/requirements/${encodeURIComponent(requirementId)}`, {
    method: "PATCH",
    auth: "required",
    json: input,
    schema: requirementSchema,
  });
}

export function listRequirementVersions(
  requirementId: string,
  signal?: AbortSignal,
) {
  return apiRequest(
    `/requirements/${encodeURIComponent(requirementId)}/versions`,
    {
      auth: "required",
      schema: requirementVersionListSchema,
      signal,
    },
  );
}
