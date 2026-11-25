import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useAuth } from "../features/auth/useAuth";

export function PendingAccessPage() {
  const { session, signOut } = useAuth();

  if (session?.user.roles.length) return <Navigate replace to="/app" />;

  return (
    <main className="auth-page">
      <section aria-labelledby="pending-access-title" className="auth-page__content">
        <div className="auth-page__card">
          <p className="eyebrow">ACCOUNT REVIEW</p>
          <h1 id="pending-access-title">Your account is awaiting review</h1>
          <p>
            Your account has been created. An administrator must review it and
            assign your role before you can use the workspace.
          </p>
          <p>
            Once your role is assigned, sign out and sign in again to activate
            your access.
          </p>
          <div className="session-recovery__actions">
            <Button onClick={signOut} type="button" variant="secondary">
              Sign out
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
