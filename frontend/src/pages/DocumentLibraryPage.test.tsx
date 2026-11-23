import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthUser } from "../features/auth/auth.schemas";
import {
  archiveProjectDocument,
  listProjectDocuments,
  restoreProjectDocument,
  uploadProjectDocument,
} from "../features/documents/document-api";
import type { DocumentMetadata } from "../features/documents/document.schemas";
import { AuthProvider } from "../features/auth/AuthProvider";
import { getProject } from "../features/projects/project-api";
import type { Project } from "../features/projects/project.schemas";
import { ApiError } from "../lib/api-client";
import { clearSession, setSession } from "../lib/auth-store";
import { DocumentLibraryPage } from "./DocumentLibraryPage";

vi.mock("../features/documents/document-api", () => ({
  archiveProjectDocument: vi.fn(),
  listProjectDocuments: vi.fn(),
  restoreProjectDocument: vi.fn(),
  uploadProjectDocument: vi.fn(),
}));

vi.mock("../features/projects/project-api", () => ({
  getProject: vi.fn(),
}));

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

const project: Project = {
  id: "project-1",
  name: "Product discovery",
  description: "",
  businessObjective: "",
  inScope: "",
  outOfScope: "",
  stakeholders: [],
  constraints: [],
  desiredOutputs: [],
  ownerUserId: "user-1",
  members: [],
  status: "active",
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

const document: DocumentMetadata = {
  id: "document-1",
  projectId: "project-1",
  uploadedByUserId: "user-1",
  fileName: "brief.txt",
  mimeType: "text/plain",
  sizeBytes: 32,
  status: "uploaded",
  createdAt: "2026-03-04T05:06:07.000Z",
};

function renderDocumentLibrary(
  documents: DocumentMetadata[],
  allDocuments: DocumentMetadata[] = documents,
) {
  setSession({ accessToken: "test-token", user });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: { user },
        requestId: "request-auth",
      }),
    ),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  vi.mocked(listProjectDocuments).mockResolvedValue(documents);
  vi.mocked(getProject).mockResolvedValue(project);
  vi.mocked(listProjectDocuments).mockImplementation(
    async (_projectId, includeArchived = false) =>
      includeArchived
        ? allDocuments
        : allDocuments.filter((item) => item.status === "uploaded"),
  );

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/app/projects/project-1/documents"]}>
          <Routes>
            <Route
              path="/app/projects/:projectId/documents"
              element={<DocumentLibraryPage />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("DocumentLibraryPage", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    });
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
    vi.mocked(listProjectDocuments).mockReset();
    vi.mocked(archiveProjectDocument).mockReset();
    vi.mocked(restoreProjectDocument).mockReset();
    vi.mocked(uploadProjectDocument).mockReset();
    vi.mocked(getProject).mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows actual metadata and explains future AI privacy confirmation", async () => {
    renderDocumentLibrary([document]);

    expect(
      await screen.findByRole("heading", { name: "Document library" }),
    ).toBeInTheDocument();
    expect(screen.getByText("brief.txt")).toBeInTheDocument();
    expect(screen.getByText("32 B")).toBeInTheDocument();
    expect(screen.getByText("ID document-1")).toBeInTheDocument();
    expect(
      screen.getByText(/does not send the content to an AI provider/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/will ask for separate confirmation/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/contentBase64/i)).not.toBeInTheDocument();
  });

  it("requires privacy acknowledgement and shows duplicate-name and upload progress states", async () => {
    renderDocumentLibrary([document]);
    const userActions = userEvent.setup();
    const file = new File(["new source material"], "brief.txt", {
      type: "text/plain",
    });
    let finishUpload: ((uploaded: DocumentMetadata) => void) | undefined;
    vi.mocked(uploadProjectDocument).mockImplementation(
      (_projectId, selected, onProgress) =>
        new Promise((resolve) => {
          onProgress?.(62);
          finishUpload = resolve;
          expect(selected).toBe(file);
        }),
    );

    await userActions.upload(
      screen.getByLabelText("Choose a source document"),
      file,
    );
    expect(
      screen.getByText(/backend does not deduplicate filenames/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload document" }),
    ).toBeDisabled();
    expect(uploadProjectDocument).not.toHaveBeenCalled();

    await userActions.click(
      screen.getByRole("checkbox", {
        name: /I confirm that I’m authorized to upload this document/i,
      }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Upload document" }),
    );

    expect(
      await screen.findByRole("progressbar", {
        name: "Document upload progress",
      }),
    ).toHaveAttribute("value", "62");
    expect(uploadProjectDocument).toHaveBeenCalledWith(
      "project-1",
      file,
      expect.any(Function),
      expect.any(AbortSignal),
    );

    finishUpload?.({ ...document, id: "document-2" });
    expect(
      await screen.findByText("brief.txt was added to this project."),
    ).toBeInTheDocument();
  });

  it("rejects more than one file when users drop a batch", async () => {
    renderDocumentLibrary([]);
    const first = new File(["first"], "first.txt", { type: "text/plain" });
    const second = new File(["second"], "second.txt", { type: "text/plain" });
    const dropzone = screen.getByRole("region", {
      name: "Drop a source document",
    });
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [first, second] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose one document at a time.",
    );
  });

  it("cancels the upload request without claiming server-side rollback", async () => {
    renderDocumentLibrary([]);
    const userActions = userEvent.setup();
    const file = new File(["source material"], "brief.txt", {
      type: "text/plain",
    });
    vi.mocked(uploadProjectDocument).mockImplementation(
      (_projectId, _file, _onProgress, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(
              new ApiError(0, "REQUEST_ABORTED", "The request was cancelled."),
            );
          });
        }),
    );

    await userActions.upload(
      screen.getByLabelText("Choose a source document"),
      file,
    );
    await userActions.click(
      screen.getByRole("checkbox", {
        name: /I confirm that I’m authorized to upload this document/i,
      }),
    );
    await userActions.click(
      screen.getByRole("button", { name: "Upload document" }),
    );
    await userActions.click(
      await screen.findByRole("button", { name: "Cancel" }),
    );

    expect(
      await screen.findByText(/server may already have received the file/i),
    ).toBeInTheDocument();
  });

  it("archives documents with confirmation and lets the owner restore them", async () => {
    const archivedDocument: DocumentMetadata = {
      ...document,
      id: "document-archived",
      status: "archived",
      archivedAt: "2026-03-05T05:06:07.000Z",
      archivedByUserId: user.id,
    };
    vi.mocked(archiveProjectDocument).mockResolvedValue(archivedDocument);
    vi.mocked(restoreProjectDocument).mockResolvedValue(document);
    renderDocumentLibrary([document], [document, archivedDocument]);
    const userActions = userEvent.setup();

    await userActions.click(
      await screen.findByRole("button", { name: "Archive" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Archive this document?" }),
    ).toBeInTheDocument();
    await userActions.click(
      screen.getByRole("button", { name: "Archive document" }),
    );
    expect(archiveProjectDocument).toHaveBeenCalledWith(
      "project-1",
      "document-1",
    );

    await userActions.click(
      screen.getByRole("checkbox", { name: "Show archived documents" }),
    );
    await waitFor(() =>
      expect(listProjectDocuments).toHaveBeenCalledWith(
        "project-1",
        true,
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByText("ID document-archived")).toBeInTheDocument();
    await userActions.click(screen.getByRole("button", { name: "Restore" }));
    expect(restoreProjectDocument).toHaveBeenCalledWith(
      "project-1",
      "document-archived",
    );
    expect(listProjectDocuments).toHaveBeenCalledWith(
      "project-1",
      true,
      expect.any(AbortSignal),
    );
  });
});
