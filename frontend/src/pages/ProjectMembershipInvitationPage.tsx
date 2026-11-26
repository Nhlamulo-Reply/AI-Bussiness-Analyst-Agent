import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useAuth } from "../features/auth/useAuth";
import {
  getProjectMembershipInvitation,
  respondToProjectMembershipInvitation,
} from "../features/projects/project-membership-invitation-api";
import { getApiErrorPresentation } from "../lib/api-client";

const statusLabels = {
  pending: "Awaiting your response",
  accepted: "Invitation accepted",
  rejected: "Invitation declined",
  cancelled: "Invitation cancelled",
} as const;

export function ProjectMembershipInvitationPage() {
  const { invitationId = "" } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? "anonymous";
  const invitationKey = [
    "project-membership-invitation",
    userId,
    invitationId,
  ] as const;
  const invitationQuery = useQuery({
    queryKey: invitationKey,
    queryFn: ({ signal }) => {
      if (!session?.user.id) {
        throw new Error("Sign in to review this invitation.");
      }
      return getProjectMembershipInvitation(invitationId, signal);
    },
    enabled: Boolean(session?.user.id && invitationId),
    retry: false,
  });
  const responseMutation = useMutation({
    mutationFn: (decision: "accepted" | "rejected") =>
      respondToProjectMembershipInvitation(invitationId, decision),
    onSuccess: async (result) => {
      queryClient.setQueryData(
        invitationKey,
        (current: typeof invitationQuery.data) =>
          current
            ? { ...current, invitation: result.invitation }
            : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
      ]);
    },
    retry: false,
  });

  const invitationError = invitationQuery.error
    ? getApiErrorPresentation(
        invitationQuery.error,
        "The project invitation could not be loaded.",
      )
    : undefined;
  const responseError = responseMutation.error
    ? getApiErrorPresentation(
        responseMutation.error,
        "Your response could not be recorded.",
      )
    : undefined;
  const details = invitationQuery.data;
  const invitation = details?.invitation;

  return (
    <section
      aria-labelledby="project-invitation-title"
      className="approval-page"
    >
      <header className="page-heading">
        <div>
          <p className="eyebrow">PROJECT MEMBERSHIP</p>
          <h1 id="project-invitation-title">Project invitation</h1>
          <p className="page-heading__description">
            Review the invitation and choose whether to join this project.
          </p>
        </div>
      </header>
      <Card>
        {invitationQuery.isPending ? (
          <div aria-busy="true" role="status">
            <LoadingSkeleton lines={3} />
          </div>
        ) : invitationError ? (
          <ErrorPanel
            message={invitationError.message}
            requestId={invitationError.requestId}
            title="Invitation unavailable"
          />
        ) : details && invitation ? (
          <div className="approval-page__detail-content">
            <h2>{details.project.name}</h2>
            <p>{statusLabels[invitation.status]}</p>
            {invitation.status === "pending" ? (
              <>
                <p>
                  Accepting grants your account project membership. Declining
                  leaves your existing access unchanged.
                </p>
                <div className="approval-page__actions">
                  <Button
                    disabled={responseMutation.isPending}
                    leadingIcon={<Check aria-hidden="true" size={15} />}
                    onClick={() => responseMutation.mutate("accepted")}
                    type="button"
                  >
                    Accept invitation
                  </Button>
                  <Button
                    disabled={responseMutation.isPending}
                    leadingIcon={<X aria-hidden="true" size={15} />}
                    onClick={() => responseMutation.mutate("rejected")}
                    type="button"
                    variant="secondary"
                  >
                    Decline invitation
                  </Button>
                </div>
              </>
            ) : invitation.status === "accepted" ? (
              <Link
                className="button button--primary button--medium"
                to={`/app/projects/${encodeURIComponent(details.project.id)}`}
              >
                Open project
              </Link>
            ) : (
              <EmptyState
                title="No action is available"
                description="This invitation has already been resolved."
              />
            )}
            {responseError ? (
              <ErrorPanel
                message={responseError.message}
                requestId={responseError.requestId}
                title="Response unsuccessful"
              />
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="Invitation unavailable"
            description="This invitation could not be found."
          />
        )}
      </Card>
    </section>
  );
}
