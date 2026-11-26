import { z } from "zod";
import { apiDownload } from "../../lib/api-client";

export const projectExportFormats = ["json", "markdown", "csv"] as const;
export const projectExportFormatSchema = z.enum(projectExportFormats);
export type ProjectExportFormat = z.infer<typeof projectExportFormatSchema>;

export interface ProjectExportFile {
  blob: Blob;
  filename: string;
}

export function downloadProjectExport(
  projectId: string,
  format: ProjectExportFormat,
  signal?: AbortSignal,
): Promise<ProjectExportFile> {
  const search = new URLSearchParams({ format });
  return apiDownload(
    `/projects/${encodeURIComponent(projectId)}/export?${search}`,
    {
      auth: "required",
      fallbackFilename: `project-export.${format}`,
      signal,
    },
  );
}
