import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TextAreaField } from "../components/ui/TextAreaField";
import { useAuth } from "../features/auth/useAuth";
import {
  approvalPageSize,
  useApprovalDetails,
  useDecideApproval,
  useProjectApprovals,
} from "../features/approvals/approval-queries";
import type {
  ApprovalDecision,
  ApprovalStatus,
} from "../features/approvals/approval.schemas";
import { getApiErrorPresentation } from "../lib/api-client";

const approvalFilters: Array<{
  value: ApprovalStatus | "all";
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All decisions" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes requested" },
];

const artifactLabels: Record<string, string> = {
  requirement: "Requirement",
  epic: "Epic",
  story: "User story",
  acceptance_criteria: "Acceptance criteria",
  business_rule: "Business rule",
  risk: "Risk",
  dependency: "Dependency",
  implementation_plan: "Implementation plan",
};

const decisionLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
};

const decisionTones: Record<
  ApprovalStatus,
  "neutral" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  changes_requested: "neutral",
};

const submittedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function ApprovalWorkspacePage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const canReview =
    session?.user.roles.includes("reviewer") === true ||
    session?.user.roles.includes("admin") === true;
  const [filter, setFilter] = useState<ApprovalStatus | "all">("pending");
  const [pageState, setPageState] = useState({ projectId, page: 1 });
  const page = pageState.projectId === projectId ? pageState.page : 1;
  const [selection, setSelection] = useState<{
    projectId: string;
    approvalId: string;
  } | null>(null);
  const selectedApprovalId =
    selection?.projectId === projectId ? selection.approvalId : "";
  const [reviewerComments, setReviewerComments] = useState("");
  const approvalsQuery = useProjectApprovals(
    projectId,
    page,
    filter,
    canReview,
  );
  const detailsQuery = useApprovalDetails(selectedApprovalId, canReview);
  const decideMutation = useDecideApproval(projectId);
  const pageCount = Math.max(
    1,
    Math.ceil((approvalsQuery.data?.total ?? 0) / approvalPageSize),
  );

  const handleDecision = (decision: ApprovalDecision) => {
    if (!selectedApprovalId) return;
    decideMutation.mutate(
      {
        approvalId: selectedApprovalId,
        decision,
        comments: reviewerComments.trim(),
      },
      { onSuccess: () => setReviewerComments("") },
    );
  };
  const updatePage = (nextPage: number) =>
    setPageState({ projectId, page: nextPage });

  const approvalError = approvalsQuery.error
    ? getApiErrorPresentation(
        approvalsQuery.error,
        "Approvals could not be loaded. Please try again.",
      )
    : undefined;
  const detailsError = detailsQuery.error
    ? getApiErrorPresentation(
        detailsQuery.error,
        "This approval's details could not be loaded. Please try again.",
      )
    : undefined;
  const decisionError = decideMutation.error
    ? getApiErrorPresentation(
        decideMutation.error,
        "Your review decision could not be saved. Please try again.",
      )
    : undefined;
  const details = detailsQuery.data;
  const approval = details?.approval;
  const isSubmitter = approval?.submittedByUserId === session?.user.id;
  const canDecide =
    canReview && approval?.decision === "pending" && !isSubmitter;

  return (
    <section
      aria-labelledby="approval-workspace-title"
      className="approval-page"
    >
      <header className="page-heading">
        <div>
          <p className="eyebrow">PROJECT REVIEW</p>
          <h1 id="approval-workspace-title">Approvals</h1>
          <p className="page-heading__description">
            Review submitted requirements and deliverables for this project.
          </p>
        </div>
        <Badge tone={canReview ? "accent" : "warning"}>
          {canReview ? "Reviewer workspace" : "Reviewer access required"}
        </Badge>
      </header>

      {!canReview ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Reviewer or admin role required"
            description="Ask a project administrator to assign you the reviewer role. You must also have access to this project."
          />
        </Card>
      ) : (
        <>
          {approvalError ? (
            <ErrorPanel
              message={approvalError.message}
              requestId={approvalError.requestId}
              title="Approval queue unavailable"
            />
          ) : null}
          <div className="approval-page__filters">
            <label className="field">
              <span className="field__label">Filter approvals</span>
              <select
                className="field__control"
                onChange={(event) => {
                  setFilter(
                    event.currentTarget.value as ApprovalStatus | "all",
                  );
                  updatePage(1);
                  setSelection(null);
                  setReviewerComments("");
                  decideMutation.reset();
                }}
                value={filter}
              >
                {approvalFilters.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p aria-live="polite">
              {approvalsQuery.data
                ? `${approvalsQuery.data.total} ${
                    approvalsQuery.data.total === 1 ? "approval" : "approvals"
                  }`
                : ""}
            </p>
          </div>

          <div className="approval-page__layout">
            <Card
              aria-label="Approval queue"
              className="approval-page__queue"
              role="region"
            >
              <h2>Review queue</h2>
              {approvalsQuery.isPending ? (
                <div aria-label="Loading approvals" role="status">
                  <LoadingSkeleton lines={3} />
                </div>
              ) : approvalsQuery.data?.items.length ? (
                <div className="approval-page__list">
                  {approvalsQuery.data.items.map((item) => (
                    <button
                      aria-pressed={selectedApprovalId === item.id}
                      className="approval-page__item"
                      key={item.id}
                      onClick={() => {
                        setSelection({ projectId, approvalId: item.id });
                        setReviewerComments("");
                        decideMutation.reset();
                      }}
                      type="button"
                    >
                      <span className="approval-page__item-heading">
                        <strong>
                          {artifactLabels[item.artifactType]} review
                        </strong>
                        <StatusBadge tone={decisionTones[item.decision]}>
                          {decisionLabels[item.decision]}
                        </StatusBadge>
                      </span>
                      <span className="approval-page__item-id">
                        {item.artifactId}
                      </span>
                      <span className="approval-page__item-meta">
                        Submitted{" "}
                        {submittedAtFormatter.format(new Date(item.createdAt))}
                      </span>
                      {item.comments ? (
                        <span className="approval-page__item-note">
                          {item.comments}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title={
                    filter === "pending"
                      ? "No pending approvals"
                      : "No approvals found"
                  }
                  description={
                    filter === "pending"
                      ? "New review submissions for this project will appear here."
                      : "Try a different decision filter."
                  }
                />
              )}
              {approvalsQuery.data && approvalsQuery.data.total > 0 ? (
                <div
                  aria-label="Approval pagination"
                  className="approval-page__pagination"
                  role="group"
                >
                  <Button
                    disabled={page <= 1 || approvalsQuery.isFetching}
                    leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
                    onClick={() => updatePage(page - 1)}
                    size="small"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    disabled={page >= pageCount || approvalsQuery.isFetching}
                    onClick={() => updatePage(page + 1)}
                    size="small"
                    trailingIcon={<ChevronRight aria-hidden="true" size={15} />}
                    variant="secondary"
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </Card>

            <Card
              aria-label="Approval details"
              className="approval-page__details"
              role="region"
            >
              {!selectedApprovalId ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Select an approval"
                  description="Choose a submission from the review queue to inspect it and record a decision."
                />
              ) : detailsQuery.isPending ? (
                <div aria-label="Loading approval details" role="status">
                  <LoadingSkeleton lines={5} />
                </div>
              ) : detailsError ? (
                <ErrorPanel
                  message={detailsError.message}
                  requestId={detailsError.requestId}
                  title="Approval details unavailable"
                />
              ) : details ? (
                <div className="approval-page__detail-content">
                  <div className="approval-page__detail-heading">
                    <div>
                      <p className="eyebrow">
                        {artifactLabels[details.approval.artifactType]}
                      </p>
                      <h2>{details.resource.title}</h2>
                    </div>
                    <StatusBadge
                      tone={decisionTones[details.approval.decision]}
                    >
                      {decisionLabels[details.approval.decision]}
                    </StatusBadge>
                  </div>
                  <p className="approval-page__description">
                    {details.resource.description || "No description provided."}
                  </p>
                  <dl className="approval-page__metadata">
                    <div>
                      <dt>Submitted by</dt>
                      <dd>{details.approval.submittedByUserId}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>
                        {submittedAtFormatter.format(
                          new Date(details.approval.createdAt),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Current version</dt>
                      <dd>{details.resource.version}</dd>
                    </div>
                    {"priority" in details.resource ? (
                      <div>
                        <dt>Priority</dt>
                        <dd>{details.resource.priority}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {details.approval.comments ? (
                    <section className="approval-page__note">
                      <h3>Submitter note</h3>
                      <p>{details.approval.comments}</p>
                    </section>
                  ) : null}
                  {"sourceFacts" in details.resource &&
                  details.resource.sourceFacts.length > 0 ? (
                    <section className="approval-page__note">
                      <h3>Source facts</h3>
                      <ul>
                        {details.resource.sourceFacts.map((fact, index) => (
                          <li key={`${index}-${fact}`}>{fact}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {"data" in details.resource ? (
                    <details className="approval-page__data">
                      <summary>Structured data</summary>
                      <pre>
                        {JSON.stringify(details.resource.data, null, 2)}
                      </pre>
                    </details>
                  ) : null}

                  {isSubmitter ? (
                    <p className="approval-page__notice" role="status">
                      You submitted this request and cannot decide it.
                    </p>
                  ) : null}
                  {canDecide ? (
                    <div className="approval-page__decision">
                      <TextAreaField
                        hint="Optional. Include context for the submitter."
                        label="Reviewer comments"
                        maxLength={4000}
                        onChange={(event) =>
                          setReviewerComments(event.currentTarget.value)
                        }
                        value={reviewerComments}
                      />
                      <div className="approval-page__actions">
                        <Button
                          disabled={decideMutation.isPending}
                          leadingIcon={
                            <RotateCw
                              aria-hidden="true"
                              className={
                                decideMutation.isPending ? "spin" : undefined
                              }
                              size={15}
                            />
                          }
                          onClick={() => handleDecision("changes_requested")}
                          size="small"
                          type="button"
                          variant="secondary"
                        >
                          Request changes
                        </Button>
                        <Button
                          disabled={decideMutation.isPending}
                          leadingIcon={<Check aria-hidden="true" size={15} />}
                          onClick={() => handleDecision("rejected")}
                          size="small"
                          type="button"
                          variant="danger"
                        >
                          Reject
                        </Button>
                        <Button
                          disabled={decideMutation.isPending}
                          leadingIcon={<Check aria-hidden="true" size={15} />}
                          onClick={() => handleDecision("approved")}
                          size="small"
                          type="button"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {decisionError ? (
                    <ErrorPanel
                      message={decisionError.message}
                      requestId={decisionError.requestId}
                      title="Decision not saved"
                    />
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
