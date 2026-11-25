import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api-client";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { TextField } from "../components/ui/TextField";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
import { useAuth } from "../features/auth/useAuth";
import { credentialsSchema } from "../features/auth/auth.schemas";

type AuthMode = "login" | "register";
type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

interface AuthPageProps {
  mode: AuthMode;
}

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";
  const { signIn, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setSubmitError(null);
    setRequestId(null);

    const parsedCredentials = credentialsSchema.safeParse({ email, password });
    if (!parsedCredentials.success) {
      const nextFieldErrors: FieldErrors = {};
      for (const issue of parsedCredentials.error.issues) {
        const field = issue.path[0];
        if (
          (field === "email" || field === "password") &&
          !nextFieldErrors[field]
        ) {
          nextFieldErrors[field] = getFieldError(field, issue.message);
        }
      }
      setFieldErrors(nextFieldErrors);
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register(parsedCredentials.data);
      } else {
        await signIn(parsedCredentials.data);
      }
      navigate(getSafeReturnPath(location.state), { replace: true });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
      if (error instanceof ApiError) setRequestId(error.requestId ?? null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFormError = () => {
    setSubmitError(null);
    setRequestId(null);
  };

  return (
    <main className="auth-page">
      <div className="auth-page__visual">
        <Link aria-label="Clarity home" className="brand brand--light" to="/">
          <span className="brand__mark">
            <Sparkles aria-hidden="true" size={18} strokeWidth={2} />
          </span>
          <span className="brand__wordmark">clarity</span>
          <span className="brand__period">.</span>
        </Link>
        <div className="auth-page__message">
          <p className="eyebrow">THOUGHTFUL ANALYSIS STARTS HERE</p>
          <h1>Make room for the work that matters.</h1>
          <p>
            Bring the pieces together. Keep the evidence in view. Move forward
            with confidence.
          </p>
          <ul>
            <li>
              <Check aria-hidden="true" size={15} />A shared home for project
              context
            </li>
            <li>
              <Check aria-hidden="true" size={15} />
              Clear links from evidence to outcome
            </li>
            <li>
              <Check aria-hidden="true" size={15} />
              AI suggestions remain human-reviewed drafts
            </li>
          </ul>
        </div>
        <span className="auth-page__orb auth-page__orb--one" />
        <span className="auth-page__orb auth-page__orb--two" />
      </div>

      <section aria-labelledby="auth-title" className="auth-page__content">
        <Link className="auth-page__back" to="/app">
          <ArrowLeft aria-hidden="true" size={15} />
          Back to workspace
        </Link>
        <div className="auth-page__card">
          <span className="auth-page__icon">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <p className="eyebrow">ACCOUNT ACCESS</p>
          <h2 id="auth-title">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="auth-page__intro">
            {isRegister
              ? "Create a secure account to begin organizing your analysis."
              : "Sign in to return to your analysis workspace."}
          </p>

          <form
            aria-busy={isSubmitting}
            className="auth-form"
            noValidate
            onSubmit={handleSubmit}
          >
            <TextField
              autoComplete="email"
              error={fieldErrors.email}
              label="Business email"
              name="email"
              onChange={(event) => {
                setEmail(event.target.value);
                clearFormError();
              }}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />

            <div className="auth-password-field">
              <TextField
                autoComplete={isRegister ? "new-password" : "current-password"}
                error={fieldErrors.password}
                hint={isRegister ? "Use 12–128 characters." : undefined}
                label="Password"
                maxLength={128}
                minLength={12}
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFormError();
                }}
                placeholder="Enter your password"
                required
                type={passwordVisible ? "text" : "password"}
                value={password}
              />
              <IconButton
                className="auth-password-field__toggle"
                label={passwordVisible ? "Hide password" : "Show password"}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff aria-hidden="true" size={17} />
                ) : (
                  <Eye aria-hidden="true" size={17} />
                )}
              </IconButton>
            </div>

            {isRegister ? (
              <TextField
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                label="Confirm password"
                maxLength={128}
                name="confirmPassword"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearFormError();
                }}
                placeholder="Enter your password again"
                required
                type={passwordVisible ? "text" : "password"}
                value={confirmPassword}
              />
            ) : null}

            {submitError ? (
              <div aria-live="polite" className="auth-form__error" role="alert">
                <p>{submitError}</p>
                {requestId ? (
                  <details>
                    <summary>Support details</summary>
                    <code>Request ID: {requestId}</code>
                  </details>
                ) : null}
              </div>
            ) : null}

            <Button
              className="auth-form__submit"
              disabled={isSubmitting}
              type="submit"
              trailingIcon={
                isSubmitting ? (
                  <LoaderCircle aria-hidden="true" className="spin" size={16} />
                ) : undefined
              }
            >
              {isSubmitting
                ? isRegister
                  ? "Creating account"
                  : "Signing in"
                : isRegister
                  ? "Create account"
                  : "Sign in"}
            </Button>
            {!isRegister ? (
              <Link className="auth-form__forgot" to="/forgot-password">
                Forgot password?
              </Link>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.assign("/api/v1/auth/google");
              }}
            >
              Continue with Google
            </Button>
          </form>

          <p className="auth-page__switch">
            {isRegister ? "Already have an account?" : "New to Clarity?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {isRegister ? (
            <p className="auth-page__role-note">
              New accounts require administrator review and role assignment
              before workspace access is available.
            </p>
          ) : null}
        </div>
        <p className="auth-page__footnote">
          Your short-lived sign-in stays in memory. Refreshing the page requires
          signing in again.
        </p>
      </section>
    </main>
  );
}

function getFieldError(field: "email" | "password", message: string) {
  if (field === "email") return "Enter a valid email address.";
  if (message.includes("12")) return "Password must be at least 12 characters.";
  return "Password must be no more than 128 characters.";
}

function getSafeReturnPath(state: unknown) {
  if (typeof state !== "object" || state === null || !("from" in state)) {
    return "/app";
  }
  const from = state.from;
  if (
    typeof from !== "object" ||
    from === null ||
    !("pathname" in from) ||
    typeof from.pathname !== "string"
  ) {
    return "/app";
  }
  const path = from.pathname;
  return path === "/app" || path.startsWith("/app/") ? path : "/app";
}
