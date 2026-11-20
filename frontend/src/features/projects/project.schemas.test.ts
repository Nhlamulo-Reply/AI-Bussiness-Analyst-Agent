import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  projectPageSchema,
  projectSchema,
} from "./project.schemas";

const project = {
  id: "project-1",
  name: "Customer onboarding",
  description: "Improve the first-use experience.",
  ownerUserId: "user-1",
  members: [],
  status: "active",
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-03T03:04:05.000Z",
};

describe("project schemas", () => {
  it("accepts backend project records and paginated list metadata", () => {
    expect(projectSchema.safeParse(project).success).toBe(true);
    expect(
      projectPageSchema.safeParse({
        items: [project],
        page: 1,
        limit: 12,
        total: 13,
      }).success,
    ).toBe(true);
  });

  it("normalizes creation input and enforces backend name and description limits", () => {
    expect(
      createProjectSchema.parse({
        name: "  Customer onboarding  ",
        description: "  First-use experience.  ",
      }),
    ).toEqual({
      name: "Customer onboarding",
      description: "First-use experience.",
    });

    expect(
      createProjectSchema.safeParse({ name: " ", description: "" }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({
        name: "x".repeat(161),
        description: "",
      }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({
        name: "Valid name",
        description: "x".repeat(4001),
      }).success,
    ).toBe(false);
  });
});
