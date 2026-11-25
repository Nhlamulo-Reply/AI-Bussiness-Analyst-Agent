import { z } from "zod";
import { artifactTypes } from "../modules/domain/domain.schemas";

const shortText = z.string().trim().min(1).max(1000);
const idList = z.array(z.string().min(1)).max(100);
const linkedRequirementIds = idList.min(1);

export const sourceFactDraftSchema = z
  .object({
    documentId: z.string().min(1),
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

export const requirementDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(8000),
    type: z.enum(["business", "functional", "non_functional"]),
    priority: z.enum(["low", "medium", "high", "critical"]),
    confidence: z.number().min(0).max(1),
    sourceFacts: z.array(sourceFactDraftSchema).max(20),
    assumptions: z.array(shortText).max(30),
    openQuestions: z.array(shortText).max(30),
  })
  .strict();

export const requirementExtractionSchema = z
  .object({
    requirements: z.array(requirementDraftSchema).min(1).max(30),
    recommendations: z.array(shortText).max(20),
    uncertainties: z.array(shortText).max(20),
  })
  .strict();

export const stakeholderAnalysisSchema = z
  .object({
    stakeholders: z
      .array(
        z
          .object({
            name: shortText,
            role: shortText,
            needs: z.array(shortText).max(10),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

export const gapAnalysisSchema = z
  .object({
    openQuestions: z.array(shortText).max(30),
    assumptions: z.array(shortText).max(30),
    uncertainties: z.array(shortText).max(30),
  })
  .strict();

export const storyGenerationSchema = z
  .object({
    epics: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(240),
            description: z.string().trim().min(1).max(8000),
            requirementIds: linkedRequirementIds,
            stories: z
              .array(
                z
                  .object({
                    title: z.string().trim().min(1).max(240),
                    asA: shortText,
                    iWant: shortText,
                    soThat: shortText,
                    requirementIds: linkedRequirementIds,
                    priority: z.enum(["low", "medium", "high", "critical"]),
                  })
                  .strict(),
              )
              .min(1)
              .max(30),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export const acceptanceScenarioTypes = [
  "positive",
  "negative",
  "boundary",
  "validation",
  "edge",
] as const;

export const acceptanceCriteriaSchema = z
  .object({
    criteria: z
      .array(
        z
          .object({
            storyId: z.string().min(1),
            title: z.string().trim().min(1).max(240),
            scenarioType: z.enum(acceptanceScenarioTypes),
            given: z.string().trim().min(1).max(2000),
            when: z.string().trim().min(1).max(2000),
            then: z.string().trim().min(1).max(2000),
            requirementIds: linkedRequirementIds,
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict();

export const requirementValidationSchema = z
  .object({
    findings: z
      .array(
        z
          .object({
            severity: z.enum(["info", "warning", "critical"]),
            artifactType: z.enum(["requirement", ...artifactTypes]),
            artifactId: z.string().min(1),
            description: shortText,
            recommendation: shortText,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const riskAnalysisSchema = z
  .object({
    risks: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(240),
            description: z.string().trim().min(1).max(4000),
            probability: z.enum(["low", "medium", "high"]),
            impact: z.enum(["low", "medium", "high"]),
            mitigation: z.string().trim().min(1).max(4000),
            requirementIds: linkedRequirementIds,
          })
          .strict(),
      )
      .max(30),
    dependencies: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(240),
            description: z.string().trim().min(1).max(4000),
            requirementIds: idList,
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

export const roadmapSchema = z
  .object({
    milestones: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(240),
            description: z.string().trim().min(1).max(4000),
            priority: z.enum(["low", "medium", "high", "critical"]),
            requirementIds: linkedRequirementIds,
            dependencies: z.array(shortText).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export const workflowResultSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    requirementIds: idList,
    artifactIds: idList,
    stakeholders: z.array(z.string().min(1)).max(30).default([]),
    assumptions: z.array(shortText).max(30).default([]),
    openQuestions: z.array(shortText).max(60).default([]),
    recommendations: z.array(shortText).max(20).default([]),
    uncertainties: z.array(shortText).max(30).default([]),
    clarificationRequired: z.boolean().default(false),
    findings: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
  })
  .strict();

export type RequirementDraft = z.infer<typeof requirementDraftSchema>;
export type WorkflowResult = z.infer<typeof workflowResultSchema>;
