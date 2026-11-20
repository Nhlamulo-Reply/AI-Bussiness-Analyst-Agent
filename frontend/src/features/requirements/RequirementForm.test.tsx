import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequirementForm } from "./RequirementForm";
import type { Requirement } from "./requirement.schemas";

const requirement: Requirement = {
  id: "requirement-1",
  projectId: "project-1",
  title: "Confirm account ownership",
  description: "Verify account access before updating email.",
  type: "functional",
  status: "approved",
  priority: "high",
  sourceFacts: ["Email changes require verification."],
  assumptions: ["The user can access their current inbox."],
  openQuestions: ["What if the account is inaccessible?"],
  traceability: { documentIds: ["document-1"] },
  version: 3,
  createdByUserId: "user-1",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-02T10:00:00.000Z",
};

const documents = [
  {
    id: "document-1",
    projectId: "project-1",
    uploadedByUserId: "user-1",
    fileName: "account-policy.pdf",
    mimeType: "application/pdf" as const,
    sizeBytes: 1200,
    status: "uploaded" as const,
    createdAt: "2026-03-01T09:00:00.000Z",
  },
];

const defaultProps = {
  documents,
  documentsLoading: false,
  onRetryDocuments: vi.fn(),
  isSubmitting: false,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe("RequirementForm", () => {
  it("validates the required type and title before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <RequirementForm {...defaultProps} onSubmit={onSubmit} mode="create" />,
    );

    await user.click(
      screen.getByRole("button", { name: "Create requirement" }),
    );

    expect(screen.getByText("Enter a requirement title.")).toBeInTheDocument();
    expect(screen.getByText("Choose a requirement type.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normalized evidence and selected source document IDs", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <RequirementForm {...defaultProps} onSubmit={onSubmit} mode="create" />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "Confirm account ownership",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Type" }),
      "business",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Source facts" }),
      "Verified email is required.\nConfirmation links expire.",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /account-policy\.pdf/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Create requirement" }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Confirm account ownership",
        type: "business",
        sourceFacts: [
          "Verified email is required.",
          "Confirmation links expire.",
        ],
        documentIds: ["document-1"],
      }),
    );
  });

  it("keeps source document links read-only while editing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <RequirementForm
        {...defaultProps}
        onSubmit={onSubmit}
        mode="edit"
        requirement={requirement}
      />,
    );

    expect(
      screen.getByText(
        "Document links cannot be changed through the current requirement edit API.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Saving an edit creates a version snapshot/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: requirement.title,
        sourceFacts: requirement.sourceFacts,
        documentIds: ["document-1"],
      }),
    );
  });

  it("preserves unchanged evidence entries that contain line breaks", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const requirementWithMultilineFact = {
      ...requirement,
      sourceFacts: [
        "A fact retained from an earlier import.\nIt has a second line.",
      ],
    };

    render(
      <RequirementForm
        {...defaultProps}
        onSubmit={onSubmit}
        mode="edit"
        requirement={requirementWithMultilineFact}
      />,
    );

    const title = screen.getByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Updated account ownership requirement");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFacts: [
          "A fact retained from an earlier import.\nIt has a second line.",
        ],
      }),
    );
  });
});
