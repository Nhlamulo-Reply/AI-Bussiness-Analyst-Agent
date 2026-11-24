import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Layers3,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ArtifactDetailsDialog } from "../features/artifacts/ArtifactDetailsDialog";
import { ArtifactForm } from "../features/artifacts/ArtifactForm";
import {
  artifactPageSize,
  useArtifactById,
  useArtifacts,
  useCreateArtifact,
} from "../features/artifacts/artifact-queries";
import {
  artifactStatuses,
  artifactTypes,
  type Artifact,
  type ArtifactStatus,
  type ArtifactType,
  type CreateArtifactInput,
} from "../features/artifacts/artifact.schemas";
import { useRequirements } from "../features/requirements/requirement-queries";
import { formatProjectDate } from "../features/projects/format";
import { getApiErrorPresentation } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { hasPermission } from "../features/auth/permissions";

const typeLabels: Record<ArtifactType, string> = {
  epic: "Epic",
  story: "User story",
  acceptance_criteria: "Acceptance criteria",
  business_rule: "Business rule",
  risk: "Risk",
  dependency: "Dependency",
  implementation_plan: "Implementation plan",
};

const statusLabels: Record<ArtifactStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
};

const statusOptions = [
  { value: "all", label: "All statuses" },
  ...artifactStatuses.map((status) => ({
    value: status,
    label: statusLabels[status],
  })),
] as const;

const typeOptions = [
  { value: "all", label: "All types" },
  ...artifactTypes.map((type) => ({
    value: type,
    label: typeLabels[type],
  })),
] as const;

function getStatusTone(status: ArtifactStatus) {
  if (status === "approved") return "success";
  if (status === "reviewed") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function summarizeData(data: Record<string, unknown>) {
  const keys = Object.keys(data);
  if (keys.length === 0) return "No structured fields";
  return (
    keys.slice(0, 3).join(", ") +
    (keys.length > 3 ? ` +${keys.length - 3}` : "")
  );
}

export function ArtifactWorkspaceRoute() {
  const { projectId = "" } = useParams();
  return <ArtifactWorkspacePage key={projectId} />;
}

export function ArtifactWorkspacePage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const canPrepare = hasPermission(session?.user.roles, "analysis.prepare");
  const canReadBusiness = hasPermission(
    session?.user.roles,
    "project.business.read",
  );
  const canReadDelivery = hasPermission(
    session?.user.roles,
    "project.delivery.read",
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<
    { kind: "created"; title: string } | { kind: "updated" } | undefined
  >();
  const artifactsQuery = useArtifacts(projectId, page);
  const requirementsQuery = useRequirements(projectId, 1, 100, canPrepare);
  const createMutation = useCreateArtifact(projectId);
  const result = artifactsQuery.data;
  const targetArtifactId = searchParams.get("artifactId") ?? "";
  const targetFromWorkflow = searchParams.get("source") === "workflow";
  const targetQuery = useArtifactById(projectId, targetArtifactId);
  const targetArtifact =
    targetArtifactId && targetQuery.data ? targetQuery.data : undefined;
  const activeArtifactId = targetArtifactId || selectedArtifactId;
  const selectedArtifact =
    targetArtifact ??
    result?.items.find((artifact) => artifact.id === activeArtifactId);

  const filteredArtifacts = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLocaleLowerCase();
    return result.items.filter((artifact) => {
      const matchesSearch =
        !query ||
        artifact.title.toLocaleLowerCase().includes(query) ||
        artifact.description.toLocaleLowerCase().includes(query) ||
        artifact.id.toLocaleLowerCase().includes(query) ||
        Object.keys(artifact.data).some((key) =>
          key.toLocaleLowerCase().includes(query),
        ) ||
        artifact.requirementIds.some((id) =>
          id.toLocaleLowerCase().includes(query),
        );
      const matchesStatus =
        statusFilter === "all" || artifact.status === statusFilter;
      const matchesType = typeFilter === "all" || artifact.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [result, search, statusFilter, typeFilter]);

  const columns: DataTableColumn<Artifact>[] = [
    {
      key: "artifact",
      header: "Deliverable",
      render: (artifact) => (
        <button
          className="artifact-table__title"
          onClick={() => setSelectedArtifactId(artifact.id)}
          type="button"
        >
          <strong>{artifact.title}</strong>
          <span>{artifact.description || "No description recorded."}</span>
        </button>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (artifact) => (
        <Badge tone="accent">{typeLabels[artifact.type]}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (artifact) => (
        <StatusBadge tone={getStatusTone(artifact.status)}>
          {statusLabels[artifact.status]}
        </StatusBadge>
      ),
    },
    {
      key: "requirements",
      header: "Traceability",
      render: (artifact) =>
        artifact.requirementIds.length > 0
          ? `${artifact.requirementIds.length} linked`
          : "No links",
    },
    {
      key: "data",
      header: "Structured data",
      render: (artifact) => summarizeData(artifact.data),
    },
    {
      key: "version",
      header: "Version",
      render: (artifact) => `v${artifact.version}`,
    },
    {
      key: "updated",
      header: "Updated",
      render: (artifact) => formatProjectDate(artifact.updatedAt),
    },
    {
      key: "actions",
      header: "Details",
      render: (artifact) => (
        <Button
          onClick={() => setSelectedArtifactId(artifact.id)}
          size="small"
          type="button"
          variant="secondary"
        >
          Review
        </Button>
      ),
    },
  ];

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;
  const hasFilters =
    Boolean(search.trim()) || statusFilter !== "all" || typeFilter !== "all";
  const createError = getApiErrorPresentation(
    createMutation.error,
    "This artifact couldn't be created. Please try again.",
  );
  const targetError = getApiErrorPresentation(
    targetQuery.error,
    "The linked artifact couldn't be loaded.",
  );

  const submitCreate = (values: CreateArtifactInput) => {
    createMutation.mutate(values, {
      onSuccess: (artifact) => {
        const nextPage = Math.max(
          1,
          Math.ceil(((result?.total ?? 0) + 1) / artifactPageSize),
        );
        setPage(nextPage);
        setNotice({ kind: "created", title: artifact.title });
        setCreateOpen(false);
        createMutation.reset();
      },
    });
  };

  const closeDetails = (open: boolean) => {
    if (open) return;
    setSelectedArtifactId(null);
    if (targetArtifactId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("artifactId");
      nextParams.delete("source");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setPage(1);
  };

  return (
    <section aria-labelledby="artifacts-title" className="artifact-page">
      <header className="artifact-page__heading">
        <span className="artifact-page__icon" aria-hidden="true">
          <Layers3 size={21} />
        </span>
        <div>
          <p className="eyebrow">PROJECT WORKSPACE</p>
          <h1 id="artifacts-title">Deliverables</h1>
          <p>
            Bring stories, risks, plans, and other project artifacts together.
            Review structured details and trace each deliverable to its
            requirements.
          </p>
        </div>
        {canPrepare ? (
          <Button
            leadingIcon={<Plus aria-hidden="true" size={16} />}
            onClick={() => {
              createMutation.reset();
              setCreateOpen(true);
            }}
            type="button"
          >
            New deliverable
          </Button>
        ) : null}
      </header>

      <Card className="artifact-overview">
        <div>
          <p className="eyebrow">PROJECT RECORDS</p>
          <strong>
            {result?.total ?? (artifactsQuery.isPending ? "…" : 0)}
          </strong>
          <span>
            {result?.total === 1 ? "deliverable" : "deliverables"} in this
            project
          </span>
        </div>
        <p>
          Drafts need human review. Approved status is shown only when the
          backend record says it has been approved.
        </p>
      </Card>

      {notice ? (
        <div className="artifact-created-notice" role="status">
          <span>
            {notice.kind === "created" ? (
              <>
                <strong>{notice.title}</strong> was created as a draft.
              </>
            ) : (
              "Artifact updated. The new revision is a draft."
            )}
          </span>
          <Button
            aria-label="Dismiss deliverable message"
            onClick={() => setNotice(undefined)}
            size="small"
            type="button"
            variant="ghost"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {targetArtifactId && targetQuery.isPending ? (
        <div className="artifact-target-loading" role="status">
          <LoadingSkeleton lines={3} />
          <p>Locating the linked artifact in project pages…</p>
        </div>
      ) : null}
      {targetArtifactId && targetQuery.isError ? (
        <ErrorPanel
          message={targetError.message}
          requestId={targetError.requestId}
          title="Linked artifact unavailable"
        />
      ) : null}
      {targetArtifactId && targetQuery.data === null ? (
        <ErrorPanel
          message="The artifact couldn't be located in the searchable project pages. The backend doesn't provide a direct artifact lookup endpoint."
          title="Linked artifact not found"
        />
      ) : null}

      <div className="artifact-toolbar">
        <label className="artifact-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search artifacts on this page"
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
            placeholder="Search title, description, IDs, or data keys"
            type="search"
            value={search}
          />
        </label>
        <label className="artifact-filter">
          <span>Status</span>
          <select
            aria-label="Filter artifacts by status"
            onChange={(event) => {
              setStatusFilter(event.currentTarget.value);
              setPage(1);
            }}
            value={statusFilter}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="artifact-filter">
          <span>Type</span>
          <select
            aria-label="Filter artifacts by type"
            onChange={(event) => {
              setTypeFilter(event.currentTarget.value);
              setPage(1);
            }}
            value={typeFilter}
          >
            {typeOptions
              .filter(
                (option) =>
                  option.value === "all" ||
                  (canReadBusiness &&
                    [
                      "epic",
                      "story",
                      "acceptance_criteria",
                      "business_rule",
                    ].includes(option.value)) ||
                  (canReadDelivery &&
                    ["risk", "dependency", "implementation_plan"].includes(
                      option.value,
                    )),
              )
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div aria-busy={artifactsQuery.isFetching} className="artifact-results">
        {artifactsQuery.isPending ? (
          <div
            aria-label="Loading deliverables"
            className="artifact-table-skeleton"
            role="status"
          >
            <LoadingSkeleton lines={6} />
          </div>
        ) : null}
        {artifactsQuery.isError && !result ? (
          <div className="artifact-results__error">
            <ErrorPanel
              message={
                getApiErrorPresentation(
                  artifactsQuery.error,
                  "Deliverables couldn't be loaded. Please try again.",
                ).message
              }
              requestId={
                getApiErrorPresentation(
                  artifactsQuery.error,
                  "Deliverables couldn't be loaded. Please try again.",
                ).requestId
              }
              title="Deliverables unavailable"
            />
            <Button
              disabled={artifactsQuery.isFetching}
              leadingIcon={<RotateCw aria-hidden="true" size={15} />}
              onClick={() => void artifactsQuery.refetch()}
              type="button"
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        ) : null}
        {result && result.total === 0 ? (
          <div className="artifact-empty-panel">
            <EmptyState
              action={
                canPrepare ? (
                  <Button
                    leadingIcon={<Plus aria-hidden="true" size={16} />}
                    onClick={() => setCreateOpen(true)}
                    type="button"
                  >
                    Create a deliverable
                  </Button>
                ) : undefined
              }
              description={
                canPrepare
                  ? "Create a story, risk, plan, or other structured artifact and connect it to project requirements."
                  : "No deliverables are available for this project yet."
              }
              icon={Layers3}
              title={
                canPrepare
                  ? "Your deliverables workspace is ready"
                  : "No deliverables yet"
              }
            />
          </div>
        ) : null}
        {result && result.total > 0 && filteredArtifacts.length === 0 ? (
          <div className="artifact-empty-panel">
            <EmptyState
              action={
                hasFilters ? (
                  <Button
                    onClick={clearFilters}
                    type="button"
                    variant="secondary"
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
              description="Search and filters apply only to the artifacts on this page."
              icon={CircleHelp}
              title="No deliverables match these filters"
            />
          </div>
        ) : null}
        {result && filteredArtifacts.length > 0 ? (
          <DataTable
            caption="Project deliverables on the current page"
            columns={columns}
            rowKey={(artifact) => artifact.id}
            rows={filteredArtifacts}
          />
        ) : null}
        {artifactsQuery.isError && result ? (
          <ErrorPanel
            message={
              getApiErrorPresentation(
                artifactsQuery.error,
                "The current page couldn't be refreshed.",
              ).message
            }
            title="Deliverables may be out of date"
          />
        ) : null}
      </div>

      {result && result.total > 0 ? (
        <nav aria-label="Deliverable pages" className="artifact-pagination">
          <span aria-live="polite">
            Page {result.page} of {totalPages} · {result.total} deliverables
            {artifactsQuery.isPlaceholderData ? ` · Loading page ${page}` : ""}
          </span>
          <div>
            <Button
              aria-label="Previous deliverable page"
              disabled={result.page <= 1 || artifactsQuery.isFetching}
              leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="small"
              type="button"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              aria-label="Next deliverable page"
              disabled={result.page >= totalPages || artifactsQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
              size="small"
              trailingIcon={<ChevronRight aria-hidden="true" size={15} />}
              type="button"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
      {result && result.total > 0 ? (
        <p className="artifact-filter-note">
          Search and filters apply to this page only.
        </p>
      ) : null}

      {canPrepare ? (
        <Dialog
          className="artifact-create-dialog"
          description="Create a project deliverable as a draft. Link requirements and preserve any structured type-specific data."
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) createMutation.reset();
          }}
          open={createOpen}
          title="Create a deliverable"
        >
          <ArtifactForm
            isSubmitting={createMutation.isPending}
            mode="create"
            onCancel={() => setCreateOpen(false)}
            onRetryRequirements={() => void requirementsQuery.refetch()}
            onSubmit={submitCreate}
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
              createMutation.isError ? createError.message : undefined
            }
          />
        </Dialog>
      ) : null}

      {selectedArtifact ? (
        <ArtifactDetailsDialog
          artifact={selectedArtifact}
          fromWorkflow={targetFromWorkflow && Boolean(targetArtifact)}
          key={selectedArtifact.id}
          onOpenChange={closeDetails}
          onSaved={() => {
            setNotice({ kind: "updated" });
          }}
          open
        />
      ) : null}
    </section>
  );
}
