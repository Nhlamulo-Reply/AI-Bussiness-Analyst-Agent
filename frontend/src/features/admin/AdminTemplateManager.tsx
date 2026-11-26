import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable, type DataTableColumn } from "../../components/ui/DataTable";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import {
  createTemplateSchema,
  templateTypeSchema,
  templateTypes,
  type AdminTemplate,
  type TemplateType,
} from "./admin.schemas";
import {
  createAdminTemplate,
  listAdminTemplates,
  updateAdminTemplate,
} from "./admin-api";
import { getApiErrorPresentation } from "../../lib/api-client";

interface TemplateDraft {
  type: TemplateType;
  name: string;
  description: string;
  instructions: string;
}

const emptyDraft: TemplateDraft = {
  type: "project_intake",
  name: "",
  description: "",
  instructions: "",
};

export function AdminTemplateManager({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const templatesQuery = useQuery({
    queryKey: ["admin", userId, "templates"],
    queryFn: ({ signal }) => listAdminTemplates(signal),
  });
  const saveMutation = useMutation({
    mutationFn: (input: TemplateDraft) => {
      if (!editingId) return createAdminTemplate(input);
      const { type: _type, ...patch } = input;
      return updateAdminTemplate(editingId, patch);
    },
    onSuccess: async () => {
      setDraft(emptyDraft);
      setEditingId(undefined);
      setFormError(undefined);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "templates"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["templates", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "audit"],
        }),
      ]);
    },
    retry: false,
  });
  const statusMutation = useMutation({
    mutationFn: ({
      templateId,
      status,
    }: {
      templateId: string;
      status: AdminTemplate["status"];
    }) => updateAdminTemplate(templateId, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "templates"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["templates", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "audit"],
        }),
      ]);
    },
    retry: false,
  });
  const templates = templatesQuery.data ?? [];
  const saveError = saveMutation.isError
    ? getApiErrorPresentation(
        saveMutation.error,
        "The template could not be saved.",
      )
    : undefined;
  const statusError = statusMutation.isError
    ? getApiErrorPresentation(
        statusMutation.error,
        "The template status could not be changed.",
      )
    : undefined;
  const templatesError = templatesQuery.isError
    ? getApiErrorPresentation(
        templatesQuery.error,
        "Templates are unavailable.",
      )
    : undefined;

  const columns: DataTableColumn<AdminTemplate>[] = [
    { key: "name", header: "Template", render: (template) => template.name },
    {
      key: "type",
      header: "Category",
      render: (template) => formatLabel(template.type),
    },
    {
      key: "status",
      header: "Status",
      render: (template) => formatLabel(template.status),
    },
    {
      key: "actions",
      header: "Actions",
      render: (template) => (
        <div className="admin-template-actions">
          <Button
            disabled={saveMutation.isPending || statusMutation.isPending}
            onClick={() => {
              setEditingId(template.id);
              setFormError(undefined);
              setDraft({
                type: template.type,
                name: template.name,
                description: template.description,
                instructions: template.instructions,
              });
              saveMutation.reset();
              statusMutation.reset();
            }}
            size="small"
            type="button"
            variant="secondary"
          >
            Edit
          </Button>
          <Button
            disabled={statusMutation.isPending}
            onClick={() =>
              statusMutation.mutate({
                templateId: template.id,
                status: template.status === "active" ? "inactive" : "active",
              })
            }
            size="small"
            type="button"
            variant="secondary"
          >
            {template.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = createTemplateSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError("Enter a name and instructions within the listed limits.");
      return;
    }
    setFormError(undefined);
    saveMutation.reset();
    saveMutation.mutate(parsed.data);
  };

  return (
    <section aria-labelledby="admin-templates-title" className="admin-section">
      <div className="admin-section__heading">
        <div>
          <h2 id="admin-templates-title">Workflow templates</h2>
          <p>
            Manage intake guidance and optional workflow instructions. Inactive
            templates remain stored and available in audit history.
          </p>
        </div>
        <Button
          disabled={templatesQuery.isFetching}
          onClick={() => void templatesQuery.refetch()}
          size="small"
          type="button"
          variant="secondary"
        >
          Refresh
        </Button>
      </div>

      {templatesQuery.isPending ? (
        <Card aria-busy="true" role="status">
          <LoadingSkeleton lines={3} />
        </Card>
      ) : null}
      {templatesError ? (
        <ErrorPanel
          message={templatesError.message}
          requestId={templatesError.requestId}
          title="Templates unavailable"
        />
      ) : null}
      {saveError ? (
        <ErrorPanel
          message={saveError.message}
          requestId={saveError.requestId}
          title="Template save unsuccessful"
        />
      ) : null}
      {statusError ? (
        <ErrorPanel
          message={statusError.message}
          requestId={statusError.requestId}
          title="Template update unsuccessful"
        />
      ) : null}
      {saveMutation.isSuccess ? (
        <p className="admin-success" role="status">
          Template saved.
        </p>
      ) : null}

      <Card className="admin-template-form-card">
        <form className="admin-template-form" onSubmit={submit}>
          <h3>{editingId ? "Edit template" : "Create template"}</h3>
          {formError ? (
            <p className="admin-inline-error" role="alert">
              {formError}
            </p>
          ) : null}
          <label>
            Category
            <select
              disabled={Boolean(editingId) || saveMutation.isPending}
              onChange={(event) => {
                const parsed = templateTypeSchema.safeParse(
                  event.currentTarget.value,
                );
                if (parsed.success) {
                  setDraft((current) => ({ ...current, type: parsed.data }));
                }
              }}
              value={draft.type}
            >
              {templateTypes.map((type) => (
                <option key={type} value={type}>
                  {formatLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input
              maxLength={120}
              onChange={(event) => {
                const name = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  name,
                }));
              }}
              required
              value={draft.name}
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={1000}
              onChange={(event) => {
                const description = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  description,
                }));
              }}
              rows={2}
              value={draft.description}
            />
          </label>
          <label>
            Instructions
            <textarea
              maxLength={10000}
              onChange={(event) => {
                const instructions = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  instructions,
                }));
              }}
              required
              rows={5}
              value={draft.instructions}
            />
          </label>
          <div className="admin-template-form__actions">
            <Button disabled={saveMutation.isPending} type="submit">
              {saveMutation.isPending
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Create template"}
            </Button>
            {editingId ? (
              <Button
                disabled={saveMutation.isPending}
                onClick={() => {
                  setEditingId(undefined);
                  setDraft(emptyDraft);
                  setFormError(undefined);
                  saveMutation.reset();
                }}
                type="button"
                variant="secondary"
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {templatesQuery.data ? (
        <DataTable
          caption="Administrator-managed workflow templates"
          columns={columns}
          emptyMessage="No templates have been created."
          rowKey={(template) => template.id}
          rows={templates}
        />
      ) : null}
    </section>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}
