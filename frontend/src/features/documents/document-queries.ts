import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  archiveProjectDocument,
  listProjectDocuments,
  restoreProjectDocument,
  uploadProjectDocument,
} from "./document-api";
import type { DocumentMetadata } from "./document.schemas";

interface UploadDocumentVariables {
  file: File;
  signal?: AbortSignal;
}

export const documentKeys = {
  all: ["documents"] as const,
  lists: (userId: string) => [...documentKeys.all, userId, "list"] as const,
  list: (userId: string, projectId: string, includeArchived = false) =>
    includeArchived
      ? ([
          ...documentKeys.lists(userId),
          projectId,
          { includeArchived },
        ] as const)
      : ([...documentKeys.lists(userId), projectId] as const),
};

export function useProjectDocuments(
  projectId: string,
  includeArchived = false,
) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: documentKeys.list(
      userId ?? "anonymous",
      projectId,
      includeArchived,
    ),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load project documents.");
      return listProjectDocuments(projectId, includeArchived, signal);
    },
    enabled: Boolean(userId && projectId),
  });
}

export function useUploadProjectDocument(
  projectId: string,
  onProgress: (progress: number) => void,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: ({ file, signal }: UploadDocumentVariables) =>
      uploadProjectDocument(projectId, file, onProgress, signal),
    onSuccess: async (document) => {
      if (!userId) return;
      const queryKey = documentKeys.list(userId, projectId);
      queryClient.setQueryData<DocumentMetadata[]>(queryKey, (documents) =>
        documents ? [...documents, document] : documents,
      );
      await queryClient.invalidateQueries({
        queryKey: documentKeys.lists(userId),
      });
    },
    retry: false,
  });
}

function useDocumentLifecycleMutation(
  projectId: string,
  action: typeof archiveProjectDocument | typeof restoreProjectDocument,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (documentId: string) => action(projectId, documentId),
    onSuccess: async () => {
      if (!userId) return;
      await queryClient.invalidateQueries({
        queryKey: documentKeys.lists(userId),
      });
    },
    retry: false,
  });
}

export function useArchiveProjectDocument(projectId: string) {
  return useDocumentLifecycleMutation(projectId, archiveProjectDocument);
}

export function useRestoreProjectDocument(projectId: string) {
  return useDocumentLifecycleMutation(projectId, restoreProjectDocument);
}
