import { apiRequest } from "../../lib/api-client";
import {
  approvalDetailSchema,
  approvalPageSchema,
  approvalSchema,
  type ApprovalStatus,
  type CreateApprovalInput,
  type DecideApprovalInput,
} from "./approval.schemas";

export const approvalPageSize = 12;

export function listProjectApprovals(
  {
    projectId,
    page,
    decision,
  }: {
    projectId: string;
    page: number;
    decision?: ApprovalStatus;
  },
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(approvalPageSize),
  });
  if (decision) search.set("decision", decision);

  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/approvals?${search}`,
    {
      method: "GET",
      auth: "required",
      signal,
      schema: approvalPageSchema,
    },
  );
}

export function getApproval(approvalId: string, signal?: AbortSignal) {
  return apiRequest(`/approvals/${encodeURIComponent(approvalId)}`, {
    method: "GET",
    auth: "required",
    signal,
    schema: approvalDetailSchema,
  });
}

export function createApproval(input: CreateApprovalInput) {
  return apiRequest("/approvals", {
    method: "POST",
    auth: "required",
    json: input,
    schema: approvalSchema,
  });
}

export function decideApproval(approvalId: string, input: DecideApprovalInput) {
  return apiRequest(`/approvals/${encodeURIComponent(approvalId)}`, {
    method: "PATCH",
    auth: "required",
    json: input,
    schema: approvalSchema,
  });
}

export function addDeliveryFeedback(approvalId: string, comments: string) {
  return apiRequest(
    `/approvals/${encodeURIComponent(approvalId)}/delivery-feedback`,
    {
      method: "POST",
      auth: "required",
      json: { comments },
      schema: approvalSchema,
    },
  );
}
