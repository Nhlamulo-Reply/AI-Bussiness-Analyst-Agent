import { LoaderCircle, Plus, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { TextAreaField } from "../../components/ui/TextAreaField";
import { TextField } from "../../components/ui/TextField";
import type { DocumentMetadata } from "../documents/document.schemas";
import type { Requirement } from "./requirement.schemas";
import {
  requirementFormSchema,
  type RequirementFormInput,
  type RequirementFormValues,
} from "./requirement-form.schemas";

interface RequirementFormProps {
  mode: "create" | "edit";
  requirement?: Requirement;
  documents: DocumentMetadata[];
  documentsLoading: boolean;
  documentsError?: {
    message: string;
    requestId?: string;
  };
  onRetryDocuments: () => void;
  isSubmitting: boolean;
  submissionError?: {
    message: string;
    requestId?: string;
  };
  onSubmit: (values: RequirementFormValues) => void;
  onCancel: () => void;
}

type RequirementFormState = Omit<RequirementFormInput, "type"> & {
  type: string;
};

const typeOptions = [
  { value: "", label: "Choose a type" },
  { value: "business", label: "Business" },
  { value: "functional", label: "Functional" },
  { value: "non_functional", label: "Non-functional" },
] as const;

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

function getInitialValues(requirement?: Requirement): RequirementFormState {
  return {
    title: requirement?.title ?? "",
    description: requirement?.description ?? "",
    type: requirement?.type ?? "",
    priority: requirement?.priority ?? "medium",
    sourceFacts: requirement?.sourceFacts.join("\n") ?? "",
    assumptions: requirement?.assumptions.join("\n") ?? "",
    openQuestions: requirement?.openQuestions.join("\n") ?? "",
    documentIds: requirement?.traceability.documentIds ?? [],
  };
}

export function RequirementForm({
  mode,
  requirement,
  documents,
  documentsLoading,
  documentsError,
  onRetryDocuments,
  isSubmitting,
  submissionError,
  onSubmit,
  onCancel,
}: RequirementFormProps) {
  const [initialValues] = useState(() => getInitialValues(requirement));
  const [values, setValues] = useState<RequirementFormState>(
    () => initialValues,
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RequirementFormState, string>>
  >({});

  const updateField = <Key extends keyof RequirementFormState>(
    key: Key,
    value: RequirementFormState[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = requirementFormSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          key === "title" ||
          key === "description" ||
          key === "type" ||
          key === "priority" ||
          key === "sourceFacts" ||
          key === "assumptions" ||
          key === "openQuestions" ||
          key === "documentIds"
        ) {
          if (!nextErrors[key]) {
            nextErrors[key] =
              key === "type" ? "Choose a requirement type." : issue.message;
          }
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    const submittedValues = { ...parsed.data };
    if (mode === "edit" && requirement) {
      if (values.sourceFacts === initialValues.sourceFacts) {
        submittedValues.sourceFacts = requirement.sourceFacts;
      }
      if (values.assumptions === initialValues.assumptions) {
        submittedValues.assumptions = requirement.assumptions;
      }
      if (values.openQuestions === initialValues.openQuestions) {
        submittedValues.openQuestions = requirement.openQuestions;
      }
    }
    onSubmit(submittedValues);
  };

  const toggleDocument = (documentId: string, checked: boolean) => {
    const documentIds = new Set(values.documentIds);
    if (checked) {
      documentIds.add(documentId);
    } else {
      documentIds.delete(documentId);
    }
    updateField("documentIds", [...documentIds]);
  };

  return (
    <form
      aria-busy={isSubmitting}
      className="requirement-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <TextField
        autoComplete="off"
        error={fieldErrors.title}
        label="Title"
        maxLength={240}
        name="title"
        onChange={(event) => updateField("title", event.currentTarget.value)}
        placeholder="What business need should this requirement address?"
        required
        value={values.title}
      />

      <TextAreaField
        error={fieldErrors.description}
        hint="Describe the need in clear, testable language."
        label="Description"
        maxLength={8000}
        name="description"
        onChange={(event) =>
          updateField("description", event.currentTarget.value)
        }
        placeholder="Add context and the intended outcome."
        rows={4}
        value={values.description}
      />

      <div className="requirement-form__selects">
        <label className="field">
          <span className="field__label">Type</span>
          <select
            aria-invalid={Boolean(fieldErrors.type)}
            className="field__control"
            onChange={(event) => updateField("type", event.currentTarget.value)}
            required
            value={values.type}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Priority</span>
          <select
            aria-invalid={Boolean(fieldErrors.priority)}
            className="field__control"
            onChange={(event) => {
              const option = priorityOptions.find(
                (item) => item.value === event.currentTarget.value,
              );
              if (option) updateField("priority", option.value);
            }}
            value={values.priority}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {fieldErrors.type || fieldErrors.priority ? (
        <p
          className="field__description field__description--error"
          role="alert"
        >
          {fieldErrors.type ?? fieldErrors.priority}
        </p>
      ) : null}

      <TextAreaField
        count={`${values.sourceFacts.split(/\r?\n/).filter(Boolean).length} / 100 facts`}
        error={fieldErrors.sourceFacts}
        hint="Add one source fact per line."
        label="Source facts"
        name="sourceFacts"
        onChange={(event) =>
          updateField("sourceFacts", event.currentTarget.value)
        }
        placeholder="A customer must be able to…"
        rows={3}
        value={values.sourceFacts}
      />

      <TextAreaField
        count={`${values.assumptions.split(/\r?\n/).filter(Boolean).length} / 100 assumptions`}
        error={fieldErrors.assumptions}
        hint="Record assumptions explicitly, one per line."
        label="Assumptions"
        name="assumptions"
        onChange={(event) =>
          updateField("assumptions", event.currentTarget.value)
        }
        placeholder="We assume that…"
        rows={3}
        value={values.assumptions}
      />

      <TextAreaField
        count={`${values.openQuestions.split(/\r?\n/).filter(Boolean).length} / 100 questions`}
        error={fieldErrors.openQuestions}
        hint="Keep unresolved questions visible for follow-up."
        label="Open questions"
        name="openQuestions"
        onChange={(event) =>
          updateField("openQuestions", event.currentTarget.value)
        }
        placeholder="Who will own…?"
        rows={3}
        value={values.openQuestions}
      />

      {mode === "create" ? (
        <fieldset className="requirement-document-picker">
          <legend>Source documents</legend>
          <p>
            Link uploaded documents that support this requirement. You can
            choose up to 100.
          </p>
          {documentsLoading ? (
            <div aria-label="Loading source documents" role="status">
              <LoadingSkeleton lines={2} />
            </div>
          ) : null}
          {documentsError ? (
            <div className="requirement-document-picker__error">
              <ErrorPanel
                message={documentsError.message}
                requestId={documentsError.requestId}
                title="Source documents unavailable"
              />
              <Button
                onClick={onRetryDocuments}
                size="small"
                type="button"
                variant="secondary"
              >
                Try again
              </Button>
            </div>
          ) : null}
          {!documentsLoading && !documentsError && documents.length === 0 ? (
            <p className="requirement-document-picker__empty">
              No uploaded documents yet. You can create this requirement without
              a source link.
            </p>
          ) : null}
          {documents.length > 0 ? (
            <ul className="requirement-document-picker__list">
              {documents.map((document) => (
                <li key={document.id}>
                  <label>
                    <input
                      checked={values.documentIds.includes(document.id)}
                      onChange={(event) =>
                        toggleDocument(document.id, event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    <span>
                      <strong>{document.fileName}</strong>
                      <small>{document.id}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          {fieldErrors.documentIds ? (
            <p className="field__description--error" role="alert">
              {fieldErrors.documentIds}
            </p>
          ) : null}
        </fieldset>
      ) : requirement?.traceability.documentIds.length ? (
        <section
          aria-labelledby="requirement-linked-documents-title"
          className="requirement-linked-documents"
        >
          <h3 id="requirement-linked-documents-title">
            Linked source documents
          </h3>
          <p>
            Document links cannot be changed through the current requirement
            edit API.
          </p>
          <ul>
            {requirement.traceability.documentIds.map((documentId) => {
              const document = documents.find((item) => item.id === documentId);
              return (
                <li key={documentId}>
                  <strong>{document?.fileName ?? "Source document"}</strong>
                  <small>{documentId}</small>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {mode === "edit" ? (
        <p className="requirement-form__status-note">
          Saving an edit creates a version snapshot and returns this requirement
          to draft. The previous version will remain in its history.
        </p>
      ) : null}

      {submissionError ? (
        <ErrorPanel
          message={submissionError.message}
          requestId={submissionError.requestId}
          title={
            mode === "create" ? "Requirement not created" : "Changes not saved"
          }
        />
      ) : null}

      <div className="requirement-form__actions">
        <Button
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          disabled={isSubmitting}
          leadingIcon={
            isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="spin" size={16} />
            ) : mode === "create" ? (
              <Plus aria-hidden="true" size={16} />
            ) : (
              <Save aria-hidden="true" size={16} />
            )
          }
          type="submit"
        >
          {isSubmitting
            ? mode === "create"
              ? "Creating requirement"
              : "Saving changes"
            : mode === "create"
              ? "Create requirement"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
