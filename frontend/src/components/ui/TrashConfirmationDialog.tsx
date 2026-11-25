import { LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ErrorPanel } from "./ErrorPanel";

interface TrashConfirmationDialogProps {
  open: boolean;
  itemLabel: string;
  isPending: boolean;
  error?: string;
  requestId?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TrashConfirmationDialog({
  open,
  itemLabel,
  isPending,
  error,
  requestId,
  onOpenChange,
  onConfirm,
}: TrashConfirmationDialogProps) {
  return (
    <Dialog
      description="This item will be hidden from normal work. It can be restored from the bin for 30 days."
      onOpenChange={onOpenChange}
      open={open}
      title="Move this item to the bin?"
    >
      <div className="trash-confirmation-dialog">
        <p>
          Move <strong>{itemLabel}</strong> to the bin?
        </p>
        {error ? (
          <ErrorPanel
            message={error}
            requestId={requestId}
            title="Couldn't move item to the bin"
          />
        ) : null}
        <div className="dialog__actions">
          <Button
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            leadingIcon={
              isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="spin"
                  size={15}
                />
              ) : (
                <Trash2 aria-hidden="true" size={15} />
              )
            }
            onClick={onConfirm}
            type="button"
            variant="danger"
          >
            {isPending ? "Moving to bin" : "Move to bin"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
