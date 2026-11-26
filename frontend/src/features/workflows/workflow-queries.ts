import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../../lib/api-client";
import {
  getWorkflowExecution,
  listWorkflowArtifacts,
  submitWorkflow,
} from "./workflow-api";
import type {
  Execution,
  WorkflowArtifactPage,
  WorkflowJob,
  WorkflowName,
} from "./workflow.schemas";

export const workflowArtifactPageSize = 100;
export const workflowExecutionPollIntervalMs = 2_000;
export const workflowExecutionMaxPollDurationMs = 5 * 60_000;

export function getWorkflowExecutionPollDelay(
  execution: Execution | undefined,
  error: unknown,
  now = Date.now(),
): number | false {
  if (
    !execution ||
    execution.status === "completed" ||
    execution.status === "failed" ||
    (error instanceof ApiError && [401, 403, 404].includes(error.status))
  ) {
    return false;
  }

  const remaining =
    Date.parse(execution.createdAt) + workflowExecutionMaxPollDurationMs - now;
  if (remaining <= 0) return false;

  const retryAfterMs =
    error instanceof ApiError ? error.retryAfterMs : undefined;
  const interval = retryAfterMs
    ? Math.max(workflowExecutionPollIntervalMs, retryAfterMs)
    : workflowExecutionPollIntervalMs;
  return Math.min(remaining, interval);
}

export const workflowKeys = {
  all: ["workflows"] as const,
  artifactLists: (userId: string, projectId: string) =>
    [...workflowKeys.all, userId, projectId, "artifacts"] as const,
  artifacts: (userId: string, projectId: string, page: number, limit: number) =>
    [
      ...workflowKeys.artifactLists(userId, projectId),
      { page, limit },
    ] as const,
  execution: (userId: string, projectId: string, executionId: string) =>
    [...workflowKeys.all, userId, projectId, "execution", executionId] as const,
};

export function useWorkflowArtifacts(
  projectId: string,
  page = 1,
  limit = workflowArtifactPageSize,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: workflowKeys.artifacts(
      userId ?? "anonymous",
      projectId,
      page,
      limit,
    ),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load project artifacts.");
      return listWorkflowArtifacts({ projectId, page, limit, signal });
    },
    enabled: Boolean(userId && projectId),
    placeholderData: keepPreviousData,
  });
}

export function useSubmitWorkflow(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: ({
      workflowName,
      input,
    }: {
      workflowName: WorkflowName;
      input: WorkflowJob;
    }) => submitWorkflow(workflowName, input),
    onSuccess: (execution) => {
      if (!userId) return;
      queryClient.setQueryData(
        workflowKeys.execution(userId, projectId, execution.id),
        execution,
      );
    },
    retry: false,
  });
}

export function useWorkflowExecution(
  projectId: string,
  initialExecution?: Execution,
) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const executionId = initialExecution?.id;

  return useQuery({
    queryKey: workflowKeys.execution(
      userId ?? "anonymous",
      projectId,
      executionId ?? "none",
    ),
    queryFn: ({ signal }) => {
      if (!userId || !executionId) {
        throw new Error("A workflow execution is required.");
      }
      return getWorkflowExecution(executionId, signal);
    },
    enabled: Boolean(userId && projectId && executionId),
    initialData: initialExecution,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) =>
      getWorkflowExecutionPollDelay(
        query.state.data ?? initialExecution,
        query.state.error,
      ),
  });
}

export type { WorkflowArtifactPage };
