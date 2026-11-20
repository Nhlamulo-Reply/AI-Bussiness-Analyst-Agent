import { describe, expect, it } from "vitest";
import { workflowJobSchema, workflowResultSchema } from "./workflow.schemas";

describe("workflow schemas", () => {
  it("requires explicit bounded document selections and rejects unknown request fields", () => {
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: [],
      }).success,
    ).toBe(false);
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: ["document-1"],
        unsupported: true,
      }).success,
    ).toBe(false);
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: Array.from({ length: 11 }, (_, index) => `doc-${index}`),
      }).success,
    ).toBe(false);
  });

  it("applies safe defaults and rejects a malformed result before it can render", () => {
    expect(
      workflowResultSchema.parse({
        summary: "Review the unresolved policy details.",
        requirementIds: ["requirement-1"],
        artifactIds: [],
      }),
    ).toMatchObject({
      stakeholders: [],
      assumptions: [],
      openQuestions: [],
      recommendations: [],
      uncertainties: [],
      clarificationRequired: false,
      findings: [],
    });
    expect(
      workflowResultSchema.safeParse({
        summary: "",
        requirementIds: [],
        artifactIds: [],
      }).success,
    ).toBe(false);
  });
});
