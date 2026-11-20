import {
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProjectCard } from "../components/projects/ProjectCard";
import { Button } from "../components/ui/Button";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useProjects } from "../features/projects/project-queries";
import { formatProjectDate, getProjectPath } from "../features/projects/format";
import type { Project } from "../features/projects/project.schemas";
import { getApiErrorPresentation } from "../lib/api-client";

const pageSize = 12;

export function ProjectListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const projectsQuery = useProjects(page, pageSize);
  const projects = projectsQuery.data;

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const query = search.trim().toLocaleLowerCase();
    return projects.items.filter((project) => {
      const matchesSearch =
        !query ||
        project.name.toLocaleLowerCase().includes(query) ||
        project.description.toLocaleLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const columns: DataTableColumn<Project>[] = [
    {
      key: "project",
      header: "Project",
      render: (project) => (
        <Link className="project-table__link" to={getProjectPath(project.id)}>
          <strong>{project.name}</strong>
          <span>{project.description || "No description added."}</span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (project) => (
        <StatusBadge tone={project.status === "active" ? "success" : "neutral"}>
          {project.status === "active" ? "Active" : "Archived"}
        </StatusBadge>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (project) => formatProjectDate(project.createdAt),
    },
    {
      key: "updated",
      header: "Last updated",
      render: (project) => formatProjectDate(project.updatedAt),
    },
  ];

  const errorPresentation = getApiErrorPresentation(
    projectsQuery.error,
    "Your projects couldn't be loaded. Please try again.",
  );
  const totalPages = projects
    ? Math.max(1, Math.ceil(projects.total / projects.limit))
    : 1;
  const hasFilters = Boolean(search.trim()) || statusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <section aria-labelledby="projects-title" className="projects-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR ANALYSIS WORKSPACE</p>
          <h1 id="projects-title">Projects</h1>
          <p className="page-heading__description">
            Keep the source material, decisions, and next steps for your work
            connected.
          </p>
        </div>
        <Link
          className="button button--primary button--medium"
          to="/app/projects/new"
        >
          <Plus aria-hidden="true" size={17} />
          <span>New project</span>
        </Link>
      </header>

      <div className="project-toolbar">
        <div className="project-filters">
          <label className="project-search">
            <Search aria-hidden="true" size={17} />
            <input
              aria-label="Search projects on this page"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search projects on this page"
              type="search"
              value={search}
            />
          </label>
          <label className="project-status-filter">
            <span>Status</span>
            <select
              aria-label="Filter by status"
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div
          aria-label="Project view"
          className="project-view-switch"
          role="group"
        >
          <Button
            aria-pressed={view === "cards"}
            leadingIcon={<Grid2X2 aria-hidden="true" size={15} />}
            onClick={() => setView("cards")}
            size="small"
            variant={view === "cards" ? "primary" : "secondary"}
          >
            Cards
          </Button>
          <Button
            aria-pressed={view === "table"}
            leadingIcon={<List aria-hidden="true" size={15} />}
            onClick={() => setView("table")}
            size="small"
            variant={view === "table" ? "primary" : "secondary"}
          >
            Table
          </Button>
        </div>
      </div>

      <div aria-busy={projectsQuery.isFetching} className="project-results">
        {projectsQuery.isPending ? (
          <div
            aria-label="Loading projects"
            className="project-card-grid"
            role="status"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div className="project-card project-card--skeleton" key={index}>
                <LoadingSkeleton lines={4} />
              </div>
            ))}
          </div>
        ) : null}

        {projectsQuery.isError && !projects ? (
          <div className="project-error-state">
            <ErrorPanel
              message={errorPresentation.message}
              requestId={errorPresentation.requestId}
              title="Projects are unavailable"
            />
            <Button
              leadingIcon={<RotateCw aria-hidden="true" size={15} />}
              onClick={() => void projectsQuery.refetch()}
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {projects && projects.total === 0 ? (
          <div className="project-empty-panel">
            <EmptyState
              description="Create your first project to give source documents, requirements, and decisions a shared home."
              icon={Plus}
              title="Start with a project"
              action={
                <Link
                  className="button button--primary button--medium"
                  to="/app/projects/new"
                >
                  <Plus aria-hidden="true" size={16} />
                  <span>Create your first project</span>
                </Link>
              }
            />
          </div>
        ) : null}

        {projects && projects.total > 0 && filteredProjects.length === 0 ? (
          <div className="project-empty-panel">
            <EmptyState
              description="Search and status filters apply only to the projects on this page."
              icon={Search}
              title="No projects match these filters"
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

        {projects && filteredProjects.length > 0 && view === "cards" ? (
          <div className="project-card-grid">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : null}

        {projects && filteredProjects.length > 0 && view === "table" ? (
          <DataTable
            caption="Projects on the current page"
            columns={columns}
            rowKey={(project) => project.id}
            rows={filteredProjects}
          />
        ) : null}

        {projectsQuery.isError && projects ? (
          <div className="project-stale-error">
            <ErrorPanel
              message={errorPresentation.message}
              requestId={errorPresentation.requestId}
              title="Couldn't refresh this page"
            />
          </div>
        ) : null}
      </div>

      {projects && projects.total > 0 ? (
        <nav aria-label="Project pages" className="project-pagination">
          <span aria-live="polite">
            Page {projects.page} of {totalPages} · {projects.total} projects
            {projectsQuery.isPlaceholderData ? ` · Loading page ${page}` : ""}
          </span>
          <div>
            <Button
              aria-label="Previous project page"
              disabled={projects.page <= 1 || projectsQuery.isFetching}
              leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="small"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              aria-label="Next project page"
              disabled={projects.page >= totalPages || projectsQuery.isFetching}
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

      {projects && projects.total > 0 ? (
        <p className="project-filter-note">
          Search and status filters apply to this page only.
        </p>
      ) : null}
    </section>
  );
}
