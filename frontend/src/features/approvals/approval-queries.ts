import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { artifactKeys } from "../artifacts/artifact-queries";
import { requirementKeys } from "../requirements/requirement-queries";
import {
  approvalPageSize,
  createApproval,
  decideApproval,
  getApproval,
  listProjectApprovals,
} from "./approval-api";
import type {
  ApprovalStatus,
  CreateApprovalInput,
  DecideApprovalInput,
} from "./approval.schemas";

export const approvalKeys = {
  all: ["approvals"] as const,
  lists: (userId: string, projectId: string) =>
    [...approvalKeys.all, userId, projectId, "list"] as const,
  list: (
    userId: string,
    projectId: string,
    page: number,
    decision: ApprovalStatus | "all",
  ) =>
    [
      ...approvalKeys.lists(userId, projectId),
      { page, decision, limit: approvalPageSize },
    ] as const,
  detail: (userId: string, approvalId: string) =>
    [...approvalKeys.all, userId, "detail", approvalId] as const,
};

export { approvalPageSize };

export function useProjectApprovals(
  projectId: string,
  page: number,
  decision: ApprovalStatus | "all",
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: approvalKeys.list(
      userId ?? "anonymous",
      projectId,
      page,
      decision,
    ),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load approvals.");
      return listProjectApprovals(
        {
          projectId,
          page,
          decision: decision === "all" ? undefined : decision,
        },
        signal,
      );
    },
    enabled: Boolean(userId && projectId && enabled),
    placeholderData: keepPreviousData,
  });
}

export function useApprovalDetails(approvalId: string, enabled = true) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: approvalKeys.detail(userId ?? "anonymous", approvalId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load approval details.");
      return getApproval(approvalId, signal);
    },
    enabled: Boolean(userId && approvalId && enabled),
  });
}

export function useDecideApproval(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: ({
      approvalId,
      ...input
    }: DecideApprovalInput & { approvalId: string }) =>
      decideApproval(approvalId, input),
    onSuccess: async (approval) => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: approvalKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: approvalKeys.detail(userId, approval.id),
        }),
        queryClient.invalidateQueries({
          queryKey: requirementKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: artifactKeys.lists(userId, projectId),
        }),
      ]);
    },
    retry: false,
  });
}

type ApprovalSubmission = Omit<CreateApprovalInput, "projectId">;

export function useSubmitApproval(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: ApprovalSubmission) =>
      createApproval({ ...input, projectId }),
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: requirementKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: artifactKeys.lists(userId, projectId),
        }),
      ]);
    },
    retry: false,
  });
}
