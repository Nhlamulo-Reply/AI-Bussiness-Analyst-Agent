import { describe, expect, it } from "vitest";
import { requirementFormSchema } from "./requirement-form.schemas";

const validInput = {
  title: "  Verify account ownership  ",
  description: "  A user must confirm ownership before changing email.  ",
  type: "functional",
  priority: "high",
  sourceFacts:
    "  Email changes require verification.\n\nA confirmation link expires.",
  assumptions: "The user can access their current inbox.",
  openQuestions: "Which support team handles inaccessible accounts?",
  documentIds: ["document-1"],
};

describe("requirement form schema", () => {
  it("normalizes text and turns multiline evidence into trimmed lists", () => {
    expect(requirementFormSchema.parse(validInput)).toEqual({
      title: "Verify account ownership",
      description: "A user must confirm ownership before changing email.",
      type: "functional",
      priority: "high",
      sourceFacts: [
        "Email changes require verification.",
        "A confirmation link expires.",
      ],
      assumptions: ["The user can access their current inbox."],
      openQuestions: ["Which support team handles inaccessible accounts?"],
      documentIds: ["document-1"],
    });
  });

  it("rejects a missing type and evidence exceeding backend limits", () => {
    expect(
      requirementFormSchema.safeParse({ ...validInput, type: "" }).success,
    ).toBe(false);
    expect(
      requirementFormSchema.safeParse({
        ...validInput,
        sourceFacts: Array.from({ length: 101 }, () => "fact").join("\n"),
      }).success,
    ).toBe(false);
    expect(
      requirementFormSchema.safeParse({
        ...validInput,
        assumptions: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
