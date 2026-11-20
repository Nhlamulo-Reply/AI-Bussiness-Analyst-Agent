import {
  AlertTriangle,
  ArrowLeft,
  History,
  Pencil,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useRequirements } from "../requirements/requirement-queries";
import { formatProjectDate } from "../projects/format";
import { useArtifactVersions, usePatchArtifact } from "./artifact-queries";
import { ArtifactForm } from "./ArtifactForm";
import {
  artifactSchema,
  type Artifact,
  type ArtifactType,
  type CreateArtifactInput,
  type PatchArtifactInput,
} from "./artifact.schemas";
import { ApiError, getApiErrorPresentation } from "../../lib/api-client";

const typeLabels: Record<ArtifactType, string> = {
  epic: "Epic",
  story: "User story",
  acceptance_criteria: "Acceptance criteria",
  business_rule: "Business rule",
  risk: "Risk",
  dependency: "Dependency",
  implementation_plan: "Implementation plan",
};

const statusLabels: Record<Artifact["status"], string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
};

function getStatusTone(status: Artifact["status"]) {
  if (status === "approved") return "success";
  if (status === "reviewed") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function stringifyValue(value: unknown) {
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
}

function buildArtifactPatch(
  artifact: Artifact,
  values: CreateArtifactInput,
): PatchArtifactInput {
  const patch: PatchArtifactInput = {};
  if (values.title !== artifact.title) patch.title = values.title;
  if (values.description !== artifact.description) {
    patch.description = values.description;
  }
  if (
    values.requirementIds.length !== artifact.requirementIds.length ||
    values.requirementIds.some(
      (id, index) => id !== artifact.requirementIds[index],
    )
  ) {
    patch.requirementIds = values.requirementIds;
  }
  if (JSON.stringify(values.data) !== JSON.stringify(artifact.data)) {
    patch.data = values.data;
  }
  return patch;
}

function ArtifactDataInspector({
  data,
  className = "",
}: {
  data: Record<string, unknown>;
  className?: string;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <p className="artifact-data-inspector__empty">
        No structured fields are recorded.
      </p>
    );
  }

  return (
    <dl className={`artifact-data-inspector ${className}`.trim()}>
      {entries.map(([key, value]) => (
        <div className="artifact-data-inspector__entry" key={key}>
          <dt>{key}</dt>
          <dd>
            <pre>{stringifyValue(value)}</pre>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function VersionSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  const parsed = artifactSchema.safeParse(snapshot);
  if (!parsed.success) {
    return (
      <details className="artifact-version__snapshot">
        <summary>Show recorded snapshot</summary>
        <pre>{stringifyValue(snapshot)}</pre>
      </details>
    );
  }

  const artifact = parsed.data;
  return (
    <details className="artifact-version__snapshot">
      <summary>Show version {artifact.version} snapshot</summary>
      <strong>{artifact.title}</strong>
      <p>{artifact.description || "No description recorded."}</p>
      <ArtifactDataInspector data={artifact.data} />
      {artifact.requirementIds.length > 0 ? (
        <p>Linked requirements: {artifact.requirementIds.join(", ")}</p>
      ) : null}
    </details>
  );
}

interface ArtifactDetailsDialogProps {
  artifact: Artifact;
  open: boolean;
  fromWorkflow?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (artifact: Artifact) => void;
}

export function ArtifactDetailsDialog({
  artifact,
  open,
  fromWorkflow = false,
  onOpenChange,
  onSaved,
}: ArtifactDetailsDialogProps) {
  const [editing, setEditing] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState(artifact);
  const requirementsQuery = useRequirements(currentArtifact.projectId, 1, 100);
  const patchMutation = usePatchArtifact(
    currentArtifact.projectId,
    currentArtifact.id,
  );
  const versionsQuery = useArtifactVersions(
    currentArtifact.id,
    currentArtifact.type,
  );
  const submissionPresentation = getApiErrorPresentation(
    patchMutation.error,
    "This artifact couldn't be updated. Please try again.",
  );
  const conflict =
    patchMutation.error instanceof ApiError &&
    patchMutation.error.status === 409;

  const submitEdit = (values: CreateArtifactInput) => {
    const patch = buildArtifactPatch(currentArtifact, values);
    if (Object.keys(patch).length === 0) return;
    patchMutation.mutate(patch, {
      onSuccess: (updated) => {
        setCurrentArtifact(updated);
        patchMutation.reset();
        setEditing(false);
        onSaved(updated);
      },
    });
  };

  return (
    <Dialog
      className="artifact-detail-dialog"
      description="Inspect this project artifact, its structured fields, linked requirements, and version history."
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setEditing(false);
          patchMutation.reset();
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      title={editing ? "Edit artifact" : currentArtifact.title}
    >
      {editing ? (
        <div className="artifact-edit-view">
          <Button
            leadingIcon={<ArrowLeft aria-hidden="true" size={14} />}
            onClick={() => {
              patchMutation.reset();
              setEditing(false);
            }}
            size="small"
            type="button"
            variant="ghost"
          >
            Back to details
          </Button>
          {conflict ? (
            <div className="artifact-conflict-notice" role="alert">
              <AlertTriangle aria-hidden="true" size={17} />
              <div>
                <strong>Editing is paused during review</strong>
                <p>
                  An approval is pending for this artifact. Wait until the
                  review is resolved before saving a revision. Your form values
                  have been kept.
                </p>
              </div>
            </div>
          ) : null}
          <ArtifactForm
            artifact={currentArtifact}
            isSubmitting={patchMutation.isPending}
            mode="edit"
            onCancel={() => setEditing(false)}
            onRetryRequirements={() => void requirementsQuery.refetch()}
            onSubmit={submitEdit}
            requirements={requirementsQuery.data?.items ?? []}
            requirementsError={
              requirementsQuery.isError
                ? getApiErrorPresentation(
                    requirementsQuery.error,
                    "Requirements couldn't be loaded.",
                  ).message
                : undefined
            }
            requirementsLoading={requirementsQuery.isPending}
            submissionError={
              patchMutation.isError && !conflict
                ? submissionPresentation.message
                : undefined
            }
          />
        </div>
      ) : (
        <div className="artifact-detail">
          {fromWorkflow ? (
            <div className="artifact-ai-draft" role="note">
              <span className="artifact-ai-draft__sparkle" aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <div>
                <strong>AI-generated draft</strong>
                <p>
                  This artifact was opened from a workflow result. Review its
                  linked requirements and structured data before using or
                  sharing it.
                </p>
              </div>
            </div>
          ) : null}

          <div className="artifact-detail__badges">
            <Badge tone="accent">{typeLabels[currentArtifact.type]}</Badge>
            <StatusBadge tone={getStatusTone(currentArtifact.status)}>
              {statusLabels[currentArtifact.status]}
            </StatusBadge>
            <Badge>Version {currentArtifact.version}</Badge>
          </div>

          {currentArtifact.status === "draft" ? (
            <p className="artifact-detail__draft-note">
              Draft status means this content has not been approved. AI
              suggestions are not final or certified.
            </p>
          ) : null}

          <section className="artifact-detail__section">
            <h3>Description</h3>
            <p>{currentArtifact.description || "No description recorded."}</p>
          </section>

          <section className="artifact-detail__section">
            <h3>Linked requirements</h3>
            {currentArtifact.requirementIds.length > 0 ? (
              <ul className="artifact-linked-requirements">
                {currentArtifact.requirementIds.map((id) => {
                  const requirement = requirementsQuery.data?.items.find(
                    (item) => item.id === id,
                  );
                  return (
                    <li key={id}>
                      <Link
                        to={`/app/projects/${encodeURIComponent(currentArtifact.projectId)}/requirements`}
                        onClick={() => onOpenChange(false)}
                      >
                        {requirement ? requirement.title : id}
                      </Link>
                      <code>{id}</code>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="artifact-detail__empty">
                No requirements are linked to this artifact.
              </p>
            )}
          </section>

          <section className="artifact-detail__section">
            <h3>Structured data</h3>
            <p>
              Type-specific fields are shown as recorded. Unknown keys are
              preserved when editing.
            </p>
            <ArtifactDataInspector data={currentArtifact.data} />
          </section>

          <dl className="artifact-detail__metadata">
            <div>
              <dt>Created</dt>
              <dd>{formatProjectDate(currentArtifact.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatProjectDate(currentArtifact.updatedAt)}</dd>
            </div>
            <div>
              <dt>Artifact ID</dt>
              <dd>
                <code>{currentArtifact.id}</code>
              </dd>
            </div>
          </dl>

          <section
            aria-labelledby="artifact-history-heading"
            className="artifact-history"
          >
            <div className="artifact-history__heading">
              <span aria-hidden="true">
                <History size={16} />
              </span>
              <div>
                <h3 id="artifact-history-heading">Version history</h3>
                <p>Earlier saved revisions remain available for comparison.</p>
              </div>
            </div>
            {versionsQuery.isPending ? (
              <div aria-label="Loading artifact history" role="status">
                <LoadingSkeleton lines={3} />
              </div>
            ) : null}
            {versionsQuery.isError ? (
              <div className="artifact-history__error">
                <ErrorPanel
                  message={
                    getApiErrorPresentation(
                      versionsQuery.error,
                      "Artifact history couldn't be loaded.",
                    ).message
                  }
                  requestId={
                    getApiErrorPresentation(
                      versionsQuery.error,
                      "Artifact history couldn't be loaded.",
                    ).requestId
                  }
                  title="Version history unavailable"
                />
                <Button
                  disabled={versionsQuery.isFetching}
                  leadingIcon={<RotateCw aria-hidden="true" size={14} />}
                  onClick={() => void versionsQuery.refetch()}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Try again
                </Button>
              </div>
            ) : null}
            {versionsQuery.data && versionsQuery.data.length === 0 ? (
              <p className="artifact-history__empty">
                No earlier versions have been recorded.
              </p>
            ) : null}
            {versionsQuery.data && versionsQuery.data.length > 0 ? (
              <ol className="artifact-version-list">
                {versionsQuery.data
                  .slice()
                  .sort((left, right) => right.version - left.version)
                  .map((version) => (
                    <li className="artifact-version" key={version.id}>
                      <span
                        className="artifact-version__marker"
                        aria-hidden="true"
                      />
                      <div className="artifact-version__content">
                        <div className="artifact-version__heading">
                          <strong>Version {version.version}</strong>
                          <time dateTime={version.createdAt}>
                            {formatProjectDate(version.createdAt)}
                          </time>
                        </div>
                        <p>{version.reason || "Version snapshot"}</p>
                        <small>Recorded by {version.actorUserId}</small>
                        <VersionSnapshot snapshot={version.snapshot} />
                      </div>
                    </li>
                  ))}
              </ol>
            ) : null}
          </section>

          <div className="artifact-detail__actions">
            <Button
              leadingIcon={<Pencil aria-hidden="true" size={14} />}
              onClick={() => {
                patchMutation.reset();
                setEditing(true);
              }}
              type="button"
              variant="secondary"
            >
              Edit artifact
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
