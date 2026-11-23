import { FileText, History, Pencil, RotateCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getApiErrorPresentation } from "../../lib/api-client";
import { useProjectDocuments } from "../documents/document-queries";
import type { DocumentMetadata } from "../documents/document.schemas";
import {
  usePatchRequirement,
  useRequirementVersions,
} from "./requirement-queries";
import {
  requirementSchema,
  type PatchRequirementInput,
  type Requirement,
  type RequirementVersion,
} from "./requirement.schemas";
import { RequirementForm } from "./RequirementForm";
import type { RequirementFormValues } from "./requirement-form.schemas";
import { ApprovalSubmissionPanel } from "../approvals/ApprovalSubmissionPanel";

interface RequirementDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  requirement: Requirement;
}

const typeLabels: Record<Requirement["type"], string> = {
  business: "Business",
  functional: "Functional",
  non_functional: "Non-functional",
};

const statusLabels: Record<Requirement["status"], string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
};

const priorityLabels: Record<Requirement["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function getStatusTone(status: Requirement["status"]) {
  if (status === "approved") return "success";
  if (status === "reviewed") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function sameStrings(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function buildPatch(
  requirement: Requirement,
  values: RequirementFormValues,
): PatchRequirementInput {
  const patch: PatchRequirementInput = {};
  if (values.title !== requirement.title) patch.title = values.title;
  if (values.description !== requirement.description) {
    patch.description = values.description;
  }
  if (values.type !== requirement.type) patch.type = values.type;
  if (values.priority !== requirement.priority) {
    patch.priority = values.priority;
  }
  if (!sameStrings(values.sourceFacts, requirement.sourceFacts)) {
    patch.sourceFacts = values.sourceFacts;
  }
  if (!sameStrings(values.assumptions, requirement.assumptions)) {
    patch.assumptions = values.assumptions;
  }
  if (!sameStrings(values.openQuestions, requirement.openQuestions)) {
    patch.openQuestions = values.openQuestions;
  }
  return patch;
}

function RequirementSection({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: string[];
}) {
  return (
    <section className="requirement-detail-section">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="requirement-detail-section__empty">{emptyMessage}</p>
      )}
    </section>
  );
}

function LinkedDocuments({
  documentIds,
  documents,
}: {
  documentIds: string[];
  documents: DocumentMetadata[];
}) {
  const documentById = new Map(
    documents.map((document) => [document.id, document]),
  );

  return (
    <ul className="requirement-linked-document-list">
      {documentIds.map((documentId) => {
        const document = documentById.get(documentId);
        return (
          <li key={documentId}>
            <FileText aria-hidden="true" size={16} />
            <span>
              <strong>{document?.fileName ?? "Source document"}</strong>
              <small>{documentId}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function VersionSnapshot({ version }: { version: RequirementVersion }) {
  const parsedSnapshot = requirementSchema.safeParse(version.snapshot);

  if (!parsedSnapshot.success) {
    return (
      <p className="requirement-version__fallback">
        This version is recorded, but its snapshot fields are unavailable.
      </p>
    );
  }

  const snapshot = parsedSnapshot.data;
  return (
    <div className="requirement-version__snapshot">
      <strong>{snapshot.title}</strong>
      <p>{snapshot.description || "No description recorded."}</p>
      <div>
        <Badge tone="accent">{typeLabels[snapshot.type]}</Badge>
        <StatusBadge tone={getStatusTone(snapshot.status)}>
          {statusLabels[snapshot.status]}
        </StatusBadge>
        <Badge>{priorityLabels[snapshot.priority]} priority</Badge>
      </div>
    </div>
  );
}

function RequirementVersionHistory({
  requirementId,
}: {
  requirementId: string;
}) {
  const versionsQuery = useRequirementVersions(requirementId);
  const versions = versionsQuery.data ?? [];
  const errorPresentation = getApiErrorPresentation(
    versionsQuery.error,
    "Version history couldn't be loaded.",
  );

  return (
    <section
      aria-labelledby="requirement-history-title"
      className="requirement-history"
    >
      <div className="requirement-detail-section__heading">
        <span className="requirement-history__icon">
          <History aria-hidden="true" size={16} />
        </span>
        <div>
          <h3 id="requirement-history-title">Version history</h3>
          <p>Every saved revision is preserved for traceability.</p>
        </div>
      </div>

      {versionsQuery.isPending ? (
        <div aria-label="Loading version history" role="status">
          <LoadingSkeleton lines={3} />
        </div>
      ) : null}
      {versionsQuery.isError && !versionsQuery.data ? (
        <div className="requirement-history__error">
          <ErrorPanel
            message={errorPresentation.message}
            requestId={errorPresentation.requestId}
            title="Version history unavailable"
          />
          <Button
            disabled={versionsQuery.isFetching}
            leadingIcon={<RotateCw aria-hidden="true" size={14} />}
            onClick={() => void versionsQuery.refetch()}
            size="small"
            variant="secondary"
          >
            Try again
          </Button>
        </div>
      ) : null}
      {versionsQuery.data && versions.length === 0 ? (
        <p className="requirement-history__empty">
          No earlier versions have been recorded.
        </p>
      ) : null}
      {versionsQuery.data && versions.length > 0 ? (
        <ol className="requirement-version-list">
          {versions
            .slice()
            .sort((left, right) => right.version - left.version)
            .map((version) => (
              <li className="requirement-version" key={version.id}>
                <div className="requirement-version__marker">
                  <span />
                </div>
                <div className="requirement-version__body">
                  <div className="requirement-version__heading">
                    <strong>Version {version.version}</strong>
                    <time dateTime={version.createdAt}>
                      {historyDateFormatter.format(new Date(version.createdAt))}
                    </time>
                  </div>
                  <p className="requirement-version__reason">
                    {version.reason || "Version snapshot"}
                  </p>
                  <VersionSnapshot version={version} />
                  <details className="requirement-version__metadata">
                    <summary>Revision metadata</summary>
                    <p>Recorded by {version.actorUserId}</p>
                  </details>
                </div>
              </li>
            ))}
        </ol>
      ) : null}
      {versionsQuery.isError && versionsQuery.data ? (
        <div className="requirement-history__stale-error">
          <ErrorPanel
            message={errorPresentation.message}
            requestId={errorPresentation.requestId}
            title="Couldn't refresh version history"
          />
        </div>
      ) : null}
    </section>
  );
}

export function RequirementDetailsDialog({
  open,
  onOpenChange,
  projectId,
  requirement,
}: RequirementDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number>();
  const [formMessage, setFormMessage] = useState<string>();
  const documentsQuery = useProjectDocuments(projectId);
  const patchMutation = usePatchRequirement(projectId, requirement.id);
  const documents = documentsQuery.data ?? [];
  const documentById = new Map(
    documents.map((document) => [document.id, document]),
  );

  const handleSubmit = (values: RequirementFormValues) => {
    const patch = buildPatch(requirement, values);
    if (Object.keys(patch).length === 0) {
      setFormMessage("Make at least one change before saving.");
      return;
    }

    setFormMessage(undefined);
    patchMutation.mutate(patch, {
      onSuccess: (updatedRequirement) => {
        setSavedVersion(updatedRequirement.version);
        setIsEditing(false);
      },
    });
  };

  const mutationError = patchMutation.isError
    ? getApiErrorPresentation(
        patchMutation.error,
        "Your changes couldn't be saved. Please try again.",
      )
    : undefined;
  const submissionError =
    mutationError ?? (formMessage ? { message: formMessage } : undefined);

  return (
    <Dialog
      className="requirement-dialog"
      description={
        isEditing
          ? "Update the fields supported by this project and keep the change history intact."
          : "Review the evidence, assumptions, unresolved questions, and revision history."
      }
      onOpenChange={onOpenChange}
      open={open}
      title={isEditing ? "Edit requirement" : "Requirement details"}
    >
      {savedVersion ? (
        <p className="requirement-saved-notice" role="status">
          Saved as version {savedVersion}. This requirement is now a draft.
        </p>
      ) : null}

      {isEditing ? (
        <RequirementForm
          documents={documents}
          documentsError={
            documentsQuery.isError
              ? getApiErrorPresentation(
                  documentsQuery.error,
                  "Linked source documents couldn't be loaded.",
                )
              : undefined
          }
          documentsLoading={documentsQuery.isPending}
          isSubmitting={patchMutation.isPending}
          mode="edit"
          onCancel={() => {
            setIsEditing(false);
            setFormMessage(undefined);
            patchMutation.reset();
          }}
          onRetryDocuments={() => void documentsQuery.refetch()}
          onSubmit={handleSubmit}
          requirement={requirement}
          submissionError={submissionError}
        />
      ) : (
        <div className="requirement-detail">
          <div className="requirement-detail__title">
            <div>
              <p className="eyebrow">REQUIREMENT</p>
              <h3>{requirement.title}</h3>
            </div>
            <Button
              leadingIcon={<Pencil aria-hidden="true" size={15} />}
              onClick={() => {
                patchMutation.reset();
                setFormMessage(undefined);
                setIsEditing(true);
              }}
              size="small"
              type="button"
              variant="secondary"
            >
              Edit
            </Button>
          </div>

          <div className="requirement-detail__badges">
            <StatusBadge tone={getStatusTone(requirement.status)}>
              {statusLabels[requirement.status]}
            </StatusBadge>
            <Badge tone="accent">{typeLabels[requirement.type]}</Badge>
            <Badge>{priorityLabels[requirement.priority]} priority</Badge>
            <Badge>Version {requirement.version}</Badge>
          </div>

          <p className="requirement-detail__description">
            {requirement.description || "No description added."}
          </p>

          <ApprovalSubmissionPanel
            artifactId={requirement.id}
            artifactType="requirement"
            projectId={projectId}
            status={requirement.status}
          />

          <dl className="requirement-detail__metadata">
            <div>
              <dt>Requirement ID</dt>
              <dd>
                <code>{requirement.id}</code>
              </dd>
            </div>
            <div>
              <dt>Project ID</dt>
              <dd>
                <code>{requirement.projectId}</code>
              </dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>
                <code>{requirement.createdByUserId}</code>
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                <time dateTime={requirement.updatedAt}>
                  {historyDateFormatter.format(new Date(requirement.updatedAt))}
                </time>
              </dd>
            </div>
          </dl>

          <RequirementSection
            emptyMessage="No source facts have been recorded."
            items={requirement.sourceFacts}
            title="Source facts"
          />
          <RequirementSection
            emptyMessage="No assumptions have been recorded."
            items={requirement.assumptions}
            title="Assumptions"
          />
          <RequirementSection
            emptyMessage="No open questions are recorded."
            items={requirement.openQuestions}
            title="Open questions"
          />

          <section className="requirement-detail-section">
            <div className="requirement-detail-section__heading">
              <FileText aria-hidden="true" size={16} />
              <h3>Traceability</h3>
            </div>
            {requirement.traceability.documentIds.length ? (
              <LinkedDocuments
                documentIds={requirement.traceability.documentIds}
                documents={documents}
              />
            ) : (
              <p className="requirement-detail-section__empty">
                No source documents are linked.
              </p>
            )}
            {requirement.traceability.sourceFactReferences?.length ? (
              <ul className="requirement-source-reference-list">
                {requirement.traceability.sourceFactReferences.map(
                  (reference, index) => (
                    <li key={`${reference.documentId}-${index}`}>
                      <blockquote>{reference.text}</blockquote>
                      <small>
                        {documentById.get(reference.documentId)?.fileName ??
                          reference.documentId}
                      </small>
                    </li>
                  ),
                )}
              </ul>
            ) : null}
            {requirement.traceability.executionId ? (
              <p className="requirement-detail-section__reference">
                Related execution:{" "}
                <code>{requirement.traceability.executionId}</code>
              </p>
            ) : null}
            {documentsQuery.isError ? (
              <p className="requirement-detail-section__reference">
                Source document names are unavailable; reference IDs remain
                visible above.
              </p>
            ) : null}
          </section>

          {requirement.traceability.documentIds.length > 0 ? (
            <p className="requirement-detail__edit-note">
              Linked documents are read-only because the current edit API
              doesn't support changing document links.
            </p>
          ) : null}

          <RequirementVersionHistory requirementId={requirement.id} />
        </div>
      )}
    </Dialog>
  );
}
