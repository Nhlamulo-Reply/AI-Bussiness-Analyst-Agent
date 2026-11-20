import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  createArtifact,
  findArtifactById,
  listArtifactVersions,
  listArtifacts,
  patchArtifact,
} from "./artifact-api";
import type {
  ArtifactType,
  CreateArtifactInput,
  PatchArtifactInput,
} from "./artifact.schemas";

export const artifactPageSize = 12;

export const artifactKeys = {
  all: ["artifacts"] as const,
  lists: (userId: string, projectId: string) =>
    [...artifactKeys.all, userId, projectId, "list"] as const,
  versionLists: (userId: string) =>
    [...artifactKeys.all, userId, "versions"] as const,
  list: (userId: string, projectId: string, page: number, limit: number) =>
    [...artifactKeys.lists(userId, projectId), { page, limit }] as const,
  byId: (userId: string, projectId: string, artifactId: string) =>
    [...artifactKeys.all, userId, projectId, "by-id", artifactId] as const,
  versions: (userId: string, artifactId: string, type: ArtifactType) =>
    [...artifactKeys.versionLists(userId), type, artifactId] as const,
};

export function useArtifacts(
  projectId: string,
  page: number,
  limit = artifactPageSize,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: artifactKeys.list(userId ?? "anonymous", projectId, page, limit),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load project artifacts.");
      return listArtifacts({ projectId, page, limit, signal });
    },
    enabled: Boolean(userId && projectId),
    placeholderData: keepPreviousData,
  });
}

export function useArtifactById(projectId: string, artifactId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: artifactKeys.byId(userId ?? "anonymous", projectId, artifactId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load this artifact.");
      return findArtifactById(projectId, artifactId, signal);
    },
    enabled: Boolean(userId && projectId && artifactId),
    retry: false,
  });
}

export function useArtifactVersions(artifactId: string, type: ArtifactType) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: artifactKeys.versions(userId ?? "anonymous", artifactId, type),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load artifact history.");
      return listArtifactVersions(artifactId, type, signal);
    },
    enabled: Boolean(userId && artifactId),
  });
}

export function useCreateArtifact(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: CreateArtifactInput) =>
      createArtifact(projectId, input),
    onSuccess: async () => {
      if (!userId) return;
      await queryClient.invalidateQueries({
        queryKey: artifactKeys.lists(userId, projectId),
      });
    },
    retry: false,
  });
}

export function usePatchArtifact(projectId: string, artifactId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: PatchArtifactInput) => patchArtifact(artifactId, input),
    onSuccess: async () => {
      if (!userId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: artifactKeys.lists(userId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: artifactKeys.byId(userId, projectId, artifactId),
        }),
        queryClient.invalidateQueries({
          queryKey: artifactKeys.versionLists(userId),
        }),
      ]);
    },
    retry: false,
  });
}
