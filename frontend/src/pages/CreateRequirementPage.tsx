import { ArrowLeft, ListChecks, LoaderCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { RequirementForm } from "../features/requirements/RequirementForm";
import { useProjectDocuments } from "../features/documents/document-queries";
import {
  requirementPageSize,
  useCreateRequirement,
  useRequirements,
} from "../features/requirements/requirement-queries";
import type { RequirementFormValues } from "../features/requirements/requirement-form.schemas";
import { getApiErrorPresentation } from "../lib/api-client";

export function CreateRequirementRoute() {
  const { projectId = "" } = useParams();
  return <CreateRequirementPage key={projectId} />;
}

export function CreateRequirementPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const requirementsQuery = useRequirements(projectId, 1);
  const documentsQuery = useProjectDocuments(projectId);
  const createMutation = useCreateRequirement(projectId);
  const submissionError = createMutation.isError
    ? getApiErrorPresentation(
        createMutation.error,
        "The requirement couldn't be created. Please try again.",
      )
    : undefined;
  const registerError = requirementsQuery.isError
    ? getApiErrorPresentation(
        requirementsQuery.error,
        "The register couldn't be checked before creation.",
      )
    : undefined;

  const handleSubmit = (values: RequirementFormValues) => {
    const totalBeforeCreate = requirementsQuery.data?.total ?? 0;
    const pageSize = requirementsQuery.data?.limit ?? requirementPageSize;

    createMutation.mutate(values, {
      onSuccess: (requirement) => {
        const page = Math.max(1, Math.ceil((totalBeforeCreate + 1) / pageSize));
        navigate(
          `/app/projects/${encodeURIComponent(projectId)}/requirements`,
          {
            state: { page, createdRequirementId: requirement.id },
          },
        );
      },
    });
  };

  return (
    <section
      aria-labelledby="create-requirement-title"
      className="requirement-create"
    >
      <Link
        className="project-back-link"
        to={`/app/projects/${encodeURIComponent(projectId)}/requirements`}
      >
        <ArrowLeft aria-hidden="true" size={15} />
        Requirements register
      </Link>

      <header className="requirement-page-heading">
        <span className="requirement-page-heading__icon">
          <ListChecks aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="eyebrow">PROJECT WORKSPACE</p>
          <h1 id="create-requirement-title">Capture a requirement</h1>
          <p>
            Record a clear need, the evidence behind it, and what still needs
            clarification.
          </p>
        </div>
      </header>

      {requirementsQuery.isPending && !requirementsQuery.data ? (
        <div
          aria-label="Preparing requirement register"
          className="requirement-create__preparing"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="spin" size={17} />
          <span>Preparing the requirement register…</span>
        </div>
      ) : null}
      {requirementsQuery.isError && !requirementsQuery.data ? (
        <div className="requirement-create__preparing requirement-create__preparing--error">
          <ErrorPanel
            message={registerError?.message ?? "The register is unavailable."}
            requestId={registerError?.requestId}
            title="Register unavailable"
          />
          <Button
            disabled={requirementsQuery.isFetching}
            onClick={() => void requirementsQuery.refetch()}
            variant="secondary"
          >
            Try again
          </Button>
        </div>
      ) : null}

      {requirementsQuery.data ? (
        <Card className="requirement-form-card">
          <div className="requirement-form-card__heading">
            <div>
              <h2>Requirement details</h2>
              <p>
                New requirements begin as a draft. You can revise them and
                review every saved version later.
              </p>
            </div>
            <span className="requirement-form-card__step">NEW · DRAFT</span>
          </div>
          <RequirementForm
            documents={documentsQuery.data ?? []}
            documentsError={
              documentsQuery.isError
                ? getApiErrorPresentation(
                    documentsQuery.error,
                    "Uploaded source documents couldn't be loaded.",
                  )
                : undefined
            }
            documentsLoading={documentsQuery.isPending}
            isSubmitting={createMutation.isPending}
            onCancel={() =>
              navigate(
                `/app/projects/${encodeURIComponent(projectId)}/requirements`,
              )
            }
            onRetryDocuments={() => void documentsQuery.refetch()}
            onSubmit={handleSubmit}
            submissionError={submissionError}
            mode="create"
          />
        </Card>
      ) : null}

      {requirementsQuery.isError && requirementsQuery.data ? (
        <div className="requirement-create__stale-error">
          <ErrorPanel
            message={
              registerError?.message ?? "The register couldn't be refreshed."
            }
            requestId={registerError?.requestId}
            title="Register refresh failed"
          />
        </div>
      ) : null}
    </section>
  );
}
