import { ArchiveRestore, RotateCw, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { TextAreaField } from "../components/ui/TextAreaField";
import { TextField } from "../components/ui/TextField";
import { hasPermission } from "../features/auth/permissions";
import { useAuth } from "../features/auth/useAuth";
import {
  usePermanentlyDeleteFromTrash,
  useRestoreFromTrash,
  useTrash,
} from "../features/trash/trash-queries";
import type { TrashItem } from "../features/trash/trash.schemas";
import { getApiErrorPresentation } from "../lib/api-client";
import { formatProjectDate } from "../features/projects/format";

const pageSize = 12;

const resourceLabels: Record<TrashItem["resourceType"], string> = {
  project: "Project",
  document: "Document",
  requirement: "Requirement",
  artifact: "Deliverable",
};

const trashDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TrashPage() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const query = useTrash(page, pageSize);
  const restoreMutation = useRestoreFromTrash();
  const purgeMutation = usePermanentlyDeleteFromTrash();
  const canPurge = hasPermission(
    session?.user.roles,
    "admin.trash.purge",
  );
  const result = query.data;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;
  const restoreError = restoreMutation.isError
    ? getApiErrorPresentation(
        restoreMutation.error,
        "The item couldn't be restored. Please try again.",
      )
    : undefined;
  const purgeError = purgeMutation.isError
    ? getApiErrorPresentation(
        purgeMutation.error,
        "The item couldn't be permanently deleted. Please try again.",
      )
    : undefined;

  const closePurgeDialog = (open: boolean) => {
    if (open) return;
    setPurgeTarget(null);
    setConfirmation("");
    setReason("");
    purgeMutation.reset();
  };

  return (
    <section aria-labelledby="bin-title" className="trash-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE RECOVERY</p>
          <h1 id="bin-title">Bin</h1>
          <p className="page-heading__description">
            Restore items moved here within 30 days. Approval history and audit
            records are retained.
          </p>
        </div>
      </header>

      {query.isPending ? (
        <Card aria-busy="true" className="trash-page__loading" role="status">
          <LoadingSkeleton lines={5} />
        </Card>
      ) : null}
      {query.isError && !result ? (
        <ErrorPanel
          message={getApiErrorPresentation(
            query.error,
            "Bin couldn't be loaded.",
          ).message}
          title="Bin is unavailable"
        />
      ) : null}
      {query.isError && result ? (
        <ErrorPanel
          message={getApiErrorPresentation(
            query.error,
            "Bin couldn't be refreshed.",
          ).message}
          title="Couldn't refresh Bin"
        />
      ) : null}

      {result && result.total === 0 ? (
        <Card className="trash-page__empty">
          <EmptyState
            description="Items you are authorized to remove will appear here. They remain recoverable for 30 days."
            icon={Trash2}
            title="Bin is empty"
          />
        </Card>
      ) : null}

      {result && result.items.length > 0 ? (
        <Card as="section" className="trash-list-card">
          <ul aria-label="Items in Bin" className="trash-list">
            {result.items.map((item) => (
              <li className="trash-list__item" key={`${item.resourceType}-${item.id}`}>
                <div className="trash-list__main">
                  <div className="trash-list__title">
                    <span>{resourceLabels[item.resourceType]}</span>
                    <h2>{item.label}</h2>
                  </div>
                  <p>{item.projectName}</p>
                  <small>
                    Moved {trashDateFormatter.format(new Date(item.trashedAt))}
                    {" · "}
                    {item.canPurge
                      ? "Eligible for permanent deletion"
                      : `Available until ${formatProjectDate(item.purgeAfter)}`}
                  </small>
                </div>
                <div className="trash-list__actions">
                  {item.canRestore ? (
                    <Button
                      disabled={restoreMutation.isPending}
                      leadingIcon={<ArchiveRestore aria-hidden="true" size={15} />}
                      onClick={() =>
                        restoreMutation.mutate({
                          resourceType: item.resourceType,
                          resourceId: item.id,
                        })
                      }
                      size="small"
                      type="button"
                      variant="secondary"
                    >
                      Restore
                    </Button>
                  ) : null}
                  {canPurge && item.canPurge ? (
                    <Button
                      leadingIcon={<Trash2 aria-hidden="true" size={15} />}
                      onClick={() => {
                        purgeMutation.reset();
                        setConfirmation("");
                        setReason("");
                        setPurgeTarget(item);
                      }}
                      size="small"
                      type="button"
                      variant="danger"
                    >
                      Delete permanently
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {restoreError ? (
            <ErrorPanel
              message={restoreError.message}
              requestId={restoreError.requestId}
              title="Restore failed"
            />
          ) : null}
        </Card>
      ) : null}

      {result && result.total > 0 ? (
        <nav aria-label="Bin pages" className="project-pagination">
          <span aria-live="polite">
            Page {result.page} of {totalPages} · {result.total} items
          </span>
          <div>
            <Button
              disabled={result.page <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="small"
              type="button"
              variant="secondary"
            >
              Previous
            </Button>
            <Button
              disabled={result.page >= totalPages || query.isFetching}
              onClick={() => setPage((current) => current + 1)}
              size="small"
              type="button"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}

      <Dialog
        description="This action cannot be undone. Audit records remain, and items with approval history or dependent records cannot be purged."
        onOpenChange={closePurgeDialog}
        open={Boolean(purgeTarget)}
        title="Permanently delete this item?"
      >
        {purgeTarget ? (
          <div className="trash-purge-dialog">
            <p className="trash-purge-dialog__warning">
              <ShieldAlert aria-hidden="true" size={18} />
              This permanently removes <strong>{purgeTarget.label}</strong> and
              cannot be undone.
            </p>
            <TextField
              autoComplete="off"
              label="Type the item name to confirm"
              onChange={(event) => setConfirmation(event.currentTarget.value)}
              value={confirmation}
            />
            <TextAreaField
              hint="This reason is recorded in the audit history."
              label="Reason for permanent deletion"
              maxLength={1000}
              onChange={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
            {purgeError ? (
              <ErrorPanel
                message={purgeError.message}
                requestId={purgeError.requestId}
                title="Permanent deletion failed"
              />
            ) : null}
            <div className="dialog__actions">
              <Button
                disabled={purgeMutation.isPending}
                onClick={() => closePurgeDialog(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={
                  purgeMutation.isPending ||
                  confirmation !== purgeTarget.label ||
                  reason.trim().length < 10
                }
                leadingIcon={
                  purgeMutation.isPending ? (
                    <RotateCw aria-hidden="true" className="spin" size={15} />
                  ) : (
                    <Trash2 aria-hidden="true" size={15} />
                  )
                }
                onClick={() =>
                  purgeMutation.mutate(
                    {
                      resourceType: purgeTarget.resourceType,
                      resourceId: purgeTarget.id,
                      confirmation,
                      reason,
                    },
                    {
                      onSuccess: () => closePurgeDialog(false),
                    },
                  )
                }
                type="button"
                variant="danger"
              >
                {purgeMutation.isPending
                  ? "Deleting permanently"
                  : "Delete permanently"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}
