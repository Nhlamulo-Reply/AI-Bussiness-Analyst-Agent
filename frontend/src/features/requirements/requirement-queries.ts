import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  createRequirement,
  listRequirementVersions,
  listRequirements,
  patchRequirement,
} from "./requirement-api";
import type {
  CreateRequirementInput,
  PatchRequirementInput,
} from "./requirement.schemas";

const requirementPageSize = 12;

export const requirementKeys = {
  all: ["requirements"] as const,
  lists: (userId: string, projectId: string) =>
    [...requirementKeys.all, userId, projectId, "list"] as const,
  list: (userId: string, projectId: string, page: number, limit: number) =>
    [...requirementKeys.lists(userId, projectId), { page, limit }] as const,
  versions: (userId: string, requirementId: string) =>
    [...requirementKeys.all, userId, "versions", requirementId] as const,
};

export { requirementPageSize };

export function useRequirements(
  projectId: string,
  page: number,
  limit = requirementPageSize,
  enabled = true,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: requirementKeys.list(
      userId ?? "anonymous",
      projectId,
      page,
      limit,
    ),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load requirements.");
      return listRequirements({ projectId, page, limit, signal });
    },
    enabled: Boolean(userId && projectId && enabled),
    placeholderData: keepPreviousData,
  });
}

export function useRequirementVersions(requirementId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: requirementKeys.versions(userId ?? "anonymous", requirementId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load version history.");
      return listRequirementVersions(requirementId, signal);
    },
    enabled: Boolean(userId && requirementId),
  });
}

export function useCreateRequirement(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: CreateRequirementInput) =>
      createRequirement(projectId, input),
    onSuccess: async () => {
      if (!userId) return;
      await queryClient.invalidateQueries({
        queryKey: requirementKeys.lists(userId, projectId),
      });
    },
    retry: false,
  });
}

export function usePatchRequirement(projectId: string, requirementId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: PatchRequirementInput) =>
      patchRequirement(requirementId, input),
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: requirementKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: requirementKeys.versions(userId, requirementId),
        }),
      ]);
    },
    retry: false,
  });
}
