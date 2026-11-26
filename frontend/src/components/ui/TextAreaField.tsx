import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  count?: string;
}

export function TextAreaField({
  label,
  hint,
  error,
  count,
  id,
  className = "",
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        aria-describedby={hint || error || count ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        className={`field__control field__control--textarea ${error ? "field__control--error" : ""} ${className}`.trim()}
        id={fieldId}
        {...props}
      />
      {error || hint || count ? (
        <div className="field__meta" id={descriptionId}>
          <span
            className={`field__description ${error ? "field__description--error" : ""}`}
          >
            {error ?? hint}
          </span>
          {count ? <span className="field__count">{count}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
