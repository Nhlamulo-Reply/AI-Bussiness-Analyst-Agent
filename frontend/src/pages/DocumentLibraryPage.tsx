import {
  Archive,
  ArchiveRestore,
  FileText,
  FileUp,
  Files,
  LoaderCircle,
  RotateCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Dialog } from "../components/ui/Dialog";
import { TrashConfirmationDialog } from "../components/ui/TrashConfirmationDialog";
import { MoveToBinMenu } from "../components/ui/MoveToBinMenu";
import { useAuth } from "../features/auth/useAuth";
import { hasPermission } from "../features/auth/permissions";
import {
  useArchiveProjectDocument,
  useProjectDocuments,
  useRestoreProjectDocument,
  useUploadProjectDocument,
} from "../features/documents/document-queries";
import {
  documentMimeTypeSchema,
  formatFileSize,
  getDocumentFileValidationError,
  getDocumentTypeLabel,
  type DocumentMetadata,
} from "../features/documents/document.schemas";
import { useProject } from "../features/projects/project-queries";
import { ApiError, getApiErrorPresentation } from "../lib/api-client";
import { useMoveToTrash } from "../features/trash/trash-queries";

const fileAccept = [
  ".pdf",
  ".docx",
  ".txt",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
].join(",");

const uploadDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function getSelectedFileTypeLabel(file: File) {
  const mimeType = documentMimeTypeSchema.safeParse(file.type);
  return mimeType.success
    ? getDocumentTypeLabel(mimeType.data)
    : "Unsupported type";
}

export function ProjectDocumentLibraryRoute() {
  const { projectId = "" } = useParams();
  return <DocumentLibraryPage key={projectId} />;
}

export function DocumentLibraryPage() {
  const { projectId = "" } = useParams();
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectionError, setSelectionError] = useState<string>();
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DocumentMetadata | null>(
    null,
  );
  const [trashTarget, setTrashTarget] = useState<DocumentMetadata | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const projectQuery = useProject(projectId);
  const isProjectOwner =
    Boolean(session?.user.id) &&
    projectQuery.data?.ownerUserId === session?.user.id;
  const canUploadDocuments = hasPermission(
    session?.user.roles,
    "analysis.prepare",
  );
  const canManageDocuments = isProjectOwner;
  const documentsQuery = useProjectDocuments(
    projectId,
    canManageDocuments && showArchived,
  );
  const uploadMutation = useUploadProjectDocument(projectId, setUploadProgress);
  const archiveMutation = useArchiveProjectDocument(projectId);
  const restoreMutation = useRestoreProjectDocument(projectId);
  const trashMutation = useMoveToTrash();
  const documents = documentsQuery.data ?? [];
  useEffect(() => () => uploadControllerRef.current?.abort(), [projectId]);
  const duplicateFileName = selectedFile
    ? documents.some(
        (document) =>
          document.fileName.toLowerCase() === selectedFile.name.toLowerCase(),
      )
    : false;

  const selectFiles = (files: FileList) => {
    if (uploadMutation.isPending || files.length === 0) return;
    uploadMutation.reset();
    setPrivacyConfirmed(false);
    setUploadProgress(0);

    if (files.length !== 1) {
      setSelectedFile(null);
      setSelectionError("Choose one document at a time.");
      return;
    }

    const file = files.item(0);
    if (!file) {
      setSelectedFile(null);
      setSelectionError("We couldn't read that file. Please choose it again.");
      return;
    }

    setSelectedFile(file);
    setSelectionError(getDocumentFileValidationError(file));
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setSelectionError(undefined);
    setPrivacyConfirmed(false);
    setUploadProgress(0);
    uploadMutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (uploadMutation.isPending) return;
    selectFiles(event.dataTransfer.files);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || selectionError || !privacyConfirmed) return;

    setUploadProgress(0);
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    uploadMutation.mutate(
      { file: selectedFile, signal: controller.signal },
      {
        onSuccess: () => {
          setSelectedFile(null);
          setSelectionError(undefined);
          setPrivacyConfirmed(false);
          if (inputRef.current) inputRef.current.value = "";
        },
        onSettled: () => {
          uploadControllerRef.current = null;
        },
      },
    );
  };

  const wasUploadCancelled =
    uploadMutation.error instanceof ApiError &&
    uploadMutation.error.code === "REQUEST_ABORTED";
  const uploadError =
    uploadMutation.isError && !wasUploadCancelled
      ? getApiErrorPresentation(
          uploadMutation.error,
          "The document couldn't be uploaded. Please try again.",
        )
      : undefined;
  const listError = documentsQuery.isError
    ? getApiErrorPresentation(
        documentsQuery.error,
        "The document library couldn't be loaded.",
      )
    : undefined;
  const projectError = projectQuery.isError
    ? getApiErrorPresentation(
        projectQuery.error,
        "Project ownership couldn't be verified; archive controls are unavailable.",
      )
    : undefined;
  const lifecycleError = archiveMutation.isError
    ? getApiErrorPresentation(
        archiveMutation.error,
        "The document couldn't be archived. Please try again.",
      )
    : restoreMutation.isError
      ? getApiErrorPresentation(
          restoreMutation.error,
          "The document couldn't be restored. Please try again.",
        )
      : trashMutation.isError
        ? getApiErrorPresentation(
            trashMutation.error,
            "The document couldn't be moved to the bin. Please try again.",
          )
      : undefined;

  return (
    <section
      aria-labelledby="document-library-title"
      className="document-library"
    >
      <header className="document-library__heading">
        <div>
          <p className="eyebrow">PROJECT WORKSPACE</p>
          <h1 id="document-library-title">Source documents</h1>
          <p>
            Add the evidence your team will use to understand the project and
            shape its requirements.
          </p>
        </div>
        <Link
          className="button button--secondary button--medium"
          to={`/app/projects/${encodeURIComponent(projectId)}`}
        >
          <span>Project overview</span>
        </Link>
      </header>

      {projectError ? (
        <ErrorPanel
          message={projectError.message}
          requestId={projectError.requestId}
          title="Ownership unavailable"
        />
      ) : null}

      <div className="document-library__grid">
        {canUploadDocuments ? (
          <Card as="section" className="document-upload-card">
            <div className="document-section-heading">
              <span className="document-section-heading__icon">
                <FileUp aria-hidden="true" size={18} />
              </span>
              <div>
                <h2>Add a document</h2>
                <p>One file per upload · up to 5 MiB</p>
              </div>
            </div>

            <form className="document-upload-form" onSubmit={handleSubmit}>
              <div
                aria-label="Drop a source document"
                className={`document-dropzone${isDragging ? " document-dropzone--active" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!uploadMutation.isPending) setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return;
                  }
                  setIsDragging(false);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!uploadMutation.isPending) setIsDragging(true);
                }}
                onDrop={handleDrop}
                role="region"
              >
                <input
                  accept={fileAccept}
                  aria-label="Choose a source document"
                  className="document-dropzone__input"
                  disabled={uploadMutation.isPending}
                  onChange={(event) => {
                    if (event.currentTarget.files) {
                      selectFiles(event.currentTarget.files);
                    }
                    event.currentTarget.value = "";
                  }}
                  ref={inputRef}
                  tabIndex={-1}
                  type="file"
                />
                <span className="document-dropzone__icon">
                  <Files aria-hidden="true" size={22} />
                </span>
                <strong>Drop a file here</strong>
                <span>or choose one from your device</span>
                <Button
                  disabled={uploadMutation.isPending}
                  onClick={() => inputRef.current?.click()}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Browse files
                </Button>
                <small>PDF, DOCX, or plain-text TXT</small>
              </div>

              {selectionError ? (
                <p className="document-inline-error" role="alert">
                  {selectionError}
                </p>
              ) : null}

              {selectedFile ? (
                <div className="document-selected-file" role="status">
                  <span className="document-selected-file__icon">
                    <FileText aria-hidden="true" size={17} />
                  </span>
                  <span className="document-selected-file__details">
                    <strong title={selectedFile.name}>
                      {selectedFile.name}
                    </strong>
                    <small>
                      {getSelectedFileTypeLabel(selectedFile)} ·{" "}
                      {formatFileSize(selectedFile.size)}
                    </small>
                  </span>
                  <button
                    aria-label="Remove selected file"
                    className="document-selected-file__remove"
                    disabled={uploadMutation.isPending}
                    onClick={clearSelection}
                    type="button"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </div>
              ) : null}

              {duplicateFileName ? (
                <p className="document-duplicate-warning" role="status">
                  A document with this filename is already listed. Uploading it
                  will not overwrite the existing document; the backend does not
                  deduplicate filenames.
                </p>
              ) : null}

              <section
                aria-labelledby="document-privacy-title"
                className="document-privacy"
              >
                <div className="document-privacy__heading">
                  <ShieldCheck aria-hidden="true" size={17} />
                  <h3 id="document-privacy-title">
                    Keep document sharing clear
                  </h3>
                </div>
                <p>
                  Uploading stores this file in the project workspace; it does
                  not send the content to an AI provider. A future AI workflow
                  will ask for separate confirmation before sharing selected
                  document text and project context with the configured
                  provider. Only upload material you are authorized to use.
                </p>
                <label className="document-privacy__check">
                  <input
                    checked={privacyConfirmed}
                    onChange={(event) =>
                      setPrivacyConfirmed(event.currentTarget.checked)
                    }
                    disabled={uploadMutation.isPending}
                    required
                    type="checkbox"
                  />
                  <span>
                    I confirm that I’m authorized to upload this document and
                    understand the privacy notice above.
                  </span>
                </label>
              </section>

              {uploadMutation.isPending ? (
                <div className="document-upload-progress" role="status">
                  <div className="document-upload-progress__meta">
                    <span>
                      {uploadProgress < 100
                        ? "Uploading document"
                        : "Finishing upload"}
                    </span>
                    <span className="document-upload-progress__actions">
                      {uploadProgress}%
                      <button
                        className="document-upload-progress__cancel"
                        onClick={() => uploadControllerRef.current?.abort()}
                        type="button"
                      >
                        Cancel
                      </button>
                    </span>
                  </div>
                  <progress
                    aria-label="Document upload progress"
                    max={100}
                    value={uploadProgress}
                  />
                </div>
              ) : null}

              {wasUploadCancelled ? (
                <p className="document-inline-error" role="status">
                  Upload request cancelled. The server may already have received
                  the file; check the library before retrying.
                </p>
              ) : null}

              {uploadError ? (
                <ErrorPanel
                  message={uploadError.message}
                  requestId={uploadError.requestId}
                  title="Upload unsuccessful"
                />
              ) : null}

              {uploadMutation.isSuccess && uploadMutation.data ? (
                <p className="document-upload-success" role="status">
                  {uploadMutation.data.fileName} was added to this project.
                </p>
              ) : null}

              <Button
                className="document-upload-form__submit"
                disabled={
                  !selectedFile ||
                  Boolean(selectionError) ||
                  !privacyConfirmed ||
                  uploadMutation.isPending
                }
                leadingIcon={
                  uploadMutation.isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="spin"
                      size={16}
                    />
                  ) : (
                    <FileUp aria-hidden="true" size={16} />
                  )
                }
                type="submit"
              >
                {uploadMutation.isPending ? "Uploading" : "Upload document"}
              </Button>
            </form>
          </Card>
        ) : (
          <Card as="section" className="document-upload-card">
            <div className="document-section-heading">
              <span className="document-section-heading__icon">
                <Files aria-hidden="true" size={18} />
              </span>
              <div>
                <h2>Read-only document access</h2>
                <p>
                  Business Analysts can add source documents. You can review the
                  existing project evidence here.
                </p>
              </div>
            </div>
          </Card>
        )}

        <section
          aria-labelledby="document-list-title"
          className="document-library__list"
        >
          <header className="document-list-heading">
            <div>
              <p className="eyebrow">PROJECT EVIDENCE</p>
              <h2 id="document-list-title">Document library</h2>
              <p>
                {documentsQuery.isPending
                  ? "Loading document metadata…"
                  : `${documents.length} ${documents.length === 1 ? "document" : "documents"}`}
              </p>
            </div>
            {canManageDocuments ? (
              <label className="document-archive-filter">
                <input
                  checked={showArchived}
                  onChange={(event) =>
                    setShowArchived(event.currentTarget.checked)
                  }
                  type="checkbox"
                />
                <span>Show archived documents</span>
              </label>
            ) : null}
            <Button
              className="document-list-heading__refresh"
              disabled={documentsQuery.isFetching}
              leadingIcon={
                <RotateCw
                  aria-hidden="true"
                  className={documentsQuery.isFetching ? "spin" : ""}
                  size={14}
                />
              }
              onClick={() => void documentsQuery.refetch()}
              size="small"
              type="button"
              variant="secondary"
            >
              Refresh
            </Button>
          </header>

          {documentsQuery.isPending ? (
            <Card
              aria-busy="true"
              className="document-library__loading"
              role="status"
            >
              <LoadingSkeleton lines={4} />
            </Card>
          ) : null}

          {listError && !documentsQuery.data ? (
            <div className="document-library__error">
              <ErrorPanel
                message={listError.message}
                requestId={listError.requestId}
                title="Documents unavailable"
              />
              <Button
                disabled={documentsQuery.isFetching}
                leadingIcon={<RotateCw aria-hidden="true" size={15} />}
                onClick={() => void documentsQuery.refetch()}
                variant="secondary"
              >
                Try again
              </Button>
            </div>
          ) : null}

          {listError && documentsQuery.data ? (
            <div className="document-library__stale-error">
              <ErrorPanel
                message={listError.message}
                requestId={listError.requestId}
                title="Couldn't refresh documents"
              />
            </div>
          ) : null}

          {documentsQuery.data && documents.length === 0 ? (
            <Card className="document-library__empty">
              <EmptyState
                description={
                  showArchived
                    ? "No documents are currently listed in this project."
                    : "Uploaded source material will appear here with its file type, size, and upload date. Document contents are not displayed or downloaded on this screen."
                }
                icon={Files}
                title={
                  showArchived
                    ? "No documents found"
                    : "Your source library is ready"
                }
              />
            </Card>
          ) : null}

          {documents.length > 0 ? (
            <ul aria-label="Project documents" className="document-list">
              {documents.map((document) => {
                const isDuplicate = documents.some(
                  (other) =>
                    other.id !== document.id &&
                    other.fileName.toLowerCase() ===
                      document.fileName.toLowerCase(),
                );
                return (
                  <li className="document-list__item" key={document.id}>
                    <Card as="article" className="document-card">
                      <span className="document-card__icon">
                        <FileText aria-hidden="true" size={19} />
                      </span>
                      <div className="document-card__main">
                        <div className="document-card__title-row">
                          <h3 title={document.fileName}>{document.fileName}</h3>
                          {isDuplicate ? (
                            <span className="document-card__duplicate">
                              Duplicate name
                            </span>
                          ) : null}
                        </div>
                        <div className="document-card__badges">
                          <StatusBadge
                            tone={
                              document.status === "archived"
                                ? "warning"
                                : "success"
                            }
                          >
                            {document.status === "archived"
                              ? "Archived"
                              : "Uploaded"}
                          </StatusBadge>
                          <span className="document-card__type">
                            {getDocumentTypeLabel(document.mimeType)}
                          </span>
                        </div>
                        <div className="document-card__metadata">
                          <span>{formatFileSize(document.sizeBytes)}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={document.createdAt}>
                            {uploadDateFormatter.format(
                              new Date(document.createdAt),
                            )}
                          </time>
                        </div>
                        <code className="document-card__id">
                          ID {document.id}
                        </code>
                      </div>
                      {canManageDocuments ? (
                        <div className="document-card__actions">
                          <Button
                            disabled={
                              archiveMutation.isPending ||
                              restoreMutation.isPending ||
                              trashMutation.isPending
                            }
                            leadingIcon={
                              document.status === "archived" ? (
                                <ArchiveRestore
                                  aria-hidden="true"
                                  size={15}
                                />
                              ) : (
                                <Archive aria-hidden="true" size={15} />
                              )
                            }
                            onClick={() => {
                              if (document.status === "archived") {
                                restoreMutation.mutate(document.id);
                              } else {
                                setArchiveTarget(document);
                                archiveMutation.reset();
                              }
                            }}
                            size="small"
                            type="button"
                            variant="secondary"
                          >
                            {document.status === "archived"
                              ? "Restore"
                              : "Archive"}
                          </Button>
                          <MoveToBinMenu
                            disabled={trashMutation.isPending}
                            itemLabel={`document ${document.fileName}`}
                            onMoveToBin={() => {
                              trashMutation.reset();
                              setTrashTarget(document);
                            }}
                          />
                        </div>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {lifecycleError ? (
            <ErrorPanel
              message={lifecycleError.message}
              requestId={lifecycleError.requestId}
              title="Document update unsuccessful"
            />
          ) : null}

          <p className="document-library__footnote">
            Only the project owner can archive, restore, or move documents to
            the bin. Archived files are hidden from standard lists, workflows,
            and exports while their contents remain stored. Trash items can be
            restored for 30 days before an administrator may permanently delete
            them, subject to project-reference safeguards.
          </p>
        </section>
      </div>
      <Dialog
        description="The file will be hidden from the standard library, AI workflows, and project exports. Its contents will remain stored and can be restored by the project owner."
        onOpenChange={(open) => {
          if (!open && !archiveMutation.isPending) setArchiveTarget(null);
        }}
        open={Boolean(archiveTarget)}
        title="Archive this document?"
      >
        {archiveTarget ? (
          <div className="document-archive-dialog">
            <p>
              Archive <strong>{archiveTarget.fileName}</strong>?
            </p>
            <div className="dialog__actions">
              <Button
                disabled={archiveMutation.isPending}
                onClick={() => setArchiveTarget(null)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={archiveMutation.isPending}
                leadingIcon={
                  archiveMutation.isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="spin"
                      size={16}
                    />
                  ) : (
                    <Archive aria-hidden="true" size={16} />
                  )
                }
                onClick={() =>
                  archiveMutation.mutate(archiveTarget.id, {
                    onSuccess: () => setArchiveTarget(null),
                  })
                }
                type="button"
              >
                {archiveMutation.isPending ? "Archiving" : "Archive document"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
      <TrashConfirmationDialog
        error={
          trashMutation.isError
            ? getApiErrorPresentation(
                trashMutation.error,
                "The document couldn't be moved to the bin.",
              ).message
            : undefined
        }
        isPending={trashMutation.isPending}
        itemLabel={trashTarget?.fileName ?? ""}
        onConfirm={() => {
          if (!trashTarget) return;
          trashMutation.mutate(
            { resourceType: "document", resourceId: trashTarget.id },
            { onSuccess: () => setTrashTarget(null) },
          );
        }}
        onOpenChange={(open) => {
          if (!open && !trashMutation.isPending) {
            setTrashTarget(null);
            trashMutation.reset();
          }
        }}
        open={Boolean(trashTarget)}
        requestId={
          trashMutation.isError
            ? getApiErrorPresentation(
                trashMutation.error,
                "The document couldn't be moved to the bin.",
              ).requestId
            : undefined
        }
      />
    </section>
  );
}
