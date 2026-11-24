import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FileStack,
  Lightbulb,
  MessageSquareText,
  Plus,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProjectCard } from "../components/projects/ProjectCard";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useAuth } from "../features/auth/useAuth";
import { getRoleLabel } from "../features/auth/role-label";
import { hasPermission } from "../features/auth/permissions";
import {
  useApprovalDashboard,
  useDeliveryReviewDashboard,
} from "../features/approvals/approval-queries";
import { useProjects } from "../features/projects/project-queries";
import type { Project } from "../features/projects/project.schemas";
import { getProjectPath } from "../features/projects/format";
import { getApiErrorPresentation } from "../lib/api-client";
import { Dialog } from "../components/ui/Dialog";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";

const principles = [
  {
    icon: FileStack,
    title: "Keep context connected",
    copy: "Bring source material, requirements, and decisions into one considered workspace.",
    tone: "violet",
  },
  {
    icon: Lightbulb,
    title: "Make the unknown visible",
    copy: "Keep assumptions, open questions, and supporting evidence close to the work.",
    tone: "amber",
  },
  {
    icon: ClipboardCheck,
    title: "Move forward with care",
    copy: "Treat AI output as a draft, then give people a clear path to review and refine it.",
    tone: "mint",
  },
];

const workflowSteps = [
  { number: "01", label: "Bring in context", icon: FileStack },
  { number: "02", label: "Explore the problem", icon: Sparkles },
  { number: "03", label: "Review the evidence", icon: ClipboardCheck },
  { number: "04", label: "Share clear outcomes", icon: MessageSquareText },
];

export function OverviewPage() {
  const [guideOpen, setGuideOpen] = useState(false);
  const { session } = useAuth();
  const roles = session?.user.roles;
  const isBusinessAnalyst = hasPermission(roles, "analysis.prepare");
  const isProductOwner = hasPermission(roles, "approval.decide_business");
  const isDeliveryLead = hasPermission(roles, "delivery.review");
  const projectsQuery = useProjects(1, 100);
  const projects = projectsQuery.data;
  const approvalQueue = useApprovalDashboard(
    projects?.items ?? [],
    isProductOwner,
  );
  const deliveryQueue = useDeliveryReviewDashboard(
    projects?.items ?? [],
    isDeliveryLead,
  );
  const availableProjects = useMemo(
    () =>
      [...(projects?.items ?? [])]
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        )
        .slice(0, 3),
    [projects],
  );
  const errorPresentation = getApiErrorPresentation(
    projectsQuery.error,
    "Your projects couldn't be loaded. Please try again.",
  );

  if (!isBusinessAnalyst) {
    return (
      <>
        {isProductOwner ? (
          <ProjectQueueSection
            description="Review submissions across your projects. AI-generated work remains a draft until a Product Owner makes a human decision."
            eyebrow="PRODUCT OWNER WORKSPACE"
            isLoading={
              projectsQuery.isPending ||
              Boolean(projects?.items.length && approvalQueue.isPending)
            }
            items={approvalQueue.data}
            itemLabel="pending approval"
            itemRouteSuffix="/approvals"
            projects={projects?.items}
            projectsError={
              projectsQuery.isError && !projects
                ? getApiErrorPresentation(
                    projectsQuery.error,
                    "Your projects couldn't be loaded.",
                  )
                : undefined
            }
            primaryHeading={!isBusinessAnalyst}
            queueError={
              approvalQueue.isError
                ? getApiErrorPresentation(
                    approvalQueue.error,
                    "Your approval queues couldn't be loaded.",
                  )
                : undefined
            }
            title="Approval queue"
          />
        ) : null}
        {isDeliveryLead ? (
          <ProjectQueueSection
            description="Review delivery risks, dependencies, and implementation plans. You can add feedback; a Product Owner remains responsible for the decision."
            eyebrow="DELIVERY LEAD WORKSPACE"
            isLoading={
              projectsQuery.isPending ||
              Boolean(projects?.items.length && deliveryQueue.isPending)
            }
            items={deliveryQueue.data}
            itemLabel="pending delivery review"
            itemRouteSuffix="/delivery-reviews"
            projects={projects?.items}
            projectsError={
              projectsQuery.isError && !projects
                ? getApiErrorPresentation(
                    projectsQuery.error,
                    "Your projects couldn't be loaded.",
                  )
                : undefined
            }
            primaryHeading={!isBusinessAnalyst && !isProductOwner}
            queueError={
              deliveryQueue.isError
                ? getApiErrorPresentation(
                    deliveryQueue.error,
                    "Your delivery review queues couldn't be loaded.",
                  )
                : undefined
            }
            title="Delivery feedback queue"
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {isProductOwner ? (
        <ProjectQueueSection
          description="Review submissions across your projects. AI-generated work remains a draft until a Product Owner makes a human decision."
          eyebrow="PRODUCT OWNER WORKSPACE"
          isLoading={
            projectsQuery.isPending ||
            Boolean(projects?.items.length && approvalQueue.isPending)
          }
          items={approvalQueue.data}
          itemLabel="pending approval"
          itemRouteSuffix="/approvals"
          projects={projects?.items}
          projectsError={
            projectsQuery.isError && !projects
              ? getApiErrorPresentation(
                  projectsQuery.error,
                  "Your projects couldn't be loaded.",
                )
              : undefined
          }
          primaryHeading={!isBusinessAnalyst}
          queueError={
            approvalQueue.isError
              ? getApiErrorPresentation(
                  approvalQueue.error,
                  "Your approval queues couldn't be loaded.",
                )
              : undefined
          }
          title="Approval queue"
        />
      ) : null}
      {isDeliveryLead ? (
        <ProjectQueueSection
          description="Review delivery risks, dependencies, and implementation plans. You can add feedback; a Product Owner remains responsible for the decision."
          eyebrow="DELIVERY LEAD WORKSPACE"
          isLoading={
            projectsQuery.isPending ||
            Boolean(projects?.items.length && deliveryQueue.isPending)
          }
          items={deliveryQueue.data}
          itemLabel="pending delivery review"
          itemRouteSuffix="/delivery-reviews"
          projects={projects?.items}
          projectsError={
            projectsQuery.isError && !projects
              ? getApiErrorPresentation(
                  projectsQuery.error,
                  "Your projects couldn't be loaded.",
                )
              : undefined
          }
          primaryHeading={!isBusinessAnalyst && !isProductOwner}
          queueError={
            deliveryQueue.isError
              ? getApiErrorPresentation(
                  deliveryQueue.error,
                  "Your delivery review queues couldn't be loaded.",
                )
              : undefined
          }
          title="Delivery feedback queue"
        />
      ) : null}
      <section aria-labelledby="overview-title" className="hero-panel">
        <div className="hero-panel__copy">
          <p className="eyebrow">
            <span className="eyebrow__sparkle">
              <Sparkles aria-hidden="true" size={14} />
            </span>
            {getRoleLabel("business_analyst").toUpperCase()}, IN FOCUS
          </p>
          <h1 id="overview-title">
            Turn complex inputs into <em>clear decisions.</em>
          </h1>
          <p className="hero-panel__description">
            A thoughtful place to connect business context, uncover what
            matters, and shape work your team can trust.
          </p>
          <p className="overview-greeting">
            Signed in as <strong>{session?.user.email}</strong>
          </p>
          <div className="hero-panel__actions">
            <Link
              className="button button--primary button--medium"
              to="/app/projects/new"
            >
              <Plus aria-hidden="true" size={17} />
              <span>Create project</span>
            </Link>
            <Link className="text-button" to="/app/projects">
              View all projects
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
            <button
              className="text-button"
              onClick={() => setGuideOpen(true)}
              type="button"
            >
              See how it works
              <ArrowUpRight aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="hero-panel__note">
            <span aria-hidden="true" className="hero-panel__note-dot" />
            Your project context stays connected to your account
          </div>
        </div>
        <div aria-hidden="true" className="hero-visual">
          <div className="hero-visual__orbit hero-visual__orbit--outer" />
          <div className="hero-visual__orbit hero-visual__orbit--inner" />
          <div className="hero-visual__sparkle hero-visual__sparkle--one">
            <Sparkles size={16} />
          </div>
          <div className="hero-visual__sparkle hero-visual__sparkle--two">
            <span />
          </div>
          <div className="analysis-card">
            <div className="analysis-card__topline">
              <span className="analysis-card__icon">
                <Sparkles size={15} />
              </span>
              <span>ANALYSIS WORKSPACE</span>
              <span className="analysis-card__dots">•••</span>
            </div>
            <div className="analysis-card__title">
              <span />
              <span />
            </div>
            <div className="analysis-card__body">
              <span />
              <span />
              <span />
            </div>
            <div className="analysis-card__divider" />
            <div className="analysis-card__footer">
              <span className="analysis-card__source">
                <FileStack size={13} />
                Evidence stays close
              </span>
              <span className="analysis-card__draft">
                Human review built in
              </span>
            </div>
          </div>
          <span className="hero-visual__caption">Clarity at every step</span>
        </div>
      </section>

      <section
        aria-labelledby="overview-projects-title"
        className="overview-projects"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR WORK, IN ONE PLACE</p>
            <h2 id="overview-projects-title">Your project workspace.</h2>
          </div>
          {projects && projects.total > 0 ? (
            <Link className="text-button" to="/app/projects">
              Browse all {projects.total} projects
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          ) : null}
        </div>

        {projectsQuery.isPending ? (
          <div
            aria-label="Loading projects"
            className="project-card-grid project-card-grid--overview"
            role="status"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <div className="project-card project-card--skeleton" key={index}>
                <LoadingSkeleton lines={4} />
              </div>
            ))}
          </div>
        ) : null}

        {projectsQuery.isError && !projects ? (
          <div className="overview-projects__error">
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
          <div className="onboarding-panel">
            <div className="onboarding-panel__intro">
              <EmptyState
                description="Create a shared home for the documents, requirements, and decisions your team needs to keep connected."
                icon={Plus}
                title="Your first project starts here."
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
            <ol
              aria-label="Suggested project steps"
              className="onboarding-steps"
            >
              <OnboardingStep
                number="01"
                state="current"
                title="Create a project"
                description="Set a name and a clear purpose."
              />
              <OnboardingStep
                number="02"
                state="upcoming"
                title="Add source documents"
                description="Bring authorized material into context."
              />
              <OnboardingStep
                number="03"
                state="upcoming"
                title="Explore requirements"
                description="Connect needs to their evidence."
              />
            </ol>
          </div>
        ) : null}

        {projects && projects.total > 0 ? (
          <div className="project-card-grid project-card-grid--overview">
            {availableProjects.map((project) => (
              <ProjectCard compact key={project.id} project={project} />
            ))}
          </div>
        ) : null}

        {projectsQuery.isError && projects ? (
          <div className="overview-projects__stale-error">
            <ErrorPanel
              message={errorPresentation.message}
              requestId={errorPresentation.requestId}
              title="Couldn't refresh your projects"
            />
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="principles-title"
        className="principles-section"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">A BETTER WAY TO WORK THROUGH COMPLEXITY</p>
            <h2 id="principles-title">Thoughtful by design.</h2>
          </div>
          <p className="section-heading__aside">
            Less noise between the source and the decision.
          </p>
        </div>
        <div className="principles-grid">
          {principles.map(({ icon: Icon, title, copy, tone }, index) => (
            <article className="principle-card" key={title}>
              <div
                className={`principle-card__icon principle-card__icon--${tone}`}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              </div>
              <span className="principle-card__number">{`0${index + 1}`}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="workflow-title" className="workflow-preview">
        <div className="workflow-preview__heading">
          <div>
            <p className="eyebrow">FROM FIRST SOURCE TO SHARED OUTCOME</p>
            <h2 id="workflow-title">A clear path through the work.</h2>
          </div>
          <span className="workflow-preview__badge">
            <span />
            One connected process
          </span>
        </div>
        <ol className="workflow-steps">
          {workflowSteps.map(({ number, label, icon: Icon }) => (
            <li className="workflow-step" key={number}>
              <span className="workflow-step__icon">
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              </span>
              <span className="workflow-step__number">{number}</span>
              <strong>{label}</strong>
              {number !== "04" ? (
                <ArrowRight
                  aria-hidden="true"
                  className="workflow-step__arrow"
                  size={15}
                />
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <Dialog
        description="A human-centered process for business analysis."
        onOpenChange={setGuideOpen}
        open={guideOpen}
        title="From context to clarity"
      >
        <p className="guide-copy">
          Start with the information your team already has. Work through
          requirements and open questions with source evidence in view. AI
          suggestions stay drafts until a person reviews them.
        </p>
        <ol className="guide-list">
          {workflowSteps.map(({ number, label }) => (
            <li key={number}>
              <span>{number}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}

function ProjectQueueSection({
  description,
  eyebrow,
  isLoading,
  items,
  itemLabel,
  itemRouteSuffix,
  projects,
  projectsError,
  primaryHeading,
  queueError,
  title,
}: {
  description: string;
  eyebrow: string;
  isLoading: boolean;
  items:
    | Array<{
        project: Project;
        count: number;
      }>
    | undefined;
  itemLabel: string;
  itemRouteSuffix: string;
  projects: Project[] | undefined;
  projectsError?: ReturnType<typeof getApiErrorPresentation>;
  primaryHeading: boolean;
  queueError?: ReturnType<typeof getApiErrorPresentation>;
  title: string;
}) {
  const headingId = `role-queue-${title.toLowerCase().replaceAll(" ", "-")}`;
  const Heading = primaryHeading ? "h1" : "h2";
  const counts = useMemo(() => {
    const projectCounts = new Map<string, number>();
    for (const item of items ?? []) {
      projectCounts.set(
        item.project.id,
        (projectCounts.get(item.project.id) ?? 0) + item.count,
      );
    }
    return projectCounts;
  }, [items]);

  return (
    <section aria-labelledby={headingId} className="overview-projects">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <Heading id={headingId}>{title}</Heading>
          <p className="section-heading__aside">{description}</p>
        </div>
      </div>
      {projectsError ? (
        <ErrorPanel
          message={projectsError.message}
          requestId={projectsError.requestId}
          title="Projects are unavailable"
        />
      ) : null}
      {queueError ? (
        <ErrorPanel
          message={queueError.message}
          requestId={queueError.requestId}
          title="Review queue unavailable"
        />
      ) : null}
      {isLoading ? (
        <div aria-busy="true" role="status">
          <LoadingSkeleton lines={4} />
        </div>
      ) : projects?.length === 0 && !projectsError ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No project access yet"
            description="An administrator can add you to projects that need your review."
          />
        </Card>
      ) : items && !queueError ? (
        <div className="project-card-grid">
          {(projects ?? []).map((project) => {
            const count = counts.get(project.id) ?? 0;
            return (
              <Card
                as="article"
                className="project-card project-card--compact"
                key={project.id}
              >
                <div className="project-card__top">
                  <h2>{project.name}</h2>
                  <StatusBadge tone={count ? "warning" : "success"}>
                    {count} {itemLabel}
                    {count === 1 ? "" : "s"}
                  </StatusBadge>
                </div>
                <p>
                  {count
                    ? `${count} item${count === 1 ? "" : "s"} need your attention.`
                    : `No ${itemLabel}s need attention right now.`}
                </p>
                <Link
                  className="project-card__open"
                  to={`${getProjectPath(project.id)}${itemRouteSuffix}`}
                >
                  Open {itemLabel} queue
                  <ArrowUpRight aria-hidden="true" size={14} />
                </Link>
              </Card>
            );
          })}
        </div>
      ) : null}
      {!isLoading && !projectsError && projects && projects.length === 0 ? (
        <Link className="text-button" to="/app/projects">
          Browse projects
          <ArrowRight aria-hidden="true" size={15} />
        </Link>
      ) : null}
    </section>
  );
}

function OnboardingStep({
  number,
  state,
  title,
  description,
}: {
  number: string;
  state: "current" | "upcoming";
  title: string;
  description: string;
}) {
  return (
    <li className={`onboarding-step onboarding-step--${state}`}>
      <span className="onboarding-step__number">{number}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {state === "current" ? (
        <span className="onboarding-step__state">Start here</span>
      ) : null}
    </li>
  );
}
