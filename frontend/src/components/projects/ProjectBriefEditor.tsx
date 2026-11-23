import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorPanel } from "../ui/ErrorPanel";
import { TextAreaField } from "../ui/TextAreaField";
import { TextField } from "../ui/TextField";
import { useUpdateProject } from "../../features/projects/project-queries";
import {
  createProjectSchema,
  type Project,
} from "../../features/projects/project.schemas";
import { getApiErrorPresentation } from "../../lib/api-client";

interface ProjectBriefForm {
  name: string;
  description: string;
  businessObjective: string;
  inScope: string;
  outOfScope: string;
  stakeholders: string;
  constraints: string;
  desiredOutputs: string;
}

interface ProjectBriefEditorProps {
  project: Project;
  canEdit: boolean;
}

export function ProjectBriefEditor({
  project,
  canEdit,
}: ProjectBriefEditorProps) {
  const updateProject = useUpdateProject(project.id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(project));
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);

  if (!canEdit) return null;

  const setField = (field: keyof ProjectBriefForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(undefined);
    setSaved(false);
    updateProject.reset();
  };

  const cancel = () => {
    setForm(toForm(project));
    setFormError(undefined);
    updateProject.reset();
    setEditing(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = createProjectSchema.safeParse({
      name: form.name,
      description: form.description,
      businessObjective: form.businessObjective,
      inScope: form.inScope,
      outOfScope: form.outOfScope,
      stakeholders: parseLineList(form.stakeholders),
      constraints: parseLineList(form.constraints),
      desiredOutputs: parseLineList(form.desiredOutputs),
    });
    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Review the project brief.",
      );
      return;
    }

    updateProject.mutate(parsed.data, {
      onSuccess: () => {
        setEditing(false);
        setSaved(true);
      },
    });
  };

  if (!editing) {
    return (
      <>
        <Button
          leadingIcon={<Pencil aria-hidden="true" size={15} />}
          onClick={() => {
            setForm(toForm(project));
            setSaved(false);
            setEditing(true);
          }}
          type="button"
          variant="secondary"
        >
          Edit project brief
        </Button>
        {saved ? (
          <p className="admin-success" role="status">
            Project brief saved.
          </p>
        ) : null}
      </>
    );
  }

  const errorPresentation = updateProject.isError
    ? getApiErrorPresentation(
        updateProject.error,
        "The project brief could not be saved.",
      )
    : undefined;

  return (
    <Card as="section" className="project-brief-editor">
      <h3>Edit project brief</h3>
      <form
        aria-busy={updateProject.isPending}
        className="project-form"
        noValidate
        onSubmit={handleSubmit}
      >
        <TextField
          autoComplete="off"
          disabled={updateProject.isPending}
          label="Project name"
          maxLength={160}
          name="name"
          onChange={(event) => setField("name", event.target.value)}
          required
          value={form.name}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          label="Description"
          maxLength={4000}
          name="description"
          onChange={(event) => setField("description", event.target.value)}
          rows={3}
          value={form.description}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          label="Business objective"
          maxLength={4000}
          name="businessObjective"
          onChange={(event) =>
            setField("businessObjective", event.target.value)
          }
          rows={3}
          value={form.businessObjective}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          label="In scope"
          maxLength={4000}
          name="inScope"
          onChange={(event) => setField("inScope", event.target.value)}
          rows={3}
          value={form.inScope}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          label="Out of scope"
          maxLength={4000}
          name="outOfScope"
          onChange={(event) => setField("outOfScope", event.target.value)}
          rows={3}
          value={form.outOfScope}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          hint="One stakeholder or role per line, up to 50."
          label="Stakeholders"
          maxLength={10000}
          name="stakeholders"
          onChange={(event) => setField("stakeholders", event.target.value)}
          rows={3}
          value={form.stakeholders}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          hint="One constraint per line, up to 50."
          label="Constraints"
          maxLength={10000}
          name="constraints"
          onChange={(event) => setField("constraints", event.target.value)}
          rows={3}
          value={form.constraints}
        />
        <TextAreaField
          disabled={updateProject.isPending}
          hint="One expected output per line, up to 50."
          label="Desired outputs"
          maxLength={10000}
          name="desiredOutputs"
          onChange={(event) => setField("desiredOutputs", event.target.value)}
          rows={3}
          value={form.desiredOutputs}
        />
        {formError ? (
          <p className="field__description--error" role="alert">
            {formError}
          </p>
        ) : null}
        {errorPresentation ? (
          <ErrorPanel
            message={errorPresentation.message}
            requestId={errorPresentation.requestId}
            title="Project brief could not be saved"
          />
        ) : null}
        <div className="project-form__actions">
          <Button
            disabled={updateProject.isPending}
            leadingIcon={<X aria-hidden="true" size={15} />}
            onClick={cancel}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={updateProject.isPending}
            leadingIcon={<Save aria-hidden="true" size={15} />}
            type="submit"
          >
            {updateProject.isPending ? "Saving brief" : "Save brief"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function toForm(project: Project): ProjectBriefForm {
  return {
    name: project.name,
    description: project.description,
    businessObjective: project.businessObjective,
    inScope: project.inScope,
    outOfScope: project.outOfScope,
    stakeholders: project.stakeholders.join("\n"),
    constraints: project.constraints.join("\n"),
    desiredOutputs: project.desiredOutputs.join("\n"),
  };
}

function parseLineList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
