import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { setSession } from "../lib/auth-store";
import { apiRequest } from "../lib/api-client";
import { currentUserResponseSchema } from "../features/auth/auth.schemas";

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    if (!accessToken) {
      setError("Google sign-in was cancelled or could not be completed.");
      return;
    }
    void apiRequest("/auth/me", {
      auth: "required",
      accessToken,
      schema: currentUserResponseSchema,
    })
      .then((response) => {
        setSession({ accessToken, user: response.user });
        window.location.replace("/app");
      })
      .catch(() => {
        setError("Google sign-in could not establish a valid session.");
      });
  }, [searchParams]);

  return (
    <main className="auth-page">
      <section className="auth-page__content">
        <div className="auth-page__card">
          <p className="eyebrow">GOOGLE SIGN-IN</p>
          {error ? (
            <>
              <h2>Sign-in unavailable</h2>
              <p role="alert">{error}</p>
              <Link to="/login">Return to sign in</Link>
            </>
          ) : (
            <>
              <h2>Completing sign-in</h2>
              <p aria-live="polite">Validating your secure session...</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
