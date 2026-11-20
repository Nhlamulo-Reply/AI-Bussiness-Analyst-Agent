import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Files,
  ListChecks,
  Map,
  RotateCw,
  ShieldAlert,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useAuth } from "../features/auth/useAuth";
import {
  formatFileSize,
  getDocumentTypeLabel,
} from "../features/documents/document.schemas";
import { useProjectDocuments } from "../features/documents/document-queries";
import {
  useRequirements,
  requirementKeys,
} from "../features/requirements/requirement-queries";
import type { Requirement } from "../features/requirements/requirement.schemas";
import {
  useWorkflowArtifacts,
  useSubmitWorkflow,
  workflowKeys,
} from "../features/workflows/workflow-queries";
import { WorkflowExecutionCard } from "../features/workflows/WorkflowExecutionCard";
import {
  workflowJobSchema,
  type Execution,
  type WorkflowJob,
  type WorkflowName,
} from "../features/workflows/workflow.schemas";
import { getApiErrorPresentation } from "../lib/api-client";

type WorkflowContext = "documents" | "requirements" | "story" | "validation";

interface WorkflowDefinition {
  name: WorkflowName;
  title: string;
  description: string;
  requiredContext: string;
  output: string;
  icon: LucideIcon;
  context: WorkflowContext;
}

interface PendingRun {
  workflowName: WorkflowName;
  input: WorkflowJob;
}

const workflows: WorkflowDefinition[] = [
  {
    name: "requirements-analysis",
    title: "Analyze requirements",
    description:
      "Surface stakeholders, assumptions, gaps, and decision-ready insights from source material.",
    requiredContext: "One or more selected source documents",
    output: "A structured analysis with questions and recommendations",
    icon: FileSearch,
    context: "documents",
  },
  {
    name: "requirements-extraction",
    title: "Extract requirements",
    description:
      "Turn evidence in selected documents into traceable, reviewable requirement drafts.",
    requiredContext: "One to ten selected source documents",
    output: "Draft requirements with source facts and uncertainties",
    icon: Files,
    context: "documents",
  },
  {
    name: "story-generation",
    title: "Generate user stories",
    description:
      "Translate selected business needs into focused stories linked to their requirements.",
    requiredContext: "At least one selected requirement",
    output: "Draft stories linked to selected requirements",
    icon: WandSparkles,
    context: "requirements",
  },
  {
    name: "acceptance-criteria-generation",
    title: "Generate acceptance criteria",
    description:
      "Make an existing story easier to review with clear, testable scenarios.",
    requiredContext: "One existing story artifact",
    output: "Draft Given / When / Then acceptance criteria",
    icon: ClipboardCheck,
    context: "story",
  },
  {
    name: "requirements-validation",
    title: "Validate project context",
    description:
      "Look for gaps, inconsistencies, and traceability issues across project records.",
    requiredContext: "Project requirements or existing artifacts",
    output: "Findings with severity and suggested next steps",
    icon: CheckCircle2,
    context: "validation",
  },
  {
    name: "risk-analysis",
    title: "Analyze risks",
    description:
      "Explore delivery risks and dependencies grounded in selected requirements.",
    requiredContext: "At least one selected requirement",
    output: "Draft risks, mitigations, and dependencies",
    icon: ShieldAlert,
    context: "requirements",
  },
  {
    name: "roadmap-generation",
    title: "Generate a roadmap",
    description:
      "Group selected requirements into a practical sequence of delivery milestones.",
    requiredContext: "At least one selected requirement",
    output: "Draft milestones with requirement traceability",
    icon: Map,
    context: "requirements",
  },
];

const formatSize = (sizeBytes: number) => formatFileSize(sizeBytes);

function getRunUnavailableReason({
  workflow,
  documentsLoading,
  requirementsLoading,
  artifactsLoading,
  documentsError,
  requirementsError,
  artifactsError,
  documentCount,
  selectedDocumentIds,
  requirementCount,
  selectedRequirementIds,
  storyCount,
  selectedStoryId,
  artifactCount,
  contextLimitReached,
}: {
  workflow: WorkflowDefinition | null;
  documentsLoading: boolean;
  requirementsLoading: boolean;
  artifactsLoading: boolean;
  documentsError: boolean;
  requirementsError: boolean;
  artifactsError: boolean;
  documentCount: number;
  selectedDocumentIds: string[];
  requirementCount: number;
  selectedRequirementIds: string[];
  storyCount: number;
  selectedStoryId: string;
  artifactCount: number;
  contextLimitReached: boolean;
}) {
  if (!workflow) return "Choose a workflow to configure its inputs.";
  if (
    requirementsLoading ||
    artifactsLoading ||
    (workflow.context === "documents" && documentsLoading)
  ) {
    return "Loading project context…";
  }
  if (
    requirementsError ||
    artifactsError ||
    (workflow.context === "documents" && documentsError)
  ) {
    return "Resolve the project context loading issue before starting a run.";
  }
  if (contextLimitReached) {
    return "This project exceeds the 100-requirement or 100-artifact context limit. Reduce the project context before running a workflow.";
  }

  if (workflow.context === "documents") {
    if (documentCount === 0) return "Upload a source document first.";
    if (selectedDocumentIds.length === 0) {
      return "Select at least one source document.";
    }
    if (selectedDocumentIds.length > 10) {
      return "Select no more than ten source documents.";
    }
  }
  if (
    workflow.context === "requirements" &&
    (requirementCount === 0 || selectedRequirementIds.length === 0)
  ) {
    return "Create or select at least one requirement.";
  }
  if (workflow.context === "story" && storyCount === 0) {
    return "Generate or add a user story before creating acceptance criteria.";
  }
  if (workflow.context === "story" && !selectedStoryId) {
    return "Select the story to receive acceptance criteria.";
  }
  if (
    workflow.context === "validation" &&
    requirementCount === 0 &&
    artifactCount === 0
  ) {
    return "Add a requirement or project artifact before validating.";
  }
  return undefined;
}

export function WorkflowWorkbenchRoute() {
  const { projectId = "" } = useParams();
  return <WorkflowWorkbenchPage key={projectId} />;
}

export function WorkflowWorkbenchPage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const documentsQuery = useProjectDocuments(projectId);
  const requirementsQuery = useRequirements(projectId, 1, 100);
  const artifactsQuery = useWorkflowArtifacts(projectId);
  const submitMutation = useSubmitWorkflow(projectId);
  const documents = documentsQuery.data ?? [];
  const requirements = requirementsQuery.data?.items ?? [];
  const artifacts = artifactsQuery.data?.items ?? [];
  const stories = artifacts.filter((artifact) => artifact.type === "story");
  const [selectedWorkflowName, setSelectedWorkflowName] =
    useState<WorkflowName | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<
    string[]
  >([]);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [runs, setRuns] = useState<Execution[]>([]);
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [selectionError, setSelectionError] = useState<string>();
  const submitGuard = useRef(false);
  const currentWorkflow =
    workflows.find(({ name }) => name === selectedWorkflowName) ?? null;
  const artifactCount = artifactsQuery.data?.total ?? 0;
  const requirementCount = requirementsQuery.data?.total ?? 0;
  const documentCount = documents.length;
  const contextLimitReached = requirementCount > 100 || artifactCount > 100;

  const unavailableReason = getRunUnavailableReason({
    workflow: currentWorkflow,
    documentsLoading: documentsQuery.isPending,
    requirementsLoading: requirementsQuery.isPending,
    artifactsLoading: artifactsQuery.isPending,
    documentsError: documentsQuery.isError,
    requirementsError: requirementsQuery.isError,
    artifactsError: artifactsQuery.isError,
    documentCount,
    selectedDocumentIds,
    requirementCount,
    selectedRequirementIds,
    storyCount: stories.length,
    selectedStoryId,
    artifactCount,
    contextLimitReached,
  });
  const requiresDocumentConfirmation =
    pendingRun !== null && pendingRun.input.documentIds !== undefined;
  const submitError = getApiErrorPresentation(
    submitMutation.error,
    "The workflow couldn't be started. Please review the project context.",
  );

  const handleExecutionComplete = (execution: Execution) => {
    if (!userId) return;
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: requirementKeys.lists(userId, projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: workflowKeys.artifactLists(userId, projectId),
      }),
    ]);
    setRuns((current) =>
      current.map((run) => (run.id === execution.id ? execution : run)),
    );
  };

  const selectWorkflow = (workflow: WorkflowDefinition) => {
    submitMutation.reset();
    setSelectionError(undefined);
    setSelectedWorkflowName(workflow.name);
    setSelectedDocumentIds([]);
    setSelectedRequirementIds([]);
    setSelectedStoryId("");
  };

  const openConfirmation = () => {
    if (!currentWorkflow || unavailableReason) return;
    const input: WorkflowJob = { projectId };
    if (currentWorkflow.context === "documents") {
      input.documentIds = selectedDocumentIds;
    } else if (currentWorkflow.context === "requirements") {
      input.requirementIds = selectedRequirementIds;
    } else if (currentWorkflow.context === "validation") {
      if (selectedRequirementIds.length > 0) {
        input.requirementIds = selectedRequirementIds;
      }
    } else if (currentWorkflow.context === "story") {
      input.storyId = selectedStoryId;
    }

    const parsedInput = workflowJobSchema.safeParse(input);
    if (!parsedInput.success) {
      setSelectionError(
        "The selected context is incomplete. Check your selections and try again.",
      );
      return;
    }

    submitMutation.reset();
    setSelectionError(undefined);
    setPrivacyConfirmed(false);
    setPendingRun({
      workflowName: currentWorkflow.name,
      input: parsedInput.data,
    });
    setConfirmationOpen(true);
  };

  const confirmRun = () => {
    if (
      !pendingRun ||
      submitMutation.isPending ||
      submitGuard.current ||
      (requiresDocumentConfirmation && !privacyConfirmed)
    ) {
      return;
    }

    submitGuard.current = true;
    submitMutation.mutate(pendingRun, {
      onSuccess: (execution) => {
        setRuns((current) => [
          execution,
          ...current.filter((run) => run.id !== execution.id),
        ]);
        setConfirmationOpen(false);
        setPendingRun(null);
        setPrivacyConfirmed(false);
      },
      onError: () => {
        setConfirmationOpen(false);
        setPendingRun(null);
        setPrivacyConfirmed(false);
      },
      onSettled: () => {
        submitGuard.current = false;
      },
    });
  };

  const toggleDocument = (documentId: string, checked: boolean) => {
    setSelectedDocumentIds((current) => {
      if (checked)
        return current.includes(documentId)
          ? current
          : [...current, documentId];
      return current.filter((id) => id !== documentId);
    });
  };

  const toggleRequirement = (requirementId: string, checked: boolean) => {
    setSelectedRequirementIds((current) => {
      if (checked) {
        return current.includes(requirementId)
          ? current
          : [...current, requirementId];
      }
      return current.filter((id) => id !== requirementId);
    });
  };

  const closeConfirmation = (open: boolean) => {
    setConfirmationOpen(open);
    if (!open) {
      setPendingRun(null);
      setPrivacyConfirmed(false);
    }
  };

  return (
    <section aria-labelledby="workflow-page-title" className="workflow-page">
      <header className="workflow-page__heading">
        <span className="workflow-page__heading-icon" aria-hidden="true">
          <BrainCircuit size={22} />
        </span>
        <div>
          <p className="eyebrow">PROJECT WORKSPACE</p>
          <h1 id="workflow-page-title">AI workflow workbench</h1>
          <p>
            Choose a focused workflow, control the project context it uses, and
            review every result as a draft.
          </p>
        </div>
        <Badge tone="accent">Human review first</Badge>
      </header>

      <Card className="workflow-context-overview">
        <div className="workflow-context-overview__intro">
          <span className="workflow-context-overview__icon" aria-hidden="true">
            <ListChecks size={17} />
          </span>
          <div>
            <h2>Project context</h2>
            <p>
              Requirements and artifacts are included automatically by the
              service. Document text is shared only when you select documents
              and confirm a document workflow.
            </p>
          </div>
        </div>
        <dl className="workflow-context-counts">
          <div>
            <dt>Documents</dt>
            <dd>{documentsQuery.isPending ? "…" : documentCount}</dd>
          </div>
          <div>
            <dt>Requirements</dt>
            <dd>
              {requirementsQuery.isPending ? "…" : requirementCount}
              {requirementCount > 100 ? " · over limit" : ""}
            </dd>
          </div>
          <div>
            <dt>Artifacts</dt>
            <dd>
              {artifactsQuery.isPending ? "…" : artifactCount}
              {artifactCount > 100 ? " · over limit" : ""}
            </dd>
          </div>
        </dl>
      </Card>

      {contextLimitReached ? (
        <div className="workflow-limit-notice" role="alert">
          The workflow service accepts at most 100 requirements and 100
          artifacts as project context. This project's context exceeds a limit,
          so runs are paused rather than sent with a misleading partial view.
        </div>
      ) : null}

      {documentsQuery.isError ? (
        <ContextError
          error={documentsQuery.error}
          onRetry={() => void documentsQuery.refetch()}
          title="Documents couldn't be loaded"
        />
      ) : null}
      {requirementsQuery.isError ? (
        <ContextError
          error={requirementsQuery.error}
          onRetry={() => void requirementsQuery.refetch()}
          title="Requirements couldn't be loaded"
        />
      ) : null}
      {artifactsQuery.isError ? (
        <ContextError
          error={artifactsQuery.error}
          onRetry={() => void artifactsQuery.refetch()}
          title="Artifacts couldn't be loaded"
        />
      ) : null}

      <div className="workflow-section-heading">
        <div>
          <p className="eyebrow">STRUCTURED AI TOOLS</p>
          <h2>Choose a workflow</h2>
        </div>
        <span>Each run is explicit, scoped, and reviewable.</span>
      </div>

      <div
        aria-label="Available AI workflows"
        className="workflow-choice-grid"
        role="group"
      >
        {workflows.map((workflow) => {
          const Icon = workflow.icon;
          const selected = workflow.name === selectedWorkflowName;
          return (
            <button
              aria-pressed={selected}
              className={`workflow-choice${selected ? " workflow-choice--selected" : ""}`}
              key={workflow.name}
              onClick={() => selectWorkflow(workflow)}
              type="button"
            >
              <span className="workflow-choice__icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="workflow-choice__copy">
                <strong>{workflow.title}</strong>
                <span>{workflow.description}</span>
              </span>
              <span className="workflow-choice__meta">
                <span>
                  <strong>Requires</strong> {workflow.requiredContext}
                </span>
                <span>
                  <strong>Creates</strong> {workflow.output}
                </span>
              </span>
              <span className="workflow-choice__action">
                {selected ? "Selected" : "Configure"}
                <ArrowRight aria-hidden="true" size={14} />
              </span>
            </button>
          );
        })}
      </div>

      {currentWorkflow ? (
        <Card
          aria-labelledby="workflow-config-title"
          className="workflow-config"
          as="section"
        >
          <header className="workflow-config__header">
            <div>
              <p className="eyebrow">CONFIGURE THIS RUN</p>
              <h2 id="workflow-config-title">{currentWorkflow.title}</h2>
              <p>
                {currentWorkflow.description} The service may also use the
                project's existing requirements and artifacts as context.
              </p>
            </div>
            <span className="workflow-config__step">01 / 02</span>
          </header>

          <div
            aria-busy={
              documentsQuery.isPending ||
              requirementsQuery.isPending ||
              artifactsQuery.isPending
            }
            className="workflow-config__body"
          >
            {currentWorkflow.context === "documents" ? (
              documents.length > 0 ? (
                <fieldset className="workflow-selection">
                  <legend>
                    Select source documents{" "}
                    <span>{selectedDocumentIds.length} of 10 selected</span>
                  </legend>
                  <p className="workflow-selection__hint">
                    Only selected documents are shared as document text. Choose
                    up to ten; project requirements and artifacts may also be
                    sent to the configured AI provider.
                  </p>
                  <div className="workflow-document-list">
                    {documents.map((document) => {
                      const checked = selectedDocumentIds.includes(document.id);
                      const limitReached =
                        selectedDocumentIds.length >= 10 && !checked;
                      return (
                        <label
                          className={`workflow-document-option${checked ? " workflow-document-option--selected" : ""}`}
                          htmlFor={`workflow-document-${document.id}`}
                          key={document.id}
                        >
                          <input
                            checked={checked}
                            disabled={limitReached}
                            id={`workflow-document-${document.id}`}
                            onChange={(event) =>
                              toggleDocument(
                                document.id,
                                event.currentTarget.checked,
                              )
                            }
                            type="checkbox"
                          />
                          <span className="workflow-document-option__file">
                            <strong>{document.fileName}</strong>
                            <span>
                              {getDocumentTypeLabel(document.mimeType)} ·{" "}
                              {formatSize(document.sizeBytes)}
                            </span>
                          </span>
                          {checked ? (
                            <CheckCircle2
                              aria-hidden="true"
                              className="workflow-document-option__check"
                              size={17}
                            />
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : documentsQuery.isPending ? (
                <div role="status">
                  <LoadingSkeleton lines={3} />
                </div>
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="button button--primary button--medium"
                      to={`/app/projects/${encodeURIComponent(projectId)}/documents`}
                    >
                      <Files aria-hidden="true" size={16} />
                      <span>Open document library</span>
                    </Link>
                  }
                  description="Upload an authorized source file before choosing a document-based workflow."
                  icon={Files}
                  title="No source documents yet"
                />
              )
            ) : null}

            {currentWorkflow.context === "requirements" ||
            currentWorkflow.context === "validation" ? (
              requirements.length > 0 ? (
                <fieldset className="workflow-selection">
                  <legend>
                    {currentWorkflow.context === "validation"
                      ? "Choose requirements to validate"
                      : "Select requirements"}
                    <span>
                      {selectedRequirementIds.length} selected
                      {requirementCount > 100 ? " · first 100 shown" : ""}
                    </span>
                  </legend>
                  {currentWorkflow.context === "validation" ? (
                    <p className="workflow-selection__hint">
                      Leave all unchecked to validate every project requirement.
                      Existing project artifacts are always included and cannot
                      be individually deselected.
                    </p>
                  ) : (
                    <p className="workflow-selection__hint">
                      Select the requirements for this run. Existing project
                      artifacts are included automatically.
                    </p>
                  )}
                  <div className="workflow-requirement-list">
                    {requirements.map((requirement) => (
                      <RequirementOption
                        key={requirement.id}
                        onChange={(checked) =>
                          toggleRequirement(requirement.id, checked)
                        }
                        requirement={requirement}
                        selected={selectedRequirementIds.includes(
                          requirement.id,
                        )}
                      />
                    ))}
                  </div>
                </fieldset>
              ) : requirementsQuery.isPending ? (
                <div role="status">
                  <LoadingSkeleton lines={3} />
                </div>
              ) : currentWorkflow.context === "validation" &&
                artifactCount > 0 ? (
                <div className="workflow-selection__hint workflow-validation-note">
                  No requirements are available. This run will validate the{" "}
                  {artifactCount} existing project artifact
                  {artifactCount === 1 ? "" : "s"}.
                </div>
              ) : (
                <EmptyState
                  action={
                    <Link
                      className="button button--primary button--medium"
                      to={`/app/projects/${encodeURIComponent(projectId)}/requirements/new`}
                    >
                      <ListChecks aria-hidden="true" size={16} />
                      <span>Create a requirement</span>
                    </Link>
                  }
                  description="Capture at least one project requirement before running this workflow."
                  icon={ListChecks}
                  title="No requirements available"
                />
              )
            ) : null}

            {currentWorkflow.context === "story" ? (
              stories.length > 0 ? (
                <fieldset className="workflow-selection">
                  <legend>Select a story</legend>
                  <p className="workflow-selection__hint">
                    All project requirements and artifacts are included as
                    context; acceptance criteria will be attached to the story
                    you select.
                  </p>
                  <div className="workflow-story-list">
                    {stories.map((story) => (
                      <label
                        className={`workflow-story-option${selectedStoryId === story.id ? " workflow-story-option--selected" : ""}`}
                        htmlFor={`workflow-story-${story.id}`}
                        key={story.id}
                      >
                        <input
                          checked={selectedStoryId === story.id}
                          id={`workflow-story-${story.id}`}
                          name="workflow-story"
                          onChange={() => setSelectedStoryId(story.id)}
                          type="radio"
                        />
                        <span>
                          <strong>{story.title}</strong>
                          <span>{story.description || "No description."}</span>
                        </span>
                        <Badge>{formatLabel(story.status)}</Badge>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : artifactsQuery.isPending ? (
                <div role="status">
                  <LoadingSkeleton lines={3} />
                </div>
              ) : (
                <EmptyState
                  action={
                    <Button
                      onClick={() => {
                        const storyWorkflow = workflows.find(
                          ({ name }) => name === "story-generation",
                        );
                        if (storyWorkflow) selectWorkflow(storyWorkflow);
                      }}
                      type="button"
                      variant="secondary"
                    >
                      Generate user stories
                    </Button>
                  }
                  description="Acceptance criteria are attached to a specific story. Generate or add a user story first."
                  icon={Sparkles}
                  title="No story artifacts yet"
                />
              )
            ) : null}
          </div>

          {selectionError ? (
            <p className="workflow-form-error" role="alert">
              {selectionError}
            </p>
          ) : null}

          <footer className="workflow-config__footer">
            <div>
              <p className="workflow-config__output">
                Expected draft: {currentWorkflow.output}
              </p>
              {unavailableReason ? (
                <p className="workflow-config__reason" role="status">
                  {unavailableReason}
                </p>
              ) : (
                <p className="workflow-config__reason">
                  Review the context and confirm before the request is sent.
                </p>
              )}
            </div>
            <Button
              disabled={Boolean(unavailableReason) || submitMutation.isPending}
              leadingIcon={<Sparkles aria-hidden="true" size={16} />}
              onClick={openConfirmation}
              type="button"
            >
              Review and run
            </Button>
          </footer>
        </Card>
      ) : (
        <div className="workflow-choose-prompt">
          <Sparkles aria-hidden="true" size={18} />
          <p>Select any workflow above to configure its project context.</p>
        </div>
      )}

      {submitMutation.isError ? (
        <div className="workflow-submit-error">
          <ErrorPanel
            message={submitError.message}
            requestId={submitError.requestId}
            title="Workflow wasn't confirmed"
          />
          <p>
            Requests are not retried automatically. If the service accepted the
            run but its response was lost, sending the request again may create
            a duplicate run because this API has no idempotency key.
          </p>
        </div>
      ) : null}

      <section aria-labelledby="workflow-runs-title" className="workflow-runs">
        <header className="workflow-runs__heading">
          <div>
            <p className="eyebrow">CURRENT VISIT</p>
            <h2 id="workflow-runs-title">Runs started here</h2>
          </div>
          <span>
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
        </header>
        <div className="workflow-runs__notice">
          <p>
            Only runs started during this page visit appear here; the service
            does not provide a previous-run history list. Leaving this page
            stops status polling, but does not cancel a run already accepted by
            the backend.
          </p>
        </div>
        {runs.length > 0 ? (
          <div className="workflow-runs__list">
            {runs.map((execution) => (
              <WorkflowExecutionCard
                execution={execution}
                key={execution.id}
                onComplete={handleExecutionComplete}
                onDismiss={(executionId) =>
                  setRuns((current) =>
                    current.filter((run) => run.id !== executionId),
                  )
                }
                projectId={projectId}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="When you start a workflow, its live status and validated result will appear here."
            icon={BrainCircuit}
            title="No runs yet"
          />
        )}
      </section>

      <Dialog
        className="workflow-confirm-dialog"
        description="Review the context and destination before this one-time workflow request is submitted."
        onOpenChange={closeConfirmation}
        open={confirmationOpen}
        title={`Confirm ${currentWorkflow?.title.toLocaleLowerCase() ?? "workflow"}`}
      >
        {pendingRun && currentWorkflow ? (
          <div className="workflow-confirm">
            <div className="workflow-confirm__notice">
              <ShieldAlert aria-hidden="true" size={18} />
              <p>
                This request sends project context to the AI provider configured
                for this service (OpenAI or Groq). Provider availability is not
                exposed to the frontend, so this confirmation does not imply
                that a provider is ready.
              </p>
            </div>
            <div className="workflow-confirm__scope">
              <h3>Context included</h3>
              {pendingRun.input.documentIds ? (
                <>
                  <p>
                    Selected source document text and the project's existing
                    requirements and artifacts.
                  </p>
                  <ul>
                    {pendingRun.input.documentIds.map((documentId) => {
                      const document = documents.find(
                        (item) => item.id === documentId,
                      );
                      return (
                        <li key={documentId}>
                          {document?.fileName ?? documentId}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p>
                  Project context and existing artifacts
                  {pendingRun.input.requirementIds
                    ? ", with only the selected requirements."
                    : ", including all requirements."}
                  {pendingRun.input.storyId
                    ? " The selected story will receive generated criteria."
                    : ""}
                </p>
              )}
            </div>
            <p className="workflow-confirm__draft-note">
              The result will be a draft for human review, not an approval or
              final decision. The service limits submissions to ten runs per
              fifteen minutes. The request is sent once; the API does not
              support idempotency keys.
            </p>
            {requiresDocumentConfirmation ? (
              <label className="workflow-privacy-check">
                <input
                  checked={privacyConfirmed}
                  onChange={(event) =>
                    setPrivacyConfirmed(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>
                  I am authorized to share the selected document content with
                  the configured AI provider for this analysis.
                </span>
              </label>
            ) : null}
            <div className="workflow-confirm__actions">
              <Button
                disabled={submitMutation.isPending}
                onClick={() => closeConfirmation(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  submitMutation.isPending ||
                  (requiresDocumentConfirmation && !privacyConfirmed)
                }
                leadingIcon={
                  submitMutation.isPending ? (
                    <RotateCw aria-hidden="true" className="spin" size={15} />
                  ) : (
                    <Sparkles aria-hidden="true" size={15} />
                  )
                }
                onClick={confirmRun}
                type="button"
              >
                {submitMutation.isPending ? "Starting…" : "Confirm and start"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}

interface RequirementOptionProps {
  requirement: Requirement;
  selected: boolean;
  onChange: (checked: boolean) => void;
}

function RequirementOption({
  requirement,
  selected,
  onChange,
}: RequirementOptionProps) {
  return (
    <label
      className={`workflow-requirement-option${selected ? " workflow-requirement-option--selected" : ""}`}
      htmlFor={`workflow-requirement-${requirement.id}`}
    >
      <input
        checked={selected}
        id={`workflow-requirement-${requirement.id}`}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span className="workflow-requirement-option__copy">
        <strong>{requirement.title}</strong>
        <span>{requirement.description || "No description added."}</span>
      </span>
      <span className="workflow-requirement-option__meta">
        <Badge tone="accent">{formatLabel(requirement.type)}</Badge>
        <Badge>{formatLabel(requirement.priority)}</Badge>
      </span>
    </label>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function ContextError({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry: () => void;
  title: string;
}) {
  const presentation = getApiErrorPresentation(
    error,
    "Project context couldn't be loaded. Please try again.",
  );
  return (
    <div className="workflow-context-error">
      <ErrorPanel
        message={presentation.message}
        requestId={presentation.requestId}
        title={title}
      />
      <Button
        leadingIcon={<RotateCw aria-hidden="true" size={15} />}
        onClick={onRetry}
        size="small"
        variant="secondary"
      >
        Try again
      </Button>
    </div>
  );
}
