import { ArrowLeft, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { TextAreaField } from "../components/ui/TextAreaField";
import { TextField } from "../components/ui/TextField";
import { useCreateProject } from "../features/projects/project-queries";
import { createProjectSchema } from "../features/projects/project.schemas";
import { getProjectPath } from "../features/projects/format";
import { getApiErrorPresentation } from "../lib/api-client";
import { useAvailableTemplates } from "../features/admin/admin-queries";

type FieldErrors = {
  name?: string;
  description?: string;
  businessObjective?: string;
  inScope?: string;
  outOfScope?: string;
  stakeholders?: string;
  constraints?: string;
  desiredOutputs?: string;
};

export function CreateProjectPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const intakeTemplatesQuery = useAvailableTemplates("project_intake");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessObjective, setBusinessObjective] = useState("");
  const [inScope, setInScope] = useState("");
  const [outOfScope, setOutOfScope] = useState("");
  const [stakeholders, setStakeholders] = useState("");
  const [constraints, setConstraints] = useState("");
  const [desiredOutputs, setDesiredOutputs] = useState("");
  const [intakeTemplateId, setIntakeTemplateId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const selectedIntakeTemplate = intakeTemplatesQuery.data?.find(
    (template) => template.id === intakeTemplateId,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = createProjectSchema.safeParse({
      name,
      description,
      businessObjective,
      inScope,
      outOfScope,
      stakeholders: parseLineList(stakeholders),
      constraints: parseLineList(constraints),
      desiredOutputs: parseLineList(desiredOutputs),
      ...(intakeTemplateId ? { intakeTemplateId } : {}),
    });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (isFieldErrorKey(field)) {
          const errorField = field;
          if (!nextErrors[errorField]) {
            nextErrors[errorField] = getFieldError(errorField, issue.message);
          }
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    createProject.mutate(parsed.data, {
      onSuccess: (project) => {
        navigate(getProjectPath(project.id), { replace: true });
      },
    });
  };

  const errorPresentation = createProject.error
    ? getApiErrorPresentation(
        createProject.error,
        "Your project couldn't be created. Please try again.",
      )
    : null;

  return (
    <section
      aria-labelledby="create-project-title"
      className="create-project-page"
    >
      <Link className="project-back-link" to="/app/projects">
        <ArrowLeft aria-hidden="true" size={15} />
        All projects
      </Link>

      <div className="create-project-layout">
        <div className="create-project-intro">
          <span className="create-project-intro__icon">
            <Sparkles aria-hidden="true" size={20} />
          </span>
          <p className="eyebrow">A THOUGHTFUL PLACE TO BEGIN</p>
          <h1 id="create-project-title">Create a project</h1>
          <p>
            Give your team a shared home for context, source documents, and
            decisions that need to stay connected.
          </p>
          <ul>
            <li>Start with a clear name and purpose.</li>
            <li>Add source material when you're ready.</li>
            <li>Keep evidence close as your work takes shape.</li>
          </ul>
        </div>

        <Card className="create-project-card">
          <div className="create-project-card__heading">
            <p className="eyebrow">PROJECT DETAILS</p>
            <h2>Tell us what you're working on.</h2>
            <p>These details can be shared with project members.</p>
          </div>

          <form
            aria-busy={createProject.isPending}
            className="project-form"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextField
              autoComplete="off"
              error={fieldErrors.name}
              hint="Use a name your team will recognize."
              label="Project name"
              maxLength={160}
              name="name"
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
                createProject.reset();
              }}
              placeholder="e.g. Customer onboarding refresh"
              required
              value={name}
            />
            {intakeTemplatesQuery.data?.length ? (
              <div className="project-template-field">
                <label htmlFor="intake-template">
                  <span>Project intake template</span>
                  <select
                    id="intake-template"
                    onChange={(event) =>
                      setIntakeTemplateId(event.currentTarget.value)
                    }
                    value={intakeTemplateId}
                  >
                    <option value="">No template</option>
                    {intakeTemplatesQuery.data.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedIntakeTemplate ? (
                  <>
                    <small>{selectedIntakeTemplate.description}</small>
                    <details className="project-template-guidance">
                      <summary>View intake guidance</summary>
                      <p>{selectedIntakeTemplate.instructions}</p>
                    </details>
                  </>
                ) : (
                  <small>
                    Choose administrator guidance for gathering project context.
                  </small>
                )}
              </div>
            ) : null}
            <TextAreaField
              count={`${description.length.toLocaleString()} / 4,000`}
              error={fieldErrors.description}
              hint="A short overview helps keep the project context clear."
              label="Description"
              maxLength={4000}
              name="description"
              onChange={(event) => {
                setDescription(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  description: undefined,
                }));
                createProject.reset();
              }}
              placeholder="What are you trying to understand or improve?"
              rows={5}
              value={description}
            />
            <TextAreaField
              count={`${businessObjective.length.toLocaleString()} / 4,000`}
              error={fieldErrors.businessObjective}
              hint="Describe the business problem or outcome the project should address."
              label="Business objective"
              maxLength={4000}
              name="businessObjective"
              onChange={(event) => {
                setBusinessObjective(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  businessObjective: undefined,
                }));
                createProject.reset();
              }}
              placeholder="What outcome should this work achieve?"
              rows={3}
              value={businessObjective}
            />
            <TextAreaField
              count={`${inScope.length.toLocaleString()} / 4,000`}
              error={fieldErrors.inScope}
              hint="List the processes, teams, or capabilities included."
              label="In scope"
              maxLength={4000}
              name="inScope"
              onChange={(event) => {
                setInScope(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  inScope: undefined,
                }));
                createProject.reset();
              }}
              placeholder="What is included in this project?"
              rows={3}
              value={inScope}
            />
            <TextAreaField
              count={`${outOfScope.length.toLocaleString()} / 4,000`}
              error={fieldErrors.outOfScope}
              hint="Call out related work that is intentionally excluded."
              label="Out of scope"
              maxLength={4000}
              name="outOfScope"
              onChange={(event) => {
                setOutOfScope(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  outOfScope: undefined,
                }));
                createProject.reset();
              }}
              placeholder="What will this project not address?"
              rows={3}
              value={outOfScope}
            />
            <TextAreaField
              error={fieldErrors.stakeholders}
              hint="Enter one stakeholder or role per line (up to 50)."
              label="Stakeholders"
              maxLength={10000}
              name="stakeholders"
              onChange={(event) => {
                setStakeholders(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  stakeholders: undefined,
                }));
                createProject.reset();
              }}
              placeholder={"e.g. Operations manager\nCustomer support team"}
              rows={3}
              value={stakeholders}
            />
            <TextAreaField
              error={fieldErrors.constraints}
              hint="Enter one known constraint per line (up to 50)."
              label="Constraints"
              maxLength={10000}
              name="constraints"
              onChange={(event) => {
                setConstraints(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  constraints: undefined,
                }));
                createProject.reset();
              }}
              placeholder={
                "e.g. Must launch by Q4\nNo changes to the billing provider"
              }
              rows={3}
              value={constraints}
            />
            <TextAreaField
              error={fieldErrors.desiredOutputs}
              hint="Enter one expected deliverable per line (up to 50)."
              label="Desired outputs"
              maxLength={10000}
              name="desiredOutputs"
              onChange={(event) => {
                setDesiredOutputs(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  desiredOutputs: undefined,
                }));
                createProject.reset();
              }}
              placeholder={
                "e.g. Prioritized requirements\nImplementation roadmap"
              }
              rows={3}
              value={desiredOutputs}
            />

            {errorPresentation ? (
              <ErrorPanel
                message={errorPresentation.message}
                requestId={errorPresentation.requestId}
                title="Project couldn't be created"
              />
            ) : null}

            <div className="project-form__actions">
              <Link
                className="button button--secondary button--medium"
                to="/app/projects"
              >
                Cancel
              </Link>
              <Button
                disabled={createProject.isPending}
                leadingIcon={
                  createProject.isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="spin"
                      size={16}
                    />
                  ) : (
                    <Plus aria-hidden="true" size={16} />
                  )
                }
                type="submit"
              >
                {createProject.isPending
                  ? "Creating project"
                  : "Create project"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </section>
  );
}

function parseLineList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isFieldErrorKey(field: PropertyKey): field is keyof FieldErrors {
  return (
    typeof field === "string" &&
    [
      "name",
      "description",
      "businessObjective",
      "inScope",
      "outOfScope",
      "stakeholders",
      "constraints",
      "desiredOutputs",
    ].includes(field)
  );
}

function getFieldError(field: keyof FieldErrors, message: string) {
  if (field === "name") {
    return message.includes("160")
      ? "Project names must be 160 characters or fewer."
      : "Enter a project name.";
  }
  if (
    field === "description" ||
    field === "businessObjective" ||
    field === "inScope" ||
    field === "outOfScope"
  ) {
    return message.includes("4000")
      ? "This field must be 4,000 characters or fewer."
      : "Review this field.";
  }
  if (message.includes("50")) {
    return "Enter no more than 50 items, one per line.";
  }
  return "Each line must contain 1 to 200 characters.";
}
