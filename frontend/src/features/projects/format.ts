const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatProjectDate(timestamp: string) {
  return dateFormatter.format(new Date(timestamp));
}

export function getProjectPath(projectId: string) {
  return `/app/projects/${encodeURIComponent(projectId)}`;
}
