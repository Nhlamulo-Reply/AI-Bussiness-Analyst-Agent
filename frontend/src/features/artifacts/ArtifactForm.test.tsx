import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArtifactForm } from "./ArtifactForm";
import type { Artifact } from "./artifact.schemas";

const artifact: Artifact = {
  id: "artifact-1",
  projectId: "project-1",
  type: "story",
  title: "Recover account access",
  description: "Allow an account holder to recover access.",
  status: "draft",
  requirementIds: ["requirement-1"],
  data: { priority: "high", unknownField: { keep: true } },
  version: 1,
  createdByUserId: "user-1",
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

const requirements = [
  {
    id: "requirement-1",
    projectId: "project-1",
    title: "Confirm account ownership",
    description: "Verify access before recovery.",
    type: "functional" as const,
    status: "draft" as const,
    priority: "medium" as const,
    sourceFacts: [],
    assumptions: [],
    openQuestions: [],
    traceability: { documentIds: [] },
    version: 1,
    createdByUserId: "user-1",
    createdAt: "2026-03-04T05:06:07.000Z",
    updatedAt: "2026-03-04T05:06:07.000Z",
  },
  {
    id: "requirement-2",
    projectId: "project-1",
    title: "Notify the account holder",
    description: "Send a confirmation message.",
    type: "business" as const,
    status: "draft" as const,
    priority: "low" as const,
    sourceFacts: [],
    assumptions: [],
    openQuestions: [],
    traceability: { documentIds: [] },
    version: 1,
    createdByUserId: "user-1",
    createdAt: "2026-03-04T05:06:07.000Z",
    updatedAt: "2026-03-04T05:06:07.000Z",
  },
];

const defaultProps = {
  requirements,
  requirementsLoading: false,
  onRetryRequirements: vi.fn(),
  isSubmitting: false,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe("ArtifactForm", () => {
  it("validates type and title and sends linked requirements with parsed JSON", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ArtifactForm {...defaultProps} onSubmit={onSubmit} mode="create" />,
    );

    await user.click(screen.getByRole("button", { name: "Create draft" }));
    expect(screen.getByText(/Invalid option/)).toBeInTheDocument();
    expect(screen.getByText("Enter an artifact title.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByRole("combobox", { name: /^Artifact type/ }),
      "story",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Recover account access",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Notify the account holder/ }),
    );
    const dataField = screen.getByRole("textbox", {
      name: /Structured data/,
    });
    fireEvent.change(dataField, {
      target: { value: '{"priority":"high","criteria":["verified"]}' },
    });
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "story",
        title: "Recover account access",
        requirementIds: ["requirement-2"],
        data: { priority: "high", criteria: ["verified"] },
      }),
    );
  });

  it("refuses malformed JSON and preserves unknown data during edits", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ArtifactForm
        {...defaultProps}
        artifact={artifact}
        onSubmit={onSubmit}
        mode="edit"
      />,
    );

    const dataField = screen.getByRole("textbox", {
      name: /Structured data/,
    });
    await user.clear(dataField);
    fireEvent.change(dataField, { target: { value: "{invalid" } });
    await user.click(screen.getByRole("button", { name: "Save revision" }));
    expect(
      screen.getByText("Enter valid JSON before saving this artifact."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(dataField);
    fireEvent.change(dataField, {
      target: { value: '{"priority":"high","unknownField":{"keep":true}}' },
    });
    const title = screen.getByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Updated account recovery");
    await user.click(screen.getByRole("button", { name: "Save revision" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "story",
        title: "Updated account recovery",
        data: { priority: "high", unknownField: { keep: true } },
        requirementIds: ["requirement-1"],
      }),
    );
    expect(
      screen.getByText("Type cannot be changed after creation."),
    ).toBeInTheDocument();
  });
});
