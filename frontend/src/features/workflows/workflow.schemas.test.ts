import { describe, expect, it } from "vitest";
import { workflowJobSchema, workflowResultSchema } from "./workflow.schemas";

describe("workflow schemas", () => {
  it("allows description-only runs and requires consent for explicitly selected documents", () => {
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: [],
      }).success,
    ).toBe(true);
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: ["document-1"],
      }).success,
    ).toBe(false);
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: ["document-1"],
        shareDocumentContent: true,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown request fields and document selections beyond the limit", () => {
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: ["document-1"],
        shareDocumentContent: true,
        unsupported: true,
      }).success,
    ).toBe(false);
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        documentIds: Array.from({ length: 11 }, (_, index) => `doc-${index}`),
        shareDocumentContent: true,
      }).success,
    ).toBe(false);
  });

  it("accepts unique template selections and rejects duplicate template IDs", () => {
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        templateIds: ["template-1", "template-2"],
      }).success,
    ).toBe(true);
    expect(
      workflowJobSchema.safeParse({
        projectId: "project-1",
        templateIds: ["template-1", "template-1"],
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
