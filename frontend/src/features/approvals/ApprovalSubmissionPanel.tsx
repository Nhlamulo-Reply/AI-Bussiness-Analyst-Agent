import { Check, RotateCw, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { TextAreaField } from "../../components/ui/TextAreaField";
import { ApiError, getApiErrorPresentation } from "../../lib/api-client";
import { useSubmitApproval } from "./approval-queries";
import type { Approval, ApprovalArtifactType } from "./approval.schemas";
import { useAuth } from "../auth/useAuth";
import { hasPermission } from "../auth/permissions";

interface ApprovalSubmissionPanelProps {
  projectId: string;
  artifactType: ApprovalArtifactType;
  artifactId: string;
  status:
    | "draft"
    | "submitted"
    | "changes_requested"
    | "reviewed"
    | "approved"
    | "rejected";
}

export function ApprovalSubmissionPanel({
  projectId,
  artifactType,
  artifactId,
  status,
}: ApprovalSubmissionPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [comments, setComments] = useState("");
  const { session } = useAuth();
  const canSubmit = hasPermission(session?.user.roles, "analysis.submit");
  const [submission, setSubmission] = useState<{
    resourceKey: string;
    approval: Approval;
  }>();
  const submitMutation = useSubmitApproval(projectId);
  const resourceKey = `${projectId}:${artifactType}:${artifactId}`;
  const submittedApproval =
    submission?.resourceKey === resourceKey ? submission.approval : undefined;

  if (!canSubmit || status !== "draft") return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMutation.mutate(
      { artifactType, artifactId, comments: comments.trim() },
      {
        onSuccess: (approval) => {
          setSubmission({ resourceKey, approval });
          setFormOpen(false);
        },
      },
    );
  };

  if (submittedApproval) {
    return (
      <section
        aria-label="Review submission status"
        className="approval-submission approval-submission--success"
        role="status"
      >
        <div className="approval-submission__heading">
          <Check aria-hidden="true" size={17} />
          <strong>Submitted for review</strong>
        </div>
        <p>
          This request is pending for a Product Owner's decision. AI agents
          cannot approve it, and the submitter cannot review their own request.
        </p>
        <p>
          Approval ID: <code>{submittedApproval.id}</code>
        </p>
      </section>
    );
  }

  const errorPresentation = getApiErrorPresentation(
    submitMutation.error,
    "This draft couldn't be submitted for review. Please try again.",
  );
  const isConflict =
    submitMutation.error instanceof ApiError &&
    submitMutation.error.status === 409;

  return (
    <section
      aria-label="Submit draft for review"
      className="approval-submission"
    >
      <div className="approval-submission__intro">
        <span aria-hidden="true">
          <ShieldCheck size={17} />
        </span>
        <p>
          A Product Owner makes the human decision. AI agents can prepare drafts
          but cannot approve this request.
        </p>
      </div>
      {!formOpen ? (
        <Button
          leadingIcon={<ShieldCheck aria-hidden="true" size={15} />}
          onClick={() => {
            submitMutation.reset();
            setFormOpen(true);
          }}
          size="small"
          type="button"
          variant="secondary"
        >
          Request review
        </Button>
      ) : (
        <form className="approval-submission__form" onSubmit={handleSubmit}>
          <TextAreaField
            label="Reviewer note (optional)"
            maxLength={4000}
            onChange={(event) => setComments(event.target.value)}
            value={comments}
          />
          <div className="approval-submission__actions">
            <Button
              onClick={() => {
                setFormOpen(false);
                setComments("");
                submitMutation.reset();
              }}
              size="small"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={submitMutation.isPending}
              leadingIcon={
                submitMutation.isPending ? (
                  <RotateCw aria-hidden="true" className="spin" size={15} />
                ) : (
                  <ShieldCheck aria-hidden="true" size={15} />
                )
              }
              size="small"
              type="submit"
            >
              {submitMutation.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      )}
      {submitMutation.isError ? (
        <div className="approval-submission__error">
          <ErrorPanel
            message={
              isConflict
                ? "This resource is no longer an eligible draft or already has a pending review."
                : errorPresentation.message
            }
            requestId={errorPresentation.requestId}
            title="Review request not submitted"
          />
        </div>
      ) : null}
    </section>
  );
}
