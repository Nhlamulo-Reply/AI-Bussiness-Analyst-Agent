import type { Storage } from "../../config/storage";

export type ExportFormat = "json" | "markdown" | "csv";

export async function renderProjectExport(
  storage: Storage,
  projectId: string,
  format: ExportFormat
): Promise<string | null> {
  const projectData = await storage.getProjectExport(projectId);
  if (!projectData) {
    return null;
  }

  if (format === "json") {
    return JSON.stringify(projectData, null, 2);
  }

  const rows = [
    ...projectData.requirements.map((requirement) => ({
      type: "requirement",
      id: requirement.id,
      title: requirement.title,
      status: requirement.status,
      updatedAt: requirement.updatedAt
    })),
    ...projectData.artifacts.map((artifact) => ({
      type: artifact.type,
      id: artifact.id,
      title: artifact.title,
      status: artifact.status,
      updatedAt: artifact.updatedAt
    }))
  ];

  if (format === "markdown") {
    const tableRows = rows.map((row) =>
      `| ${escapeMarkdown(row.type)} | ${escapeMarkdown(row.title)} | ${row.status} | ${row.id} |`
    );
    return [
      `# ${escapeMarkdown(projectData.project.name)}`,
      "",
      projectData.project.description,
      "",
      "| Type | Title | Status | ID |",
      "|---|---|---|---|",
      ...tableRows,
      ""
    ].join("\n");
  }

  const csvRows = [
    ["type", "id", "title", "status", "updatedAt"],
    ...rows.map((row) => [row.type, row.id, row.title, row.status, row.updatedAt])
  ];
  return csvRows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/[|\\]/g, "\\$&").replace(/\r?\n/g, " ");
}

function escapeCsv(value: string): string {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}
