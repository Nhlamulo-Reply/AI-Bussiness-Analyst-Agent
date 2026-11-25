import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ListChecks,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TrashConfirmationDialog } from "../components/ui/TrashConfirmationDialog";
import { MoveToBinMenu } from "../components/ui/MoveToBinMenu";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../features/auth/useAuth";
import { hasPermission } from "../features/auth/permissions";
import { formatProjectDate } from "../features/projects/format";
import { useRequirements } from "../features/requirements/requirement-queries";
import type { Requirement } from "../features/requirements/requirement.schemas";
import { RequirementDetailsDialog } from "../features/requirements/RequirementDetailsDialog";
import { getApiErrorPresentation } from "../lib/api-client";
import { useMoveToTrash } from "../features/trash/trash-queries";

const navigationStateSchema = z
  .object({
    page: z.number().int().positive().optional(),
    createdRequirementId: z.string().min(1).optional(),
  })
  .passthrough();

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const typeOptions = [
  { value: "all", label: "All types" },
  { value: "business", label: "Business" },
  { value: "functional", label: "Functional" },
  { value: "non_functional", label: "Non-functional" },
] as const;

const priorityOptions = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

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

function getStatusTone(status: Requirement["status"]) {
  if (status === "approved") return "success";
  if (status === "reviewed") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

function getPriorityTone(priority: Requirement["priority"]) {
  if (priority === "critical") return "warning";
  if (priority === "high") return "info";
  return "neutral";
}

export function RequirementListRoute() {
  const { projectId = "" } = useParams();
  return <RequirementListPage key={projectId} />;
}

export function RequirementListPage() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const { session } = useAuth();
  const canPrepare = hasPermission(session?.user.roles, "analysis.prepare");
  const navigationState = navigationStateSchema.safeParse(location.state);
  const [page, setPage] = useState(
    navigationState.success ? (navigationState.data.page ?? 1) : 1,
  );
  const [createdRequirementId, setCreatedRequirementId] = useState(
    navigationState.success
      ? navigationState.data.createdRequirementId
      : undefined,
  );
  const [selectedRequirementId, setSelectedRequirementId] = useState<
    string | null
  >(
    navigationState.success
      ? (navigationState.data.createdRequirementId ?? null)
      : null,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [trashTarget, setTrashTarget] = useState<Requirement | null>(null);
  const requirementsQuery = useRequirements(projectId, page);
  const trashMutation = useMoveToTrash();
  const result = requirementsQuery.data;

  const filteredRequirements = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLocaleLowerCase();
    return result.items.filter((requirement) => {
      const matchesSearch =
        !query ||
        requirement.title.toLocaleLowerCase().includes(query) ||
        requirement.description.toLocaleLowerCase().includes(query) ||
        requirement.sourceFacts.some((fact) =>
          fact.toLocaleLowerCase().includes(query),
        );
      const matchesStatus =
        statusFilter === "all" || requirement.status === statusFilter;
      const matchesType =
        typeFilter === "all" || requirement.type === typeFilter;
      const matchesPriority =
        priorityFilter === "all" || requirement.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [priorityFilter, result, search, statusFilter, typeFilter]);

  const columns: DataTableColumn<Requirement>[] = [
    {
      key: "requirement",
      header: "Requirement",
      render: (requirement) => (
        <button
          className="requirement-table__title"
          onClick={() => setSelectedRequirementId(requirement.id)}
          type="button"
        >
          <strong>{requirement.title}</strong>
          <span>{requirement.description || "No description added."}</span>
        </button>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (requirement) => (
        <Badge tone="accent">{typeLabels[requirement.type]}</Badge>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (requirement) => (
        <Badge tone={getPriorityTone(requirement.priority)}>
          {priorityLabels[requirement.priority]}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (requirement) => (
        <StatusBadge tone={getStatusTone(requirement.status)}>
          {statusLabels[requirement.status]}
        </StatusBadge>
      ),
    },
    {
      key: "version",
      header: "Version",
      render: (requirement) => `v${requirement.version}`,
    },
    {
      key: "updated",
      header: "Last updated",
      render: (requirement) => formatProjectDate(requirement.updatedAt),
    },
    {
      key: "actions",
      header: "Actions",
      render: (requirement) => (
        <div className="artifact-table__actions">
          <Button
            onClick={() => setSelectedRequirementId(requirement.id)}
            size="small"
            type="button"
            variant="secondary"
          >
            View
          </Button>
          {canPrepare &&
          requirement.createdByUserId === session?.user.id &&
          requirement.status === "draft" ? (
            <MoveToBinMenu
              disabled={trashMutation.isPending}
              itemLabel={`requirement ${requirement.title}`}
              onMoveToBin={() => setTrashTarget(requirement)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;
  const hasFilters =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    priorityFilter !== "all";
  const errorPresentation = getApiErrorPresentation(
    requirementsQuery.error,
    "Requirements couldn't be loaded. Please try again.",
  );
  const selectedRequirement = result?.items.find(
    (item) => item.id === selectedRequirementId,
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setPriorityFilter("all");
    setPage(1);
  };

  return (
    <section aria-labelledby="requirements-title" className="requirements-page">
      <header className="requirement-page-heading requirement-page-heading--register">
        <span className="requirement-page-heading__icon">
          <ListChecks aria-hidden="true" size={21} />
        </span>
        <div>
          <p className="eyebrow">PROJECT WORKSPACE</p>
          <h1 id="requirements-title">Requirements</h1>
          <p>
            Keep business needs connected to evidence, decisions, and the
            questions your team still needs to answer.
          </p>
        </div>
        {canPrepare ? (
          <Link
            className="button button--primary button--medium"
            to={`/app/projects/${encodeURIComponent(projectId)}/requirements/new`}
          >
            <Plus aria-hidden="true" size={17} />
            <span>New requirement</span>
          </Link>
        ) : null}
      </header>

      {createdRequirementId ? (
        <div className="requirement-created-notice" role="status">
          <span>
            Requirement created as a draft. Its details and version history are
            ready to review.
          </span>
          <Button
            aria-label="Dismiss requirement created message"
            onClick={() => setCreatedRequirementId(undefined)}
            size="small"
            variant="ghost"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="requirement-toolbar">
        <div className="requirement-filters">
          <label className="requirement-search">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="Search requirements on this page"
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              placeholder="Search this page"
              type="search"
              value={search}
            />
          </label>
          <label className="requirement-filter">
            <span>Status</span>
            <select
              aria-label="Filter requirements by status"
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
          <label className="requirement-filter">
            <span>Type</span>
            <select
              aria-label="Filter requirements by type"
              onChange={(event) => {
                setTypeFilter(event.currentTarget.value);
                setPage(1);
              }}
              value={typeFilter}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="requirement-filter">
            <span>Priority</span>
            <select
              aria-label="Filter requirements by priority"
              onChange={(event) => {
                setPriorityFilter(event.currentTarget.value);
                setPage(1);
              }}
              value={priorityFilter}
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div
        aria-busy={requirementsQuery.isFetching}
        className="requirements-results"
      >
        {requirementsQuery.isPending ? (
          <div
            aria-label="Loading requirements"
            className="requirements-table-skeleton"
            role="status"
          >
            <LoadingSkeleton lines={6} />
          </div>
        ) : null}

        {requirementsQuery.isError && !result ? (
          <div className="requirements-error">
            <ErrorPanel
              message={errorPresentation.message}
              requestId={errorPresentation.requestId}
              title="Requirements are unavailable"
            />
            <Button
              disabled={requirementsQuery.isFetching}
              leadingIcon={<RotateCw aria-hidden="true" size={15} />}
              onClick={() => void requirementsQuery.refetch()}
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {result && result.total === 0 ? (
          <div className="requirements-empty-panel">
            <EmptyState
              description="Capture the first business need and connect it to the facts, assumptions, and questions that shape it."
              icon={Plus}
              title="Start your requirements register"
              action={
                canPrepare ? (
                  <Link
                    className="button button--primary button--medium"
                    to={`/app/projects/${encodeURIComponent(projectId)}/requirements/new`}
                  >
                    <Plus aria-hidden="true" size={16} />
                    <span>Create a requirement</span>
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {result && result.total > 0 && filteredRequirements.length === 0 ? (
          <div className="requirements-empty-panel">
            <EmptyState
              description="Search and filters apply only to the requirements on this page."
              icon={CircleHelp}
              title="No requirements match these filters"
              action={
                hasFilters ? (
                  <Button onClick={clearFilters} variant="secondary">
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {result && filteredRequirements.length > 0 ? (
          <DataTable
            caption="Requirements on the current page"
            columns={columns}
            emptyMessage="No requirements are available on this page."
            rowKey={(requirement) => requirement.id}
            rows={filteredRequirements}
          />
        ) : null}

        {requirementsQuery.isError && result ? (
          <div className="requirements-stale-error">
            <ErrorPanel
              message={errorPresentation.message}
              requestId={errorPresentation.requestId}
              title="Couldn't refresh this page"
            />
          </div>
        ) : null}
      </div>

      {result && result.total > 0 ? (
        <nav aria-label="Requirement pages" className="requirement-pagination">
          <span aria-live="polite">
            Page {result.page} of {totalPages} · {result.total} requirements
            {requirementsQuery.isPlaceholderData
              ? ` · Loading page ${page}`
              : ""}
          </span>
          <div>
            <Button
              aria-label="Previous requirement page"
              disabled={result.page <= 1 || requirementsQuery.isFetching}
              leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="small"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              aria-label="Next requirement page"
              disabled={
                result.page >= totalPages || requirementsQuery.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
              size="small"
              trailingIcon={<ChevronRight aria-hidden="true" size={15} />}
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}

      {result && result.total > 0 ? (
        <p className="requirement-filter-note">
          Search and filters apply to this page only.
        </p>
      ) : null}

      {selectedRequirement ? (
        <RequirementDetailsDialog
          onOpenChange={(open) => {
            if (!open) setSelectedRequirementId(null);
          }}
          open
          projectId={projectId}
          requirement={selectedRequirement}
        />
      ) : null}
      <TrashConfirmationDialog
        error={
          trashMutation.isError
            ? getApiErrorPresentation(
                trashMutation.error,
                "The requirement couldn't be moved to the bin.",
              ).message
            : undefined
        }
        isPending={trashMutation.isPending}
        itemLabel={trashTarget?.title ?? ""}
        onConfirm={() => {
          if (!trashTarget) return;
          trashMutation.mutate(
            { resourceType: "requirement", resourceId: trashTarget.id },
            {
              onSuccess: () => {
                setSelectedRequirementId(null);
                setTrashTarget(null);
              },
            },
          );
        }}
        onOpenChange={(open) => {
          if (!open && !trashMutation.isPending) {
            setTrashTarget(null);
            trashMutation.reset();
          }
        }}
        open={Boolean(trashTarget)}
        requestId={
          trashMutation.isError
            ? getApiErrorPresentation(
                trashMutation.error,
                "The requirement couldn't be moved to the bin.",
              ).requestId
            : undefined
        }
      />
    </section>
  );
}
