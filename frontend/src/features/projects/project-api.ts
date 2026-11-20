import { apiRequest } from "../../lib/api-client";
import {
  projectPageSchema,
  projectSchema,
  type CreateProjectInput,
} from "./project.schemas";

interface ProjectListParams {
  page: number;
  limit: number;
  signal?: AbortSignal;
}

export function listProjects({ page, limit, signal }: ProjectListParams) {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest(`/projects?${search}`, {
    auth: "required",
    schema: projectPageSchema,
    signal,
  });
}

export function getProject(projectId: string, signal?: AbortSignal) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}`, {
    auth: "required",
    schema: projectSchema,
    signal,
  });
}

export function createProject(input: CreateProjectInput) {
  return apiRequest("/projects", {
    method: "POST",
    auth: "required",
    json: input,
    schema: projectSchema,
  });
}
