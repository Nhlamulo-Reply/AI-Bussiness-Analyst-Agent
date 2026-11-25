import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { requestPasswordReset } from "../features/auth/auth-api";
import { ApiError } from "../lib/api-client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await requestPasswordReset(email);
      setMessage(
        "If an account exists for this email address, a password-reset link will be sent.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Password-reset request failed.",
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
          <h2>Forgot your password?</h2>
          <form onSubmit={handleSubmit}>
            <TextField
              autoComplete="email"
              label="Business email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
            {message ? <p role="status">{message}</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
          <p>
            Google-only users should continue <Link to="/login">signing in with Google</Link>.
          </p>
          <Link to="/login">Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
