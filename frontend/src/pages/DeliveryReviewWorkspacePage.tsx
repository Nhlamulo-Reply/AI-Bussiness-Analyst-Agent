import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  RotateCw,
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
import { hasPermission } from "../features/auth/permissions";
import {
  approvalPageSize,
  useAddDeliveryFeedback,
  useProjectDeliveryReviews,
} from "../features/approvals/approval-queries";
import { useProject } from "../features/projects/project-queries";
import { getApiErrorPresentation } from "../lib/api-client";

const reviewDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DeliveryReviewWorkspacePage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const canReview = hasPermission(session?.user.roles, "delivery.review");
  const projectQuery = useProject(projectId);
  const [pageState, setPageState] = useState({ projectId, page: 1 });
  const page = pageState.projectId === projectId ? pageState.page : 1;
  const [selection, setSelection] = useState<{
    projectId: string;
    approvalId: string;
  } | null>(null);
  const [comments, setComments] = useState("");
  const reviewsQuery = useProjectDeliveryReviews(projectId, page, canReview);
  const feedbackMutation = useAddDeliveryFeedback(projectId);
  const selectedApprovalId =
    selection?.projectId === projectId ? selection.approvalId : "";
  const selectedReview = reviewsQuery.data?.items.find(
    ({ approval }) => approval.id === selectedApprovalId,
  );
  const pageCount = Math.max(
    1,
    Math.ceil((reviewsQuery.data?.total ?? 0) / approvalPageSize),
  );

  const reviewError = reviewsQuery.error
    ? getApiErrorPresentation(
        reviewsQuery.error,
        "Delivery reviews could not be loaded. Please try again.",
      )
    : undefined;
  const feedbackError = feedbackMutation.error
    ? getApiErrorPresentation(
        feedbackMutation.error,
        "Your delivery feedback could not be saved.",
      )
    : undefined;

  return (
    <section aria-labelledby="delivery-review-title" className="approval-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DELIVERY REVIEW</p>
          <h1 id="delivery-review-title">
            {projectQuery.data
              ? `${projectQuery.data.name} delivery reviews`
              : "Delivery reviews"}
          </h1>
          <p className="page-heading__description">
            Add implementation and delivery feedback to pending delivery
            artifacts. Feedback never approves or rejects a requirement.
          </p>
        </div>
        <Badge tone={canReview ? "accent" : "warning"}>
          {canReview ? "Feedback only" : "Delivery Lead access required"}
        </Badge>
      </header>

      {!canReview ? (
        <Card>
          <EmptyState
            icon={MessageSquareText}
            title="Delivery Lead role required"
            description="Ask an administrator to assign you the Delivery Lead role. Approval decisions remain with a Product Owner."
          />
        </Card>
      ) : (
        <>
          {reviewError ? (
            <ErrorPanel
              message={reviewError.message}
              requestId={reviewError.requestId}
              title="Delivery queue unavailable"
            />
          ) : null}
          <p className="approval-page__notice" role="note">
            Delivery Leads provide feedback only. A Product Owner makes the
            approval decision.
          </p>
          <div className="approval-page__filters">
            <p aria-live="polite">
              {reviewsQuery.data
                ? `${reviewsQuery.data.total} pending ${
                    reviewsQuery.data.total === 1
                      ? "delivery review"
                      : "delivery reviews"
                  }`
                : ""}
            </p>
          </div>
          <div className="approval-page__layout">
            <Card
              aria-label="Delivery review queue"
              className="approval-page__queue"
              role="region"
            >
              <h2>Feedback queue</h2>
              {reviewsQuery.isPending ? (
                <div aria-label="Loading delivery reviews" role="status">
                  <LoadingSkeleton lines={3} />
                </div>
              ) : reviewsQuery.data?.items.length ? (
                <div className="approval-page__list">
                  {reviewsQuery.data.items.map(({ approval, resource }) => (
                    <button
                      aria-pressed={selectedApprovalId === approval.id}
                      className="approval-page__item"
                      key={approval.id}
                      onClick={() => {
                        setSelection({ projectId, approvalId: approval.id });
                        setComments("");
                        feedbackMutation.reset();
                      }}
                      type="button"
                    >
                      <span className="approval-page__item-heading">
                        <strong>{resource.title}</strong>
                        <StatusBadge tone="warning">Pending</StatusBadge>
                      </span>
                      <span className="approval-page__item-meta">
                        Submitted{" "}
                        {reviewDateFormatter.format(
                          new Date(approval.createdAt),
                        )}
                      </span>
                      {approval.comments ? (
                        <span className="approval-page__item-note">
                          {approval.comments}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={MessageSquareText}
                  title="No pending delivery reviews"
                  description="Pending risks, dependencies, and implementation plans will appear here."
                />
              )}
              {reviewsQuery.data && reviewsQuery.data.total > 0 ? (
                <div
                  aria-label="Delivery review pagination"
                  className="approval-page__pagination"
                  role="group"
                >
                  <Button
                    disabled={page <= 1 || reviewsQuery.isFetching}
                    leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
                    onClick={() => setPageState({ projectId, page: page - 1 })}
                    size="small"
                    variant="secondary"
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    disabled={page >= pageCount || reviewsQuery.isFetching}
                    onClick={() => setPageState({ projectId, page: page + 1 })}
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
              aria-label="Delivery review details"
              className="approval-page__details"
              role="region"
            >
              {!selectedApprovalId ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="Select a delivery review"
                  description="Choose an item to inspect it and leave delivery feedback."
                />
              ) : !selectedReview ? (
                <EmptyState
                  icon={MessageSquareText}
                  title="Review no longer available"
                  description="This item may have been decided or moved to another page."
                />
              ) : (
                <div className="approval-page__detail-content">
                  <div className="approval-page__detail-heading">
                    <div>
                      <p className="eyebrow">
                        {selectedReview.approval.artifactType.replaceAll(
                          "_",
                          " ",
                        )}
                      </p>
                      <h2>{selectedReview.resource.title}</h2>
                    </div>
                    <StatusBadge tone="warning">Pending</StatusBadge>
                  </div>
                  <p className="approval-page__description">
                    {selectedReview.resource.description ||
                      "No description provided."}
                  </p>
                  <dl className="approval-page__metadata">
                    <div>
                      <dt>Submitted by</dt>
                      <dd>{selectedReview.approval.submittedByUserId}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>
                        {reviewDateFormatter.format(
                          new Date(selectedReview.approval.createdAt),
                        )}
                      </dd>
                    </div>
                  </dl>
                  {selectedReview.approval.comments ? (
                    <section className="approval-page__note">
                      <h3>Submitter note</h3>
                      <p>{selectedReview.approval.comments}</p>
                    </section>
                  ) : null}
                  {selectedReview.approval.deliveryFeedback?.length ? (
                    <section className="approval-page__note">
                      <h3>Delivery feedback history</h3>
                      <ul>
                        {selectedReview.approval.deliveryFeedback.map(
                          (feedback) => (
                            <li
                              key={`${feedback.reviewerUserId}-${feedback.createdAt}`}
                            >
                              <strong>{feedback.reviewerUserId}</strong>:{" "}
                              {feedback.comments}{" "}
                              <time dateTime={feedback.createdAt}>
                                {reviewDateFormatter.format(
                                  new Date(feedback.createdAt),
                                )}
                              </time>
                            </li>
                          ),
                        )}
                      </ul>
                    </section>
                  ) : null}
                  <div className="approval-page__decision">
                    <TextAreaField
                      hint="Feedback is recorded separately and does not change the decision."
                      label="Delivery feedback"
                      maxLength={4000}
                      onChange={(event) =>
                        setComments(event.currentTarget.value)
                      }
                      required
                      value={comments}
                    />
                    <Button
                      disabled={
                        !comments.trim() ||
                        feedbackMutation.isPending ||
                        selectedReview.approval.decision !== "pending"
                      }
                      leadingIcon={
                        <RotateCw
                          aria-hidden="true"
                          className={
                            feedbackMutation.isPending ? "spin" : undefined
                          }
                          size={15}
                        />
                      }
                      onClick={() => {
                        feedbackMutation.mutate(
                          {
                            approvalId: selectedApprovalId,
                            comments: comments.trim(),
                          },
                          { onSuccess: () => setComments("") },
                        );
                      }}
                      type="button"
                    >
                      Add feedback
                    </Button>
                  </div>
                  {feedbackError ? (
                    <ErrorPanel
                      message={feedbackError.message}
                      requestId={feedbackError.requestId}
                      title="Feedback not saved"
                    />
                  ) : null}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
