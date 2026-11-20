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

type FieldErrors = {
  name?: string;
  description?: string;
};

export function CreateProjectPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = createProjectSchema.safeParse({ name, description });
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          (field === "name" || field === "description") &&
          !nextErrors[field]
        ) {
          nextErrors[field] = getFieldError(field, issue.message);
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

function getFieldError(field: "name" | "description", message: string) {
  if (field === "name") {
    return message.includes("160")
      ? "Project names must be 160 characters or fewer."
      : "Enter a project name.";
  }
  return message.includes("4000")
    ? "Descriptions must be 4,000 characters or fewer."
    : "Review the project description.";
}
