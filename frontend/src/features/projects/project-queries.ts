import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
} from "./project-api";
import type { CreateProjectInput } from "./project.schemas";

export const projectKeys = {
  all: ["projects"] as const,
  lists: (userId: string) => [...projectKeys.all, userId, "list"] as const,
  list: (userId: string, page: number, limit: number) =>
    [...projectKeys.lists(userId), { page, limit }] as const,
  detail: (userId: string, projectId: string) =>
    [...projectKeys.all, userId, "detail", projectId] as const,
};

export function useProjects(page: number, limit: number) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: projectKeys.list(userId ?? "anonymous", page, limit),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load projects.");
      return listProjects({ page, limit, signal });
    },
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

export function useProject(projectId: string) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: projectKeys.detail(userId ?? "anonymous", projectId),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load this project.");
      return getProject(projectId, signal);
    },
    enabled: Boolean(userId && projectId),
  });
}

export function useCreateProject() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      if (!userId) return;
      queryClient.setQueryData(projectKeys.detail(userId, project.id), project);
      void queryClient.invalidateQueries({
        queryKey: projectKeys.lists(userId),
      });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: CreateProjectInput) => updateProject(projectId, input),
    onSuccess: async (project) => {
      if (!userId) return;
      queryClient.setQueryData(projectKeys.detail(userId, project.id), project);
      await queryClient.invalidateQueries({
        queryKey: projectKeys.lists(userId),
      });
    },
  });
}
