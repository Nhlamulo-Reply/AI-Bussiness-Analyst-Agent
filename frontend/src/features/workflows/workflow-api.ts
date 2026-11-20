import { apiRequest } from "../../lib/api-client";
import {
  executionSchema,
  workflowArtifactPageSchema,
  type Execution,
  type WorkflowArtifactPage,
  type WorkflowJob,
  type WorkflowName,
} from "./workflow.schemas";

const workflowEndpointByName: Record<WorkflowName, string> = {
  "requirements-analysis": "/requirements/analyze",
  "requirements-extraction": "/requirements/extract",
  "story-generation": "/stories/generate",
  "acceptance-criteria-generation": "/acceptance-criteria/generate",
  "requirements-validation": "/requirements/validate",
  "risk-analysis": "/risks/analyze",
  "roadmap-generation": "/roadmap/generate",
};

interface ListWorkflowArtifactsParams {
  projectId: string;
  page: number;
  limit: number;
  signal?: AbortSignal;
}

export function listWorkflowArtifacts({
  projectId,
  page,
  limit,
  signal,
}: ListWorkflowArtifactsParams): Promise<WorkflowArtifactPage> {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/artifacts?${search}`,
    {
      auth: "required",
      schema: workflowArtifactPageSchema,
      signal,
    },
  );
}

export function submitWorkflow(
  workflowName: WorkflowName,
  input: WorkflowJob,
): Promise<Execution> {
  return apiRequest(workflowEndpointByName[workflowName], {
    method: "POST",
    auth: "required",
    json: input,
    schema: executionSchema,
  });
}

export function getWorkflowExecution(
  executionId: string,
  signal?: AbortSignal,
): Promise<Execution> {
  return apiRequest(`/executions/${encodeURIComponent(executionId)}`, {
    auth: "required",
    schema: executionSchema,
    signal,
  });
}
