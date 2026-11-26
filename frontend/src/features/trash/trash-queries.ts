import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  listTrash,
  moveResourceToTrash,
  permanentlyDeleteTrashResource,
  restoreTrashResource,
} from "./trash-api";
import type { TrashResourceType } from "./trash.schemas";

export const trashKeys = {
  all: ["trash"] as const,
  list: (userId: string, page: number, limit: number) =>
    [...trashKeys.all, userId, { page, limit }] as const,
};

async function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries();
}

export function useTrash(page: number, limit: number) {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: trashKeys.list(userId ?? "anonymous", page, limit),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load the bin.");
      return listTrash(page, limit, signal);
    },
    enabled: Boolean(userId),
  });
}

export function useMoveToTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
    }: {
      resourceType: TrashResourceType;
      resourceId: string;
    }) => moveResourceToTrash(resourceType, resourceId),
    onSuccess: () => invalidateWorkspace(queryClient),
    retry: false,
  });
}

export function useRestoreFromTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
    }: {
      resourceType: TrashResourceType;
      resourceId: string;
    }) => restoreTrashResource(resourceType, resourceId),
    onSuccess: () => invalidateWorkspace(queryClient),
    retry: false,
  });
}

export function usePermanentlyDeleteFromTrash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
      confirmation,
      reason,
    }: {
      resourceType: TrashResourceType;
      resourceId: string;
      confirmation: string;
      reason: string;
    }) =>
      permanentlyDeleteTrashResource(
        resourceType,
        resourceId,
        confirmation,
        reason,
      ),
    onSuccess: () => invalidateWorkspace(queryClient),
    retry: false,
  });
}
