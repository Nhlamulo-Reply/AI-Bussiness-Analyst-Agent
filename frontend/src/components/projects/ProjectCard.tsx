import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  FolderKanban,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { MoveToBinMenu } from "../ui/MoveToBinMenu";
import { StatusBadge } from "../ui/StatusBadge";
import {
  formatProjectDate,
  getProjectPath,
} from "../../features/projects/format";
import type { Project } from "../../features/projects/project.schemas";
import { getProjectSummary } from "../../features/projects/project.schemas";

interface ProjectCardProps {
  project: Project;
  compact?: boolean;
  onMoveToBin?: () => void;
  binActionDisabled?: boolean;
}

export function ProjectCard({
  project,
  compact = false,
  onMoveToBin,
  binActionDisabled = false,
}: ProjectCardProps) {
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
          {compact ? (
            <span className="project-card__identity">
              <strong>{project.name}</strong>
              <span>{getProjectSummary(project)}</span>
            </span>
          ) : null}
          <StatusBadge
            tone={project.status === "active" ? "success" : "neutral"}
          >
            {project.status === "active" ? "Active" : "Archived"}
          </StatusBadge>
        </div>
        {!compact ? (
          <>
            <h2>{project.name}</h2>
            <p>{getProjectSummary(project)}</p>
          </>
        ) : null}
      </Link>
      <div className="project-card__footer">
        <div className="project-card__dates">
          <span>
            <CalendarDays aria-hidden="true" size={13} />
            Created {formatProjectDate(project.createdAt)}
          </span>
          {compact ? (
            <span>
              <UsersRound aria-hidden="true" size={13} />
              {project.members.length} members
            </span>
          ) : (
            <span>
              <Clock3 aria-hidden="true" size={13} />
              Updated {formatProjectDate(project.updatedAt)}
            </span>
          )}
        </div>
        <Link
          aria-label={`Open Project: ${project.name}`}
          className="project-card__open"
          to={projectPath}
        >
          Open Project
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
        {onMoveToBin ? (
          <MoveToBinMenu
            disabled={binActionDisabled}
            itemLabel={`project ${project.name}`}
            onMoveToBin={onMoveToBin}
          />
        ) : null}
      </div>
    </Card>
  );
}
