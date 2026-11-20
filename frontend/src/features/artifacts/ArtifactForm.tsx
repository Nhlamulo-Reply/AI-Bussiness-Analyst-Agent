import { AlertCircle, LoaderCircle, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { TextAreaField } from "../../components/ui/TextAreaField";
import { TextField } from "../../components/ui/TextField";
import { z } from "zod";
import type { Requirement } from "../requirements/requirement.schemas";
import {
  artifactTypes,
  createArtifactSchema,
  type Artifact,
  type ArtifactType,
  type CreateArtifactInput,
} from "./artifact.schemas";

const typeLabels: Record<ArtifactType, string> = {
  epic: "Epic",
  story: "User story",
  acceptance_criteria: "Acceptance criteria",
  business_rule: "Business rule",
  risk: "Risk",
  dependency: "Dependency",
  implementation_plan: "Implementation plan",
};

interface ArtifactFormProps {
  mode: "create" | "edit";
  artifact?: Artifact;
  requirements: Requirement[];
  requirementsLoading: boolean;
  requirementsError?: string;
  onRetryRequirements: () => void;
  isSubmitting: boolean;
  submissionError?: string;
  onSubmit: (values: CreateArtifactInput) => void;
  onCancel: () => void;
}

interface ArtifactFormState {
  type: string;
  title: string;
  description: string;
  requirementIds: string[];
  dataText: string;
}

function getInitialState(artifact?: Artifact): ArtifactFormState {
  return {
    type: artifact?.type ?? "",
    title: artifact?.title ?? "",
    description: artifact?.description ?? "",
    requirementIds: artifact?.requirementIds ?? [],
    dataText: JSON.stringify(artifact?.data ?? {}, null, 2),
  };
}

export function ArtifactForm({
  mode,
  artifact,
  requirements,
  requirementsLoading,
  requirementsError,
  onRetryRequirements,
  isSubmitting,
  submissionError,
  onSubmit,
  onCancel,
}: ArtifactFormProps) {
  const [initialState] = useState(() => getInitialState(artifact));
  const [values, setValues] = useState<ArtifactFormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ArtifactFormState, string>>
  >({});

  const updateField = <Key extends keyof ArtifactFormState>(
    key: Key,
    value: ArtifactFormState[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const toggleRequirement = (requirementId: string, checked: boolean) => {
    const requirementIds = new Set(values.requirementIds);
    if (checked) requirementIds.add(requirementId);
    else requirementIds.delete(requirementId);
    updateField("requirementIds", [...requirementIds]);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let data: Record<string, unknown>;
    try {
      const parsedData: unknown = JSON.parse(values.dataText);
      if (
        typeof parsedData !== "object" ||
        parsedData === null ||
        Array.isArray(parsedData)
      ) {
        setFieldErrors({
          dataText: 'Enter a JSON object such as {"key": "value"}.',
        });
        return;
      }
      const parsedObject = z
        .record(z.string(), z.unknown())
        .safeParse(parsedData);
      if (!parsedObject.success) {
        setFieldErrors({
          dataText: "Enter a JSON object with string keys.",
        });
        return;
      }
      data = parsedObject.data;
    } catch {
      setFieldErrors({
        dataText: "Enter valid JSON before saving this artifact.",
      });
      return;
    }

    const parsed = createArtifactSchema.safeParse({
      type: values.type,
      title: values.title,
      description: values.description,
      requirementIds: values.requirementIds,
      data,
    });
    if (!parsed.success) {
      const nextErrors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          key === "type" ||
          key === "title" ||
          key === "description" ||
          key === "requirementIds" ||
          key === "data"
        ) {
          if (!nextErrors[key === "data" ? "dataText" : key]) {
            nextErrors[key === "data" ? "dataText" : key] = issue.message;
          }
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form
      aria-busy={isSubmitting}
      className="artifact-form"
      noValidate
      onSubmit={handleSubmit}
    >
      {mode === "create" ? (
        <label className="field">
          <span className="field__label">Artifact type</span>
          <select
            aria-invalid={Boolean(fieldErrors.type)}
            className="field__control"
            onChange={(event) => updateField("type", event.currentTarget.value)}
            required
            value={values.type}
          >
            <option value="">Choose an artifact type</option>
            {artifactTypes.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type]}
              </option>
            ))}
          </select>
          {fieldErrors.type ? (
            <span
              className="field__description field__description--error"
              role="alert"
            >
              {fieldErrors.type}
            </span>
          ) : null}
        </label>
      ) : (
        <div className="artifact-form__type">
          <span className="field__label">Artifact type</span>
          <Badge tone="accent">
            {artifact ? typeLabels[artifact.type] : "Artifact"}
          </Badge>
          <span>Type cannot be changed after creation.</span>
        </div>
      )}

      <TextField
        autoComplete="off"
        error={fieldErrors.title}
        label="Title"
        maxLength={240}
        onChange={(event) => updateField("title", event.currentTarget.value)}
        placeholder="Give this deliverable a clear title."
        required
        value={values.title}
      />

      <TextAreaField
        error={fieldErrors.description}
        hint="Add context that helps reviewers understand this deliverable."
        label="Description"
        maxLength={8000}
        onChange={(event) =>
          updateField("description", event.currentTarget.value)
        }
        placeholder="Describe the outcome or decision this artifact supports."
        rows={4}
        value={values.description}
      />

      <fieldset className="artifact-requirement-picker">
        <legend>
          Linked requirements
          <span>{values.requirementIds.length} selected</span>
        </legend>
        <p>
          Link the requirements this deliverable supports. Only requirements
          from this project can be selected.
        </p>
        {requirementsLoading ? (
          <div aria-label="Loading project requirements" role="status">
            <LoadingSkeleton lines={2} />
          </div>
        ) : requirementsError ? (
          <div className="artifact-requirement-picker__error" role="alert">
            <AlertCircle aria-hidden="true" size={16} />
            <span>{requirementsError}</span>
            <Button
              onClick={onRetryRequirements}
              size="small"
              type="button"
              variant="secondary"
            >
              Try again
            </Button>
          </div>
        ) : requirements.length > 0 ? (
          <div className="artifact-requirement-picker__list">
            {requirements.map((requirement) => (
              <label
                className="artifact-requirement-option"
                htmlFor={`artifact-requirement-${requirement.id}`}
                key={requirement.id}
              >
                <input
                  checked={values.requirementIds.includes(requirement.id)}
                  id={`artifact-requirement-${requirement.id}`}
                  onChange={(event) =>
                    toggleRequirement(
                      requirement.id,
                      event.currentTarget.checked,
                    )
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{requirement.title}</strong>
                  <small>{requirement.id}</small>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="artifact-requirement-picker__empty">
            No project requirements are available to link.
          </p>
        )}
        {fieldErrors.requirementIds ? (
          <span
            className="field__description field__description--error"
            role="alert"
          >
            {fieldErrors.requirementIds}
          </span>
        ) : null}
      </fieldset>

      <TextAreaField
        className="artifact-form__json"
        error={fieldErrors.dataText}
        hint="Preserve type-specific fields as JSON. Unknown keys are kept when editing."
        label="Structured data (JSON object)"
        onChange={(event) => updateField("dataText", event.currentTarget.value)}
        rows={8}
        spellCheck={false}
        value={values.dataText}
      />

      {submissionError ? (
        <div className="artifact-form__error" role="alert">
          {mode === "edit" &&
          submissionError.toLocaleLowerCase().includes("pending") ? (
            <p>
              An approval is pending for this artifact, so edits are blocked
              until the review is resolved. Your changes remain in the form.
            </p>
          ) : (
            <p>{submissionError}</p>
          )}
        </div>
      ) : null}

      <div className="artifact-form__actions">
        <Button
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          disabled={
            isSubmitting ||
            (mode === "edit" &&
              values.title === initialState.title &&
              values.description === initialState.description &&
              values.dataText === initialState.dataText &&
              values.requirementIds.length ===
                initialState.requirementIds.length &&
              values.requirementIds.every(
                (id, index) => id === initialState.requirementIds[index],
              ))
          }
          leadingIcon={
            isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="spin" size={15} />
            ) : (
              <Save aria-hidden="true" size={15} />
            )
          }
          type="submit"
        >
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create draft"
              : "Save revision"}
        </Button>
      </div>
    </form>
  );
}
