import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Download,
  FileStack,
  ListChecks,
  LoaderCircle,
  RotateCw,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../features/auth/useAuth";
import { formatProjectDate } from "../features/projects/format";
import { useProject } from "../features/projects/project-queries";
import { getApiErrorPresentation } from "../lib/api-client";

export function ProjectOverviewPage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const projectQuery = useProject(projectId);
  const project = projectQuery.data;

  if (projectQuery.isPending) {
    return (
      <section
        aria-busy="true"
        className="project-detail-loading"
        role="status"
      >
        <span>
          <LoaderCircle aria-hidden="true" className="spin" size={17} />
          Loading project
        </span>
        <LoadingSkeleton lines={5} />
      </section>
    );
  }

  if (!project) {
    const errorPresentation = getApiErrorPresentation(
      projectQuery.error,
      "The project couldn't be loaded. Please try again.",
    );
    return (
      <section className="project-detail-error">
        <ErrorPanel
          message={errorPresentation.message}
          requestId={errorPresentation.requestId}
          title="Project unavailable"
        />
        <div className="project-detail-error__actions">
          <Button
            disabled={projectQuery.isFetching}
            leadingIcon={<RotateCw aria-hidden="true" size={15} />}
            onClick={() => void projectQuery.refetch()}
            variant="secondary"
          >
            Try again
          </Button>
          <Link
            className="button button--ghost button--medium"
            to="/app/projects"
          >
            <ArrowLeft aria-hidden="true" size={15} />
            <span>All projects</span>
          </Link>
        </div>
      </section>
    );
  }

  const isOwner = project.ownerUserId === session?.user.id;
  const quickActions = [
    {
      title: "Add source documents",
      description: "Bring relevant material into this project.",
      to: "documents",
      icon: FileStack,
      number: "01",
    },
    {
      title: "Review requirements",
      description: "Connect business needs to their source evidence.",
      to: "requirements",
      icon: ListChecks,
      number: "02",
    },
    {
      title: "Run an analysis",
      description: "Explore a structured, human-reviewed AI workflow.",
      to: "workflows",
      icon: Sparkles,
      number: "03",
    },
    {
      title: "Create a deliverable",
      description: "Shape requirements into a useful team artifact.",
      to: "artifacts",
      icon: ArrowUpRight,
      number: "04",
    },
    {
      title: "Export project data",
      description: "Prepare project information to share with your team.",
      to: "exports",
      icon: Download,
      number: "05",
    },
  ];

  return (
    <section aria-labelledby="project-title" className="project-overview">
      <Link className="project-back-link" to="/app/projects">
        <ArrowLeft aria-hidden="true" size={15} />
        All projects
      </Link>

      <header className="project-overview__heading">
        <div>
          <p className="eyebrow">PROJECT WORKSPACE</p>
          <h1 id="project-title">{project.name}</h1>
          <p>
            {project.description ||
              "This project is ready for its first source and next steps."}
          </p>
        </div>
        <StatusBadge tone={project.status === "active" ? "success" : "neutral"}>
          {project.status === "active" ? "Active" : "Archived"}
        </StatusBadge>
      </header>

      <div className="project-overview__facts">
        <Card className="project-fact">
          <span className="project-fact__icon">
            <Clock3 aria-hidden="true" size={17} />
          </span>
          <span>
            <small>Created</small>
            <strong>{formatProjectDate(project.createdAt)}</strong>
          </span>
        </Card>
        <Card className="project-fact">
          <span className="project-fact__icon">
            <CalendarDays aria-hidden="true" size={17} />
          </span>
          <span>
            <small>Last updated</small>
            <strong>{formatProjectDate(project.updatedAt)}</strong>
          </span>
        </Card>
        <Card className="project-fact">
          <span className="project-fact__icon">
            <UsersRound aria-hidden="true" size={17} />
          </span>
          <span>
            <small>Access</small>
            <strong>{isOwner ? "Project owner" : "Shared with you"}</strong>
          </span>
        </Card>
      </div>

      <div className="project-overview__section-heading">
        <div>
          <p className="eyebrow">A CLEAR PATH THROUGH THE WORK</p>
          <h2>Choose your next step</h2>
        </div>
        <span>Follow the evidence at your own pace.</span>
      </div>

      <div className="project-action-grid">
        {quickActions.map(({ title, description, to, icon: Icon, number }) => (
          <Link
            className="project-action"
            key={to}
            to={`/app/projects/${encodeURIComponent(project.id)}/${to}`}
          >
            <span className="project-action__number">{number}</span>
            <span className="project-action__icon">
              <Icon aria-hidden="true" size={18} />
            </span>
            <strong>{title}</strong>
            <span className="project-action__description">{description}</span>
            <span className="project-action__link">
              Open section
              <ArrowRight aria-hidden="true" size={14} />
            </span>
          </Link>
        ))}
      </div>

      <p className="project-overview__note">
        Project details are read-only here. Changes to project settings are not
        available through the current API.
      </p>
    </section>
  );
}
