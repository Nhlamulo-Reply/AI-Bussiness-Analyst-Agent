import { ArrowUpRight, CalendarDays, Clock3, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { StatusBadge } from "../ui/StatusBadge";
import {
  formatProjectDate,
  getProjectPath,
} from "../../features/projects/format";
import type { Project } from "../../features/projects/project.schemas";

interface ProjectCardProps {
  project: Project;
  compact?: boolean;
}

export function ProjectCard({ project, compact = false }: ProjectCardProps) {
  const projectPath = getProjectPath(project.id);

  return (
    <Card
      as="article"
      className={`project-card ${compact ? "project-card--compact" : ""}`.trim()}
    >
      <Link className="project-card__main" to={projectPath}>
        <div className="project-card__top">
          <span className="project-card__icon">
            <FolderKanban aria-hidden="true" size={18} />
          </span>
          <StatusBadge
            tone={project.status === "active" ? "success" : "neutral"}
          >
            {project.status === "active" ? "Active" : "Archived"}
          </StatusBadge>
        </div>
        <h2>{project.name}</h2>
        <p>{project.description || "No project description has been added."}</p>
      </Link>
      <div className="project-card__footer">
        <div className="project-card__dates">
          <span>
            <CalendarDays aria-hidden="true" size={13} />
            Created {formatProjectDate(project.createdAt)}
          </span>
          <span>
            <Clock3 aria-hidden="true" size={13} />
            Updated {formatProjectDate(project.updatedAt)}
          </span>
        </div>
        <Link
          aria-label={`Open ${project.name}`}
          className="project-card__open"
          to={projectPath}
        >
          Open
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </Card>
  );
}
