import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { confirmPasswordReset } from "../features/auth/auth-api";
import { ApiError } from "../lib/api-client";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(token, password, confirmPassword);
      setMessage("Password reset successfully.");
    } catch (resetError) {
      setError(
        resetError instanceof ApiError
          ? resetError.message
          : "Password reset failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-page__content">
        <div className="auth-page__card">
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h2>Choose a new password</h2>
          <form onSubmit={handleSubmit}>
            <TextField
              autoComplete="new-password"
              label="New password"
              minLength={12}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <TextField
              autoComplete="new-password"
              label="Confirm new password"
              minLength={12}
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
            {message ? <p role="status">{message}</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            <Button disabled={isSubmitting || !token} type="submit">
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          </form>
          <Link to="/login">Return to sign in</Link>
        </div>
      </section>
    </main>
  );
}
