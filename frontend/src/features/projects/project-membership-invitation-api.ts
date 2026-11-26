import { z } from "zod";
import { apiRequest } from "../../lib/api-client";

const invitationSchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    invitedUserId: z.string().min(1),
    invitedByUserId: z.string().min(1),
    status: z.enum(["pending", "accepted", "rejected", "cancelled"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    respondedAt: z.iso.datetime().optional(),
  })
  .strict()
  .superRefine((invitation, context) => {
    if (
      (invitation.status === "pending") !==
      (invitation.respondedAt === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["respondedAt"],
        message: "Invitation response metadata is inconsistent.",
      });
    }
  });

const invitationDetailsSchema = z
  .object({
    invitation: invitationSchema,
    project: z
      .object({ id: z.string().min(1), name: z.string().min(1) })
      .strict(),
  })
  .strict();

const invitationResponseSchema = z
  .object({ invitation: invitationSchema })
  .strict();

export function getProjectMembershipInvitation(
  invitationId: string,
  signal?: AbortSignal,
) {
  return apiRequest(
    `/project-membership-invitations/${encodeURIComponent(invitationId)}`,
    {
      auth: "required",
      schema: invitationDetailsSchema,
      signal,
    },
  );
}

export function respondToProjectMembershipInvitation(
  invitationId: string,
  decision: "accepted" | "rejected",
) {
  return apiRequest(
    `/project-membership-invitations/${encodeURIComponent(invitationId)}/respond`,
    {
      method: "POST",
      auth: "required",
      json: { decision },
      schema: invitationResponseSchema,
    },
  );
}
