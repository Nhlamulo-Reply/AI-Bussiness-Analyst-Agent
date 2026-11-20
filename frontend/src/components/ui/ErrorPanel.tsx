import { useId } from "react";
import { AlertCircle } from "lucide-react";

interface ErrorPanelProps {
  title: string;
  message: string;
  requestId?: string;
}

export function ErrorPanel({ title, message, requestId }: ErrorPanelProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="error-panel" role="alert">
      <span className="error-panel__icon">
        <AlertCircle aria-hidden="true" size={20} />
      </span>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{message}</p>
        {requestId ? (
          <details className="error-panel__details">
            <summary>Support details</summary>
            <code>Request ID: {requestId}</code>
          </details>
        ) : null}
      </div>
    </section>
  );
}
