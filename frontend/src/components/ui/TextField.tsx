import { useId } from "react";
import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <input
        aria-describedby={hint || error ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        className={`field__control ${error ? "field__control--error" : ""} ${className}`.trim()}
        id={fieldId}
        {...props}
      />
      {error || hint ? (
        <p
          className={`field__description ${error ? "field__description--error" : ""}`}
          id={descriptionId}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
