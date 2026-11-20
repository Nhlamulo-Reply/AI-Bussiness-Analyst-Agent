import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getApiErrorPresentation } from "../../lib/api-client";
import {
  useWorkflowExecution,
  workflowExecutionMaxPollDurationMs,
} from "./workflow-queries";
import { workflowResultSchema, type Execution } from "./workflow.schemas";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

interface WorkflowExecutionCardProps {
  projectId: string;
  execution: Execution;
  onComplete: (execution: Execution) => void;
  onDismiss: (executionId: string) => void;
}

function formatDateTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? undefined
    : dateTimeFormatter.format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function getStatusTone(status: Execution["status"]) {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "neutral";
}

function getNodeIcon(status: Execution["nodeStates"][number]["status"]) {
  if (status === "completed") return CheckCircle2;
  if (status === "running") return LoaderCircle;
  if (status === "failed") return XCircle;
  return Circle;
}

function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return undefined;
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} sec`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} sec`;
}

function getFindingLabel(finding: Record<string, unknown>, index: number) {
  for (const key of ["title", "description", "severity", "artifactType"]) {
    const value = finding[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return `Finding ${index + 1}`;
}

export function WorkflowExecutionCard({
  projectId,
  execution: initialExecution,
  onComplete,
  onDismiss,
}: WorkflowExecutionCardProps) {
  const executionQuery = useWorkflowExecution(projectId, initialExecution);
  const execution = executionQuery.data ?? initialExecution;
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const notifiedCompletion = useRef<string | null>(null);
  const pollingDeadline =
    Date.parse(initialExecution.createdAt) + workflowExecutionMaxPollDurationMs;
  const statusTone = getStatusTone(execution.status);
  const isTerminal =
    execution.status === "completed" || execution.status === "failed";
  const result =
    execution.status === "completed" && execution.result
      ? workflowResultSchema.safeParse(execution.result)
      : undefined;

  useEffect(() => {
    const remaining = pollingDeadline - Date.now();
    const timeoutId = window.setTimeout(
      () => setPollingTimedOut(true),
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timeoutId);
  }, [pollingDeadline]);

  useEffect(() => {
    if (
      execution.status === "completed" &&
      notifiedCompletion.current !== execution.id
    ) {
      notifiedCompletion.current = execution.id;
      onComplete(execution);
    }
  }, [execution, onComplete]);

  const presentation = getApiErrorPresentation(
    executionQuery.error,
    "The execution status couldn't be refreshed. Please try again.",
  );
  const canDismiss = isTerminal || pollingTimedOut;
  const startedAt = formatDateTime(execution.startedAt);
  const completedAt = formatDateTime(execution.completedAt);
  const duration = formatDuration(execution.durationMs);

  return (
    <Card
      aria-labelledby={`workflow-run-${execution.id}`}
      as="article"
      className="workflow-run"
    >
      <header className="workflow-run__header">
        <div className="workflow-run__heading">
          <span className="workflow-run__icon" aria-hidden="true">
            {execution.status === "running" ? (
              <LoaderCircle className="spin" size={18} />
            ) : execution.status === "failed" ? (
              <AlertTriangle size={18} />
            ) : (
              <Clock3 size={18} />
            )}
          </span>
          <div>
            <p className="eyebrow">WORKFLOW EXECUTION</p>
            <h3 id={`workflow-run-${execution.id}`}>
              {formatLabel(execution.workflowName)}
            </h3>
            <code className="workflow-run__id">Run ID: {execution.id}</code>
          </div>
        </div>
        <div className="workflow-run__actions">
          <StatusBadge tone={statusTone}>
            {formatLabel(execution.status)}
          </StatusBadge>
          <Button
            disabled={!canDismiss}
            onClick={() => onDismiss(execution.id)}
            size="small"
            type="button"
            variant="ghost"
          >
            Dismiss
          </Button>
        </div>
      </header>

      <div aria-live="polite" className="workflow-run__status">
        {execution.status === "queued" ? (
          <p>
            Your run is queued. This page checks its status every few seconds.
          </p>
        ) : null}
        {execution.status === "running" ? (
          <p>
            The workflow is running. You can continue reviewing its progress
            below.
          </p>
        ) : null}
        {execution.status === "failed" ? (
          <p role="alert">
            This workflow could not be completed. Review the project context
            before deciding whether to start another run.
          </p>
        ) : null}
      </div>

      {executionQuery.isError ? (
        <div className="workflow-run__error">
          <ErrorPanel
            message={presentation.message}
            requestId={presentation.requestId}
            title="Status update unavailable"
          />
          <Button
            disabled={executionQuery.isFetching}
            leadingIcon={<RotateCw aria-hidden="true" size={15} />}
            onClick={() => void executionQuery.refetch()}
            size="small"
            variant="secondary"
          >
            Refresh status
          </Button>
        </div>
      ) : null}

      {pollingTimedOut && !isTerminal ? (
        <div className="workflow-run__timeout" role="status">
          <p>
            Automatic status checks stopped after five minutes. The backend may
            still be processing this run; refresh manually to check again.
          </p>
          <Button
            disabled={executionQuery.isFetching}
            leadingIcon={<RotateCw aria-hidden="true" size={15} />}
            onClick={() => void executionQuery.refetch()}
            size="small"
            variant="secondary"
          >
            Refresh status
          </Button>
        </div>
      ) : null}

      <dl className="workflow-run__metadata">
        {startedAt ? (
          <div>
            <dt>Started</dt>
            <dd>{startedAt}</dd>
          </div>
        ) : null}
        {completedAt ? (
          <div>
            <dt>Completed</dt>
            <dd>{completedAt}</dd>
          </div>
        ) : null}
        {duration ? (
          <div>
            <dt>Duration</dt>
            <dd>{duration}</dd>
          </div>
        ) : null}
        {execution.model ? (
          <div>
            <dt>Model</dt>
            <dd>{execution.model}</dd>
          </div>
        ) : null}
        {execution.usage ? (
          <div>
            <dt>Usage</dt>
            <dd>
              {execution.usage.requestCount} requests ·{" "}
              {execution.usage.inputTokens.toLocaleString()} input /{" "}
              {execution.usage.outputTokens.toLocaleString()} output tokens
            </dd>
          </div>
        ) : null}
      </dl>

      {execution.nodeStates.length > 0 ? (
        <section
          aria-label="Workflow node progress"
          className="workflow-run__nodes"
        >
          <h4>Progress</h4>
          <ol>
            {execution.nodeStates.map((node, index) => {
              const NodeIcon = getNodeIcon(node.status);
              return (
                <li
                  className={`workflow-node workflow-node--${node.status}`}
                  key={`${node.node}-${index}`}
                >
                  <span aria-hidden="true" className="workflow-node__icon">
                    <NodeIcon
                      className={node.status === "running" ? "spin" : undefined}
                      size={16}
                    />
                  </span>
                  <span className="workflow-node__content">
                    <strong>{formatLabel(node.node)}</strong>
                    <span>{formatLabel(node.status)}</span>
                  </span>
                  <span className="workflow-node__time">
                    {formatDateTime(node.completedAt ?? node.startedAt) ?? "—"}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {result ? (
        result.success ? (
          <section
            aria-label="Validated workflow result"
            className="workflow-result"
          >
            <div className="workflow-result__heading">
              <div>
                <p className="eyebrow">HUMAN REVIEW REQUIRED</p>
                <h4>Draft result</h4>
              </div>
              {result.data.clarificationRequired ? (
                <Badge tone="warning">Clarification needed</Badge>
              ) : (
                <Badge tone="success">Validated</Badge>
              )}
            </div>
            <p className="workflow-result__summary">{result.data.summary}</p>

            {result.data.clarificationRequired ? (
              <p className="workflow-result__notice">
                Review the open questions and uncertainties before using this
                draft as a basis for a decision.
              </p>
            ) : null}

            <ResultList label="Stakeholders" items={result.data.stakeholders} />
            <ResultList label="Assumptions" items={result.data.assumptions} />
            <ResultList
              label="Open questions"
              items={result.data.openQuestions}
            />
            <ResultList
              label="Recommendations"
              items={result.data.recommendations}
            />
            <ResultList
              label="Uncertainties"
              items={result.data.uncertainties}
            />
            <ReferenceList
              ids={result.data.requirementIds}
              label="Requirements"
              projectId={projectId}
              resource="requirements"
            />
            <ReferenceList
              ids={result.data.artifactIds}
              label="Artifacts"
              projectId={projectId}
              resource="artifacts"
            />
            {result.data.findings.length > 0 ? (
              <div className="workflow-result__findings">
                <h5>Findings</h5>
                <ul>
                  {result.data.findings.map((finding, index) => (
                    <li key={`${getFindingLabel(finding, index)}-${index}`}>
                      <strong>{getFindingLabel(finding, index)}</strong>
                      <pre>
                        {JSON.stringify(finding, null, 2).slice(0, 2000)}
                        {JSON.stringify(finding, null, 2).length > 2000
                          ? "\n…"
                          : ""}
                      </pre>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="workflow-result__footnote">
              These outputs are drafts. Inspect supporting evidence and linked
              records before sharing or requesting approval.
            </p>
          </section>
        ) : (
          <ErrorPanel
            message="The run completed, but its result didn't match the supported format. Unvalidated output is hidden."
            title="Result couldn't be validated"
          />
        )
      ) : execution.status === "completed" ? (
        <ErrorPanel
          message="The run completed without a result that can be displayed."
          title="No validated result is available"
        />
      ) : null}

      {canDismiss ? (
        <p className="workflow-run__history-note">
          Runs started during this page visit are shown here. The service does
          not provide a previous-run history endpoint.
        </p>
      ) : null}
    </Card>
  );
}

interface ResultListProps {
  label: string;
  items: string[];
}

function ResultList({ label, items }: ResultListProps) {
  if (items.length === 0) return null;
  return (
    <div className="workflow-result__list">
      <h5>{label}</h5>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

interface ReferenceListProps {
  ids: string[];
  label: string;
  projectId: string;
  resource: "requirements" | "artifacts";
}

function ReferenceList({
  ids,
  label,
  projectId,
  resource,
}: ReferenceListProps) {
  if (ids.length === 0) return null;
  return (
    <div className="workflow-result__references">
      <h5>{label}</h5>
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <Link
              to={
                resource === "artifacts"
                  ? `/app/projects/${encodeURIComponent(projectId)}/artifacts?artifactId=${encodeURIComponent(id)}&source=workflow`
                  : `/app/projects/${encodeURIComponent(projectId)}/${resource}`
              }
            >
              {id}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
