import { apiRequest } from "../../lib/api-client";
import {
  trashPageSchema,
  trashResourceSchema,
  type TrashResourceType,
} from "./trash.schemas";

export function listTrash(
  page: number,
  limit: number,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest(`/trash?${search}`, {
    auth: "required",
    schema: trashPageSchema,
    signal,
  });
}

export function moveResourceToTrash(
  resourceType: TrashResourceType,
  resourceId: string,
) {
  return apiRequest(
    `/trash/${resourceType}/${encodeURIComponent(resourceId)}`,
    {
      method: "DELETE",
      auth: "required",
      schema: trashResourceSchema,
    },
  );
}

export function restoreTrashResource(
  resourceType: TrashResourceType,
  resourceId: string,
) {
  return apiRequest(
    `/trash/${resourceType}/${encodeURIComponent(resourceId)}/restore`,
    {
      method: "PATCH",
      auth: "required",
      schema: trashResourceSchema,
    },
  );
}

export function permanentlyDeleteTrashResource(
  resourceType: TrashResourceType,
  resourceId: string,
  confirmation: string,
  reason: string,
) {
  return apiRequest(
    `/trash/${resourceType}/${encodeURIComponent(resourceId)}/purge`,
    {
      method: "DELETE",
      auth: "required",
      json: { confirmation, reason },
      schema: trashResourceSchema,
    },
  );
}
