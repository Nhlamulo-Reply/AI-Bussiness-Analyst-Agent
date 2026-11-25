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
  addDeliveryFeedback,
  createApproval,
  decideApproval,
  getApproval,
  getArtifactApprovalHistory,
  listProjectDeliveryReviews,
  listProjectApprovals,
  withdrawDeliveryFeedback,
} from "./approval-api";
import type {
  ApprovalArtifactType,
  ApprovalStatus,
  CreateApprovalInput,
  DecideApprovalInput,
} from "./approval.schemas";
import type { Project } from "../projects/project.schemas";

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
  histories: (userId: string) =>
    [...approvalKeys.all, userId, "artifact-history"] as const,
  history: (userId: string, artifactType: string, artifactId: string) =>
    [...approvalKeys.histories(userId), artifactType, artifactId] as const,
  dashboard: (userId: string, projectIds: string[]) =>
    [...approvalKeys.all, userId, "dashboard", projectIds] as const,
  deliveryReviews: (userId: string, projectId: string) =>
    [...approvalKeys.all, userId, projectId, "delivery-reviews"] as const,
  deliveryReviewPage: (userId: string, projectId: string, page: number) =>
    [...approvalKeys.deliveryReviews(userId, projectId), page] as const,
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

export function useApprovalDashboard(projects: Project[], enabled = true) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const projectIds = projects.map((project) => project.id);

  return useQuery({
    queryKey: approvalKeys.dashboard(userId ?? "anonymous", projectIds),
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error("Sign in to load approvals.");
      const queues = await Promise.all(
        projects.map(async (project) => {
          const page = await listProjectApprovals(
            {
              projectId: project.id,
              page: 1,
              decision: "pending",
              limit: 1,
            },
            signal,
          );
          return { project, count: page.total };
        }),
      );
      return queues;
    },
    enabled: Boolean(userId && enabled && projects.length),
  });
}

export function useDeliveryReviewDashboard(
  projects: Project[],
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const projectIds = projects.map((project) => project.id);

  return useQuery({
    queryKey: [
      ...approvalKeys.dashboard(userId ?? "anonymous", projectIds),
      "delivery-reviews",
    ],
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error("Sign in to load delivery reviews.");
      const queues = await Promise.all(
        projects.map(async (project) => {
          const page = await listProjectDeliveryReviews(
            { projectId: project.id, page: 1, limit: 1 },
            signal,
          );
          return { project, count: page.total };
        }),
      );
      return queues;
    },
    enabled: Boolean(userId && enabled && projects.length),
  });
}

export function useProjectDeliveryReviews(
  projectId: string,
  page: number,
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: approvalKeys.deliveryReviewPage(
      userId ?? "anonymous",
      projectId,
      page,
    ),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load delivery reviews.");
      return listProjectDeliveryReviews({ projectId, page }, signal);
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

export function useArtifactApprovalHistory(
  artifactType: ApprovalArtifactType,
  artifactId: string,
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: approvalKeys.history(
      userId ?? "anonymous",
      artifactType,
      artifactId,
    ),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load review history.");
      return getArtifactApprovalHistory(artifactType, artifactId, signal);
    },
    enabled: Boolean(userId && artifactId && enabled),
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
          queryKey: approvalKeys.histories(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: requirementKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: artifactKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: approvalKeys.histories(userId),
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

export function useAddDeliveryFeedback(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: ({
      approvalId,
      comments,
    }: {
      approvalId: string;
      comments: string;
    }) => addDeliveryFeedback(approvalId, comments),
    onSuccess: async (approval) => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: approvalKeys.deliveryReviews(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: approvalKeys.detail(userId, approval.id),
        }),
        queryClient.invalidateQueries({
          queryKey: approvalKeys.histories(userId),
        }),
      ]);
    },
    retry: false,
  });
}

export function useWithdrawDeliveryFeedback(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: ({
      approvalId,
      feedbackId,
    }: {
      approvalId: string;
      feedbackId: string;
    }) => withdrawDeliveryFeedback(approvalId, feedbackId),
    onSuccess: async (approval) => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: approvalKeys.deliveryReviews(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: approvalKeys.detail(userId, approval.id),
        }),
        queryClient.invalidateQueries({
          queryKey: approvalKeys.histories(userId),
        }),
      ]);
    },
    retry: false,
  });
}
