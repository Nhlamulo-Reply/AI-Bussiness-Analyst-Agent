import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";
import type { Storage } from "../config/storage";
import type {
  ArtifactRecord,
  ProjectRecord,
  RequirementRecord,
  TemplateRecord,
} from "../modules/domain/domain.schemas";
import { hasProjectContext } from "../modules/domain/domain.schemas";
import type {
  ProviderUsage,
  StructuredOutputProvider,
} from "../integrations/llm/structured-output-provider";
import {
  acceptanceCriteriaSchema,
  gapAnalysisSchema,
  roadmapSchema,
  requirementExtractionSchema,
  requirementValidationSchema,
  riskAnalysisSchema,
  stakeholderAnalysisSchema,
  storyGenerationSchema,
  workflowResultSchema,
  type WorkflowResult,
} from "./workflow.schemas";
import { getWorkflowSystemPrompt } from "./prompts";
import type { z } from "zod";
import { workflowJobBodySchema } from "../modules/domain/domain.schemas";

export const workflowNames = [
  "requirements-analysis",
  "requirements-extraction",
  "story-generation",
  "acceptance-criteria-generation",
  "requirements-validation",
  "risk-analysis",
  "roadmap-generation",
] as const;

export type WorkflowName = (typeof workflowNames)[number];
export type WorkflowJob = z.infer<typeof workflowJobBodySchema>;

export interface WorkflowSourceDocument {
  id: string;
  text: string;
}

export interface WorkflowContext {
  workflowName: WorkflowName;
  executionId: string;
  projectId: string;
  actorUserId: string;
  project: ProjectRecord;
  documents: WorkflowSourceDocument[];
  requirements: RequirementRecord[];
  artifacts: ArtifactRecord[];
  templates: TemplateRecord[];
}

interface WorkflowPartial {
  requirementExtraction?: z.infer<typeof requirementExtractionSchema>;
  stakeholders?: z.infer<typeof stakeholderAnalysisSchema>;
  gaps?: z.infer<typeof gapAnalysisSchema>;
  stories?: z.infer<typeof storyGenerationSchema>;
  criteria?: z.infer<typeof acceptanceCriteriaSchema>;
  validation?: z.infer<typeof requirementValidationSchema>;
  risks?: z.infer<typeof riskAnalysisSchema>;
  roadmap?: z.infer<typeof roadmapSchema>;
  clarificationRequired?: boolean;
  validated?: boolean;
  result?: WorkflowResult;
}

const WorkflowState = Annotation.Root({
  context: Annotation<WorkflowContext>(),
  partial: Annotation<WorkflowPartial>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
});

type WorkflowStateType = typeof WorkflowState.State;
type WorkflowNode =
  | "intake"
  | "identifyStakeholders"
  | "extractRequirements"
  | "detectGaps"
  | "clarification"
  | "critic"
  | "generateStories"
  | "generateAcceptanceCriteria"
  | "analyzeRisksAndDependencies"
  | "planRoadmap"
  | "validateOutput"
  | "persist";
export type WorkflowNodeStatus = "running" | "completed" | "failed";
export type WorkflowNodeTracker = (
  node: string,
  status: WorkflowNodeStatus,
  error?: string,
) => Promise<void>;

export interface WorkflowGraphDependencies {
  storage: Storage;
  provider: StructuredOutputProvider;
  trackNode: WorkflowNodeTracker;
  trackUsage: (usage: ProviderUsage) => Promise<void>;
}

export function getWorkflowNodeNames(workflowName: WorkflowName): string[] {
  const taskNode: Record<WorkflowName, string> = {
    "requirements-analysis": "identifyStakeholders",
    "requirements-extraction": "extractRequirements",
    "story-generation": "generateStories",
    "acceptance-criteria-generation": "generateAcceptanceCriteria",
    "requirements-validation": "critic",
    "risk-analysis": "analyzeRisksAndDependencies",
    "roadmap-generation": "planRoadmap",
  };
  const nodes = ["intake"];
  if (workflowName === "requirements-analysis") {
    nodes.push(
      "identifyStakeholders",
      "extractRequirements",
      "detectGaps",
      "clarification",
      "critic",
    );
  } else if (workflowName === "requirements-extraction") {
    nodes.push("extractRequirements", "detectGaps", "clarification", "critic");
  } else {
    nodes.push(taskNode[workflowName]);
  }
  nodes.push("validateOutput", "persist");
  return nodes;
}

export function buildWorkflowGraph(dependencies: WorkflowGraphDependencies) {
  const { storage, provider, trackNode, trackUsage } = dependencies;
  const graph = new StateGraph<
    typeof WorkflowState,
    typeof WorkflowState.State,
    typeof WorkflowState.Update,
    WorkflowNode | typeof START | typeof END
  >(WorkflowState);

  const addTrackedNode = (
    name: WorkflowNode,
    action: (
      state: WorkflowStateType,
    ) => Promise<Partial<WorkflowStateType>> | Partial<WorkflowStateType>,
  ): void => {
    graph.addNode(name, async (state) => {
      await trackNode(name, "running");
      try {
        const update = await action(state);
        await trackNode(name, "completed");
        return update;
      } catch (error) {
        await trackNode(name, "failed", "Workflow step failed.");
        throw error;
      }
    });
  };

  const generate = async <T extends z.ZodType>(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: T,
  ): Promise<z.output<T>> => {
    const response = await provider.generate(
      name,
      systemPrompt,
      userPrompt,
      schema,
    );
    if (response.usage) {
      await trackUsage(response.usage);
    }
    return response.output;
  };

  addTrackedNode("intake", (state) => {
    validateInputs(state.context);
    return {};
  });

  addTrackedNode("identifyStakeholders", async (state) => ({
    partial: {
      stakeholders: await generate(
        "stakeholder_analysis",
        withTemplateGuidance(
          getWorkflowSystemPrompt("stakeholder_analysis"),
          state.context.templates,
        ),
        JSON.stringify({
          project: {
            name: state.context.project.name,
            description: state.context.project.description,
            businessObjective: state.context.project.businessObjective,
            inScope: state.context.project.inScope,
            outOfScope: state.context.project.outOfScope,
            stakeholders: state.context.project.stakeholders,
            constraints: state.context.project.constraints,
            desiredOutputs: state.context.project.desiredOutputs,
          },
          documents: state.context.documents,
        }),
        stakeholderAnalysisSchema,
      ),
    },
  }));

  addTrackedNode("extractRequirements", async (state) => ({
    partial: {
      requirementExtraction: await generate(
        "requirement_extraction",
        withTemplateGuidance(
          getWorkflowSystemPrompt("requirement_extraction"),
          state.context.templates,
        ),
        JSON.stringify({
          project: {
            name: state.context.project.name,
            description: state.context.project.description,
            businessObjective: state.context.project.businessObjective,
            inScope: state.context.project.inScope,
            outOfScope: state.context.project.outOfScope,
            stakeholders: state.context.project.stakeholders,
            constraints: state.context.project.constraints,
            desiredOutputs: state.context.project.desiredOutputs,
          },
          documents: state.context.documents,
        }),
        requirementExtractionSchema,
      ),
    },
  }));

  addTrackedNode("detectGaps", async (state) => ({
    partial: {
      gaps: await generate(
        "gap_analysis",
        withTemplateGuidance(
          getWorkflowSystemPrompt("gap_analysis"),
          state.context.templates,
        ),
        JSON.stringify({
          requirements: state.partial.requirementExtraction?.requirements ?? [],
          documents: state.context.documents,
        }),
        gapAnalysisSchema,
      ),
    },
  }));

  addTrackedNode("clarification", () => ({
    partial: { clarificationRequired: true },
  }));

  addTrackedNode("generateStories", async (state) => ({
    partial: {
      stories: await generate(
        "story_generation",
        withTemplateGuidance(
          getWorkflowSystemPrompt("story_generation"),
          state.context.templates,
        ),
        JSON.stringify({
          requirements: state.context.requirements.map(toPromptRequirement),
          documents: state.context.documents,
        }),
        storyGenerationSchema,
      ),
    },
  }));

  addTrackedNode("generateAcceptanceCriteria", async (state) => ({
    partial: {
      criteria: await generate(
        "acceptance_criteria",
        withTemplateGuidance(
          getWorkflowSystemPrompt("acceptance_criteria"),
          state.context.templates,
        ),
        JSON.stringify({
          stories: state.context.artifacts.map(toPromptArtifact),
          requirements: state.context.requirements.map(toPromptRequirement),
        }),
        acceptanceCriteriaSchema,
      ),
    },
  }));

  addTrackedNode("critic", async (state) => ({
    partial: {
      validation: await generate(
        "requirement_validation",
        withTemplateGuidance(
          getWorkflowSystemPrompt("requirement_validation"),
          state.context.templates,
        ),
        JSON.stringify({
          requirements: [
            ...state.context.requirements.map(toPromptRequirement),
            ...(state.partial.requirementExtraction?.requirements ?? []).map(
              (requirement, index) => ({
                id: `draft-${index}`,
                ...requirement,
              }),
            ),
          ],
          artifacts: state.context.artifacts.map(toPromptArtifact),
        }),
        requirementValidationSchema,
      ),
    },
  }));

  addTrackedNode("analyzeRisksAndDependencies", async (state) => ({
    partial: {
      risks: await generate(
        "risk_analysis",
        withTemplateGuidance(
          getWorkflowSystemPrompt("risk_analysis"),
          state.context.templates,
        ),
        JSON.stringify({
          requirements: state.context.requirements.map(toPromptRequirement),
        }),
        riskAnalysisSchema,
      ),
    },
  }));

  addTrackedNode("planRoadmap", async (state) => ({
    partial: {
      roadmap: await generate(
        "roadmap_planning",
        withTemplateGuidance(
          getWorkflowSystemPrompt("roadmap_planning"),
          state.context.templates,
        ),
        JSON.stringify({
          requirements: state.context.requirements.map(toPromptRequirement),
          artifacts: state.context.artifacts.map(toPromptArtifact),
        }),
        roadmapSchema,
      ),
    },
  }));

  addTrackedNode("validateOutput", (state) => {
    validateOutput(state.context, state.partial);
    return { partial: { validated: true } };
  });

  addTrackedNode("persist", async (state) => {
    if (!state.partial.validated) {
      throw new Error(
        "Workflow output must pass validation before persistence.",
      );
    }
    const persisted = await persistDrafts(
      state.context,
      state.partial,
      storage,
    );
    return { partial: { result: workflowResultSchema.parse(persisted) } };
  });

  const taskRoutes: Record<WorkflowName, WorkflowNode> = {
    "requirements-analysis": "identifyStakeholders",
    "requirements-extraction": "extractRequirements",
    "story-generation": "generateStories",
    "acceptance-criteria-generation": "generateAcceptanceCriteria",
    "requirements-validation": "critic",
    "risk-analysis": "analyzeRisksAndDependencies",
    "roadmap-generation": "planRoadmap",
  };

  graph.addEdge(START, "intake");
  graph.addConditionalEdges(
    "intake",
    (state) => taskRoutes[state.context.workflowName],
  );
  graph.addEdge("identifyStakeholders", "extractRequirements");
  graph.addConditionalEdges("extractRequirements", (state) =>
    state.context.workflowName === "requirements-analysis" ||
    state.context.workflowName === "requirements-extraction"
      ? "detectGaps"
      : "validateOutput",
  );
  graph.addConditionalEdges("detectGaps", (state) =>
    (state.partial.gaps?.openQuestions.length ?? 0) > 0 ||
    (state.partial.gaps?.uncertainties.length ?? 0) > 0 ||
    (state.partial.requirementExtraction?.requirements.some(
      (requirement) => requirement.openQuestions.length > 0,
    ) ??
      false)
      ? "clarification"
      : "critic",
  );
  graph.addEdge("clarification", "critic");
  graph.addEdge("generateStories", "validateOutput");
  graph.addEdge("generateAcceptanceCriteria", "validateOutput");
  graph.addEdge("critic", "validateOutput");
  graph.addEdge("analyzeRisksAndDependencies", "validateOutput");
  graph.addEdge("planRoadmap", "validateOutput");
  graph.addEdge("validateOutput", "persist");
  graph.addEdge("persist", END);

  return graph.compile();
}

function withTemplateGuidance(
  systemPrompt: string,
  templates: TemplateRecord[],
): string {
  if (templates.length === 0) {
    return systemPrompt;
  }
  const guidance = templates
    .map((template) => `${template.name}\n${template.instructions}`)
    .join("\n\n");
  return `${systemPrompt}\n\nApply the following administrator-managed template guidance where it is consistent with the required output schema and validation rules:\n${guidance}`;
}

function validateInputs(context: WorkflowContext): void {
  if (
    context.workflowName === "requirements-analysis" ||
    context.workflowName === "requirements-extraction"
  ) {
    if (context.documents.length === 0 && !hasProjectContext(context.project)) {
      throw new Error(
        "Requirement workflows require project context or a source document.",
      );
    }
    return;
  }

  if (context.workflowName === "acceptance-criteria-generation") {
    if (
      context.artifacts.length === 0 ||
      context.artifacts.some((artifact) => artifact.type !== "story")
    ) {
      throw new Error(
        "Acceptance-criteria generation requires at least one project story.",
      );
    }
    return;
  }

  if (context.workflowName === "requirements-validation") {
    if (context.requirements.length === 0 && context.artifacts.length === 0) {
      throw new Error("Validation requires project requirements or artifacts.");
    }
    return;
  }

  if (context.requirements.length === 0) {
    throw new Error("This workflow requires at least one project requirement.");
  }
}

function validateOutput(
  context: WorkflowContext,
  partial: WorkflowPartial,
): void {
  const knownDocumentIds = new Set(
    context.documents.map((document) => document.id),
  );
  const knownRequirementIds = new Set(
    context.requirements.map((requirement) => requirement.id),
  );
  const knownStories = new Map(
    context.artifacts
      .filter((artifact) => artifact.type === "story")
      .map((artifact) => [artifact.id, artifact]),
  );

  if (partial.requirementExtraction) {
    for (const requirement of partial.requirementExtraction.requirements) {
      for (const fact of requirement.sourceFacts) {
        const source = context.documents.find(
          (document) => document.id === fact.documentId,
        );
        if (
          !source ||
          !knownDocumentIds.has(fact.documentId) ||
          !containsVerbatim(source.text, fact.text)
        ) {
          throw new Error(
            "A generated source fact could not be verified against its document.",
          );
        }
      }
    }
  }

  for (const epic of partial.stories?.epics ?? []) {
    assertKnownIds(
      epic.requirementIds,
      knownRequirementIds,
      "An epic referenced an unknown requirement.",
    );
    const epicRequirementIds = new Set(epic.requirementIds);
    for (const story of epic.stories) {
      assertKnownIds(
        story.requirementIds,
        epicRequirementIds,
        "A story referenced an unrelated epic requirement.",
      );
    }
  }

  const requiredScenarioTypes = [
    "positive",
    "negative",
    "boundary",
    "validation",
    "edge",
  ];
  const scenarioTypesByStory = new Map<string, Set<string>>();
  for (const criteria of partial.criteria?.criteria ?? []) {
    const story = knownStories.get(criteria.storyId);
    if (!story) {
      throw new Error(
        "Acceptance criteria referenced a story outside this project.",
      );
    }
    assertKnownIds(
      criteria.requirementIds,
      new Set(story.requirementIds),
      "Acceptance criteria referenced an unrelated requirement.",
    );
    const scenarioTypes =
      scenarioTypesByStory.get(criteria.storyId) ?? new Set<string>();
    scenarioTypes.add(criteria.scenarioType);
    scenarioTypesByStory.set(criteria.storyId, scenarioTypes);
  }
  if (partial.criteria) {
    for (const storyId of knownStories.keys()) {
      const coveredScenarios =
        scenarioTypesByStory.get(storyId) ?? new Set<string>();
      if (
        requiredScenarioTypes.some(
          (scenarioType) => !coveredScenarios.has(scenarioType),
        )
      ) {
        throw new Error(
          "Acceptance criteria must cover positive, negative, boundary, validation, and edge scenarios for every story.",
        );
      }
    }
  }

  for (const risk of partial.risks?.risks ?? []) {
    assertKnownIds(
      risk.requirementIds,
      knownRequirementIds,
      "A risk referenced an unknown requirement.",
    );
  }
  for (const dependency of partial.risks?.dependencies ?? []) {
    assertKnownIds(
      dependency.requirementIds,
      knownRequirementIds,
      "A dependency referenced an unknown requirement.",
    );
  }
  for (const milestone of partial.roadmap?.milestones ?? []) {
    assertKnownIds(
      milestone.requirementIds,
      knownRequirementIds,
      "A roadmap milestone referenced an unknown requirement.",
    );
  }

  for (const finding of partial.validation?.findings ?? []) {
    const draftIndex =
      finding.artifactType === "requirement"
        ? /^draft-(\d+)$/.exec(finding.artifactId)?.[1]
        : undefined;
    if (
      draftIndex !== undefined &&
      Number(draftIndex) <
        (partial.requirementExtraction?.requirements.length ?? 0)
    ) {
      continue;
    }
    const record =
      finding.artifactType === "requirement"
        ? context.requirements.find(
            (requirement) => requirement.id === finding.artifactId,
          )
        : context.artifacts.find(
            (artifact) =>
              artifact.id === finding.artifactId &&
              artifact.type === finding.artifactType,
          );
    if (!record) {
      throw new Error(
        "A validation finding referenced an unknown project record.",
      );
    }
  }
}

async function persistDrafts(
  context: WorkflowContext,
  partial: WorkflowPartial,
  storage: Storage,
): Promise<WorkflowResult> {
  const now = new Date().toISOString();
  const requirementIds: string[] = [];
  const artifactIds: string[] = [];
  const draftRequirementIdMap = new Map<number, string>();
  let summary = "Workflow completed.";

  if (partial.requirementExtraction) {
    const generatedRequirements =
      partial.requirementExtraction.requirements.map((draft, index) => {
        const id = randomUUID();
        requirementIds.push(id);
        draftRequirementIdMap.set(index, id);
        const sourceFactReferences = draft.sourceFacts.map((fact) => ({
          documentId: fact.documentId,
          text: fact.text,
        }));
        return {
          id,
          projectId: context.projectId,
          title: draft.title,
          description: draft.description,
          type: draft.type,
          status: "draft" as const,
          priority: draft.priority,
          confidence: draft.confidence,
          sourceFacts: sourceFactReferences.map((fact) => fact.text),
          assumptions: draft.assumptions,
          openQuestions: draft.openQuestions,
          traceability: {
            documentIds: [
              ...new Set(sourceFactReferences.map((fact) => fact.documentId)),
            ],
            sourceFactReferences,
            projectDescription: Boolean(context.project.description.trim()),
            projectContext: hasProjectContext(context.project),
            executionId: context.executionId,
          },
          version: 1,
          createdByUserId: context.actorUserId,
          createdAt: now,
          updatedAt: now,
        };
      });
    await storage.createRequirements(generatedRequirements);
    summary = `Created ${generatedRequirements.length} draft requirement(s).`;
  }

  const generatedArtifacts: ArtifactRecord[] = [];
  const generatedEpics: ArtifactRecord[] = [];
  for (const epic of partial.stories?.epics ?? []) {
    const epicArtifact = makeArtifact(
      context,
      now,
      "epic",
      epic.title,
      epic.description,
      epic.requirementIds,
      {},
    );
    generatedEpics.push(epicArtifact);
    for (const story of epic.stories) {
      generatedArtifacts.push(
        makeArtifact(
          context,
          now,
          "story",
          story.title,
          `As a ${story.asA}, I want ${story.iWant}, so that ${story.soThat}`,
          story.requirementIds,
          {
            priority: story.priority,
            asA: story.asA,
            iWant: story.iWant,
            soThat: story.soThat,
            epicId: epicArtifact.id,
          },
        ),
      );
    }
  }
  for (const criteria of partial.criteria?.criteria ?? []) {
    generatedArtifacts.push(
      makeArtifact(
        context,
        now,
        "acceptance_criteria",
        criteria.title,
        `Given ${criteria.given}\nWhen ${criteria.when}\nThen ${criteria.then}`,
        criteria.requirementIds,
        {
          storyId: criteria.storyId,
          scenarioType: criteria.scenarioType,
          given: criteria.given,
          when: criteria.when,
          then: criteria.then,
        },
      ),
    );
  }
  generatedArtifacts.push(...generatedEpics);
  for (const risk of partial.risks?.risks ?? []) {
    generatedArtifacts.push(
      makeArtifact(
        context,
        now,
        "risk",
        risk.title,
        risk.description,
        risk.requirementIds,
        {
          probability: risk.probability,
          impact: risk.impact,
          mitigation: risk.mitigation,
        },
      ),
    );
  }
  for (const dependency of partial.risks?.dependencies ?? []) {
    generatedArtifacts.push(
      makeArtifact(
        context,
        now,
        "dependency",
        dependency.title,
        dependency.description,
        dependency.requirementIds,
        {},
      ),
    );
  }
  if (partial.roadmap) {
    const requirementIdsForRoadmap = [
      ...new Set(
        partial.roadmap.milestones.flatMap(
          (milestone) => milestone.requirementIds,
        ),
      ),
    ];
    generatedArtifacts.push(
      makeArtifact(
        context,
        now,
        "implementation_plan",
        "Implementation roadmap",
        partial.roadmap.milestones
          .map((milestone) => `${milestone.title}: ${milestone.description}`)
          .join("\n\n"),
        requirementIdsForRoadmap,
        { milestones: partial.roadmap.milestones },
      ),
    );
  }

  if (generatedArtifacts.length > 0) {
    await storage.createArtifacts(generatedArtifacts);
    artifactIds.push(...generatedArtifacts.map((artifact) => artifact.id));
    summary = `Created ${generatedArtifacts.length} draft artifact(s).`;
  }
  if (partial.validation && !partial.requirementExtraction) {
    summary = `Reviewed ${context.requirements.length + context.artifacts.length} project record(s).`;
  } else if (partial.validation && partial.requirementExtraction) {
    summary = `Created ${partial.requirementExtraction.requirements.length} draft requirement(s) and reviewed them.`;
  }
  const findings = (partial.validation?.findings ?? []).map((finding) => {
    const draftIndex =
      finding.artifactType === "requirement"
        ? /^draft-(\d+)$/.exec(finding.artifactId)?.[1]
        : undefined;
    const actualRequirementId =
      draftIndex === undefined
        ? undefined
        : draftRequirementIdMap.get(Number(draftIndex));
    return actualRequirementId
      ? { ...finding, artifactId: actualRequirementId }
      : finding;
  });

  const result = {
    summary,
    requirementIds,
    artifactIds,
    stakeholders:
      partial.stakeholders?.stakeholders.map(
        (stakeholder) => `${stakeholder.name} - ${stakeholder.role}`,
      ) ?? [],
    assumptions: [
      ...(partial.requirementExtraction?.requirements.flatMap(
        (requirement) => requirement.assumptions,
      ) ?? []),
      ...(partial.gaps?.assumptions ?? []),
    ],
    openQuestions: [
      ...(partial.requirementExtraction?.requirements.flatMap(
        (requirement) => requirement.openQuestions,
      ) ?? []),
      ...(partial.gaps?.openQuestions ?? []),
    ].filter(
      (question, index, questions) => questions.indexOf(question) === index,
    ),
    recommendations: partial.requirementExtraction?.recommendations ?? [],
    uncertainties: [
      ...(partial.requirementExtraction?.uncertainties ?? []),
      ...(partial.gaps?.uncertainties ?? []),
    ],
    clarificationRequired: partial.clarificationRequired ?? false,
    findings,
  };
  return workflowResultSchema.parse(result);
}

function makeArtifact(
  context: WorkflowContext,
  now: string,
  type: ArtifactRecord["type"],
  title: string,
  description: string,
  requirementIds: string[],
  data: Record<string, unknown>,
): ArtifactRecord {
  return {
    id: randomUUID(),
    projectId: context.projectId,
    type,
    title,
    description,
    status: "draft",
    requirementIds,
    data,
    version: 1,
    createdByUserId: context.actorUserId,
    createdAt: now,
    updatedAt: now,
  };
}

function toPromptRequirement(requirement: RequirementRecord) {
  return {
    id: requirement.id,
    title: requirement.title,
    description: requirement.description,
    type: requirement.type,
    priority: requirement.priority,
    sourceFacts: requirement.sourceFacts,
    assumptions: requirement.assumptions,
    openQuestions: requirement.openQuestions,
  };
}

function toPromptArtifact(artifact: ArtifactRecord) {
  return {
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
    description: artifact.description,
    requirementIds: artifact.requirementIds,
    data: artifact.data,
  };
}

function assertKnownIds(
  ids: string[],
  allowed: Set<string>,
  message: string,
): void {
  if (ids.some((id) => !allowed.has(id))) {
    throw new Error(message);
  }
}

function containsVerbatim(source: string, excerpt: string): boolean {
  const normalize = (value: string) =>
    value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return normalize(source).includes(normalize(excerpt));
}
