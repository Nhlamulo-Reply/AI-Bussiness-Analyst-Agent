import { apiRequest, apiUpload } from "../../lib/api-client";
import {
  documentListSchema,
  documentMetadataSchema,
  type DocumentMetadata,
} from "./document.schemas";

export function listProjectDocuments(
  projectId: string,
  includeArchived = false,
  signal?: AbortSignal,
) {
  const search = includeArchived ? "?includeArchived=true" : "";
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/documents${search}`,
    {
      auth: "required",
      schema: documentListSchema,
      signal,
    },
  );
}

export function archiveProjectDocument(projectId: string, documentId: string) {
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/archive`,
    {
      method: "PATCH",
      auth: "required",
      schema: documentMetadataSchema,
    },
  );
}

export function restoreProjectDocument(projectId: string, documentId: string) {
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/restore`,
    {
      method: "PATCH",
      auth: "required",
      schema: documentMetadataSchema,
    },
  );
}

export function uploadProjectDocument(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<DocumentMetadata> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiUpload(
    `/projects/${encodeURIComponent(projectId)}/documents`,
    formData,
    {
      schema: documentMetadataSchema,
      onProgress,
      signal,
    },
  );
}
