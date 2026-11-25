import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import {
  downloadProjectExport,
  projectExportFormats,
  projectExportFormatSchema,
  type ProjectExportFormat,
} from "../features/exports/export-api";
import { getApiErrorPresentation } from "../lib/api-client";

const formatLabels: Record<ProjectExportFormat, string> = {
  json: "JSON (.json)",
  markdown: "Markdown (.markdown)",
  csv: "CSV (.csv)",
};

function saveExportFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectExportRoute() {
  const { projectId = "" } = useParams();
  return <ProjectExportPage key={projectId} projectId={projectId} />;
}

function ProjectExportPage({ projectId }: { projectId: string }) {
  const [format, setFormat] = useState<ProjectExportFormat>("json");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [notice, setNotice] = useState<string>();
  const activeRequest = useRef<AbortController | undefined>(undefined);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
      activeRequest.current = undefined;
    },
    [projectId],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const controller = new AbortController();
    activeRequest.current = controller;
    setError(null);
    setNotice(undefined);
    setIsDownloading(true);

    try {
      const file = await downloadProjectExport(
        projectId,
        format,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      saveExportFile(file.blob, file.filename);
      setNotice(`Downloaded ${file.filename}.`);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError ?? new Error("The export request failed."));
      }
    } finally {
      if (!controller.signal.aborted) {
        activeRequest.current = undefined;
        setIsDownloading(false);
      }
    }
  };

  const errorPresentation = getApiErrorPresentation(
    error,
    "The project export couldn't be downloaded. Please try again.",
  );

  return (
    <section aria-labelledby="project-export-title" className="export-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PROJECT DATA</p>
          <h1 id="project-export-title">Project exports</h1>
          <p className="page-heading__description">
            Download project details, requirements, deliverables, and approval
            records in a format that works for your team.
          </p>
        </div>
      </header>

      <Card className="export-card">
        <div>
          <h2>Choose a format</h2>
          <p>
            Export files contain project records only. Uploaded document
            contents are not included.
          </p>
        </div>
        <form className="export-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="project-export-format">
              File format
            </label>
            <select
              className="field__control"
              id="project-export-format"
              onChange={(event) => {
                const selected = projectExportFormatSchema.safeParse(
                  event.target.value,
                );
                if (!selected.success) {
                  setError(new Error("Select a supported export format."));
                  setNotice(undefined);
                  return;
                }
                setError(null);
                setNotice(undefined);
                setFormat(selected.data);
              }}
              value={format}
            >
              {projectExportFormats.map((option) => (
                <option key={option} value={option}>
                  {formatLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={isDownloading}
            leadingIcon={
              isDownloading ? (
                <LoaderCircle aria-hidden="true" className="spin" size={16} />
              ) : (
                <Download aria-hidden="true" size={16} />
              )
            }
            type="submit"
          >
            {isDownloading ? "Preparing export…" : "Download export"}
          </Button>
        </form>

        {error !== null ? (
          <div className="export-card__error">
            <ErrorPanel
              message={errorPresentation.message}
              requestId={errorPresentation.requestId}
              title="Export unavailable"
            />
          </div>
        ) : null}
        {notice ? (
          <p className="export-card__notice" role="status">
            {notice}
          </p>
        ) : null}
      </Card>
    </section>
  );
}
