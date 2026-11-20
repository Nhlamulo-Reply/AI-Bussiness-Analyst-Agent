import { apiRequest, apiUpload } from "../../lib/api-client";
import {
  documentListSchema,
  documentMetadataSchema,
  type DocumentMetadata,
} from "./document.schemas";

export function listProjectDocuments(projectId: string, signal?: AbortSignal) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/documents`, {
    auth: "required",
    schema: documentListSchema,
    signal,
  });
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
