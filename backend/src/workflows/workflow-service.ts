import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { AppError } from "../common/errors/app-error";
import type { Storage } from "../config/storage";
import type { ExecutionRecord, ProjectRecord } from "../modules/domain/domain.schemas";
import { extractDocumentText } from "../integrations/documents/text-extractor";
import type { StructuredOutputProvider } from "../integrations/llm/structured-output-provider";
import type { WorkflowJob } from "./workflow-graph";
import { buildWorkflowGraph, getWorkflowNodeNames, type WorkflowContext, type WorkflowName } from "./workflow-graph";

const maxDocumentsPerRun = 10;
const maxInputCharacters = 40_000;
const pageSize = 100;
const documentWorkflows = new Set<WorkflowName>(["requirements-analysis", "requirements-extraction"]);

export class WorkflowService {
  private readonly activeRuns = new Set<Promise<void>>();
  private isClosed = false;

  constructor(
    private readonly storage: Storage,
    private readonly provider?: StructuredOutputProvider,
    private readonly logger?: Logger
  ) {}

  async start(workflowName: WorkflowName, actorUserId: string, request: WorkflowJob): Promise<ExecutionRecord> {
    if (this.isClosed) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Workflow processing is shutting down.");
    }
    if (!this.provider) {
      throw new AppError(503, "AI_PROVIDER_NOT_CONFIGURED", "Set OPENAI_API_KEY to enable AI workflows.");
    }
    if (!(await this.storage.userCanAccessProject(request.projectId, actorUserId))) {
      throw new AppError(404, "NOT_FOUND", "Project not found.");
    }

    const project = await this.storage.getProject(request.projectId);
    if (!project) {
      throw new AppError(404, "NOT_FOUND", "Project not found.");
    }
    const executionId = randomUUID();
    const context = await this.prepareContext(workflowName, actorUserId, request, project, executionId);
    const now = new Date().toISOString();
    const execution: ExecutionRecord = {
      id: executionId,
      projectId: project.id,
      workflowName,
      status: "queued",
      model: this.provider.model,
      usage: { requestCount: 0, inputTokens: 0, outputTokens: 0 },
      nodeStates: getWorkflowNodeNames(workflowName).map((node) => ({ node, status: "pending" })),
      createdByUserId: actorUserId,
      createdAt: now,
      updatedAt: now
    };
    await this.storage.createExecution(execution);
    this.scheduleRun(execution, context, this.provider);
    return execution;
  }

  async close(): Promise<void> {
    this.isClosed = true;
    await Promise.all([...this.activeRuns]);
  }

  private async prepareContext(
    workflowName: WorkflowName,
    actorUserId: string,
    request: WorkflowJob,
    project: ProjectRecord,
    executionId: string
  ): Promise<WorkflowContext> {
    const allDocuments = await this.storage.listDocuments(project.id);
    const requestedDocumentIds = request.documentIds
      ?? (documentWorkflows.has(workflowName) ? allDocuments.map((document) => document.id) : []);
    if (requestedDocumentIds.length > maxDocumentsPerRun) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", `Select no more than ${maxDocumentsPerRun} source documents per workflow.`);
    }
    const documentsToParse = requestedDocumentIds.map((documentId) => {
      const document = allDocuments.find((record) => record.id === documentId);
      if (!document) {
        throw new AppError(400, "VALIDATION_ERROR", "A source document does not belong to this project.", [
          { field: "documentIds", reason: "Document is missing or belongs to another project" }
        ]);
      }
      return document;
    });
    const documents = await Promise.all(documentsToParse.map(async (document) => ({
      id: document.id,
      text: await extractDocumentText(document)
    })));
    if (documents.reduce((total, document) => total + document.text.length, 0) > maxInputCharacters) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "Extracted source text exceeds the 40,000 character workflow limit.");
    }
    if (documentWorkflows.has(workflowName) && documents.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Select at least one source document for requirement analysis.");
    }

    const requirementPage = await this.storage.listRequirements(project.id, 1, pageSize);
    const artifactPage = await this.storage.listArtifacts(project.id, 1, pageSize);
    if (requirementPage.total > pageSize || artifactPage.total > pageSize) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "This workflow is limited to 100 requirements and 100 artifacts.");
    }
    const requirements = request.requirementIds
      ? request.requirementIds.map((id) => {
        const record = requirementPage.items.find((requirement) => requirement.id === id);
        if (!record) {
          throw new AppError(400, "VALIDATION_ERROR", "A requirement does not belong to this project.", [
            { field: "requirementIds", reason: "Requirement is missing or belongs to another project" }
          ]);
        }
        return record;
      })
      : requirementPage.items;

    let artifacts = artifactPage.items;
    if (workflowName === "acceptance-criteria-generation") {
      if (request.storyId) {
        const story = await this.storage.getArtifact("story", request.storyId);
        if (!story || story.projectId !== project.id || !("type" in story) || story.type !== "story") {
          throw new AppError(400, "VALIDATION_ERROR", "The requested story does not belong to this project.");
        }
        artifacts = [story];
      } else {
        artifacts = artifacts.filter((artifact) => artifact.type === "story");
      }
    }

    const context: WorkflowContext = {
      workflowName,
      executionId,
      projectId: project.id,
      actorUserId,
      project,
      documents,
      requirements,
      artifacts
    };
    const contextLength = JSON.stringify({
      project: context.project,
      documents: context.documents,
      requirements: context.requirements,
      artifacts: context.artifacts
    }).length;
    if (contextLength > maxInputCharacters) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "Workflow input exceeds the 40,000 character limit.");
    }

    validatePreparedInputs(context);
    return context;
  }

  private scheduleRun(execution: ExecutionRecord, context: WorkflowContext, provider: StructuredOutputProvider): void {
    let run: Promise<void>;
    run = new Promise<void>((resolve) => {
      setImmediate(() => {
        void this.run(execution, context, provider).then(resolve, (error: unknown) => {
          const errorName = error instanceof Error ? error.name : "UnknownError";
          this.logger?.error({ executionId: execution.id, errorName }, "Workflow task terminated unexpectedly");
          resolve();
        });
      });
    });
    this.activeRuns.add(run);
    void run.then(() => this.activeRuns.delete(run));
  }

  private async run(execution: ExecutionRecord, context: WorkflowContext, provider: StructuredOutputProvider): Promise<void> {
    let nodeStates = execution.nodeStates;
    let usage = execution.usage ?? { requestCount: 0, inputTokens: 0, outputTokens: 0 };
    const startedAt = Date.now();
    const trackNode = async (node: string, status: "running" | "completed" | "failed", error?: string) => {
      const now = new Date().toISOString();
      nodeStates = nodeStates.map((state) => state.node === node
        ? {
          ...state,
          status,
          startedAt: status === "running" ? state.startedAt ?? now : state.startedAt,
          completedAt: status === "completed" || status === "failed" ? now : state.completedAt,
          error
        }
        : state);
      const updated = await this.storage.updateExecution(execution.id, {
        status: "running",
        nodeStates,
        model: provider.model,
        usage,
        startedAt: execution.startedAt ?? now
      });
      if (!updated) {
        throw new Error("Workflow execution record disappeared.");
      }
    };
    const trackUsage = async (nextUsage: { inputTokens: number; outputTokens: number }) => {
      usage = {
        requestCount: usage.requestCount + 1,
        inputTokens: usage.inputTokens + nextUsage.inputTokens,
        outputTokens: usage.outputTokens + nextUsage.outputTokens
      };
      const updated = await this.storage.updateExecution(execution.id, { usage });
      if (!updated) {
        throw new Error("Workflow execution record disappeared.");
      }
    };

    try {
      const graph = buildWorkflowGraph({
        storage: this.storage,
        provider,
        trackNode,
        trackUsage
      });
      const finalState = await graph.invoke({ context, partial: {} });
      if (!finalState.partial.result) {
        throw new Error("Workflow completed without a validated result.");
      }
      await this.storage.updateExecution(execution.id, {
        status: "completed",
        nodeStates,
        result: finalState.partial.result,
        error: undefined,
        model: provider.model,
        usage,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      this.logger?.error({ executionId: execution.id, errorName }, "Workflow execution failed");
      try {
        await this.storage.updateExecution(execution.id, {
          status: "failed",
          nodeStates,
          error: "Workflow failed before producing a validated result.",
          model: provider.model,
          usage,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt
        });
      } catch (persistError) {
        const persistErrorName = persistError instanceof Error ? persistError.name : "UnknownError";
        this.logger?.error({ executionId: execution.id, errorName: persistErrorName }, "Failed to persist workflow failure state");
      }
    }
  }
}

function validatePreparedInputs(context: WorkflowContext): void {
  if (
    context.workflowName === "requirements-analysis"
    || context.workflowName === "requirements-extraction"
  ) {
    if (context.documents.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Select at least one source document for requirement analysis.");
    }
    return;
  }
  if (context.workflowName === "acceptance-criteria-generation") {
    if (context.artifacts.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Create a story before generating acceptance criteria.");
    }
    return;
  }
  if (context.workflowName === "requirements-validation") {
    if (context.requirements.length === 0 && context.artifacts.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "Add requirements or artifacts before running validation.");
    }
    return;
  }
  if (context.requirements.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "Add at least one requirement before starting this workflow.");
  }
}
