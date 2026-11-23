import { ArrowLeft, LoaderCircle, LockKeyhole, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import type { UserRole } from "../features/auth/auth.schemas";
import { hasPermission, type Permission } from "../features/auth/permissions";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorPanel } from "../components/ui/ErrorPanel";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const auth = useAuth();

  if (auth.isInitializing) return <LoadingSession />;
  if (auth.initializationError) {
    return (
      <SessionRecovery
        message={auth.initializationError}
        onRetry={auth.retrySessionValidation}
        onSignOut={auth.signOut}
      />
    );
  }
  if (!auth.isAuthenticated) {
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: { pathname: location.pathname } }}
      />
    );
  }
  return children;
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.isInitializing) return <LoadingSession />;
  if (auth.initializationError) {
    return (
      <SessionRecovery
        message={auth.initializationError}
        onRetry={auth.retrySessionValidation}
        onSignOut={auth.signOut}
      />
    );
  }
  if (auth.isAuthenticated) return <Navigate replace to="/app" />;
  return children;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { session } = useAuth();

  if (!session?.user.roles.some((role) => roles.includes(role))) {
    return (
      <section className="access-denied">
        <Card className="access-denied__card">
          <span className="access-denied__icon">
            <LockKeyhole aria-hidden="true" size={21} />
          </span>
          <p className="eyebrow">RESTRICTED WORKSPACE</p>
          <h1>You don't have access to this area.</h1>
          <p>
            This section is available to authorized Product Owners and
            administrators. Your account permissions are enforced by the backend
            as well.
          </p>
          <Link className="button button--secondary button--medium" to="/app">
            <ArrowLeft aria-hidden="true" size={16} />
            <span>Return to overview</span>
          </Link>
        </Card>
      </section>
    );
  }
  return children;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { session } = useAuth();

  if (!hasPermission(session?.user.roles, permission)) {
    return (
      <section className="access-denied">
        <Card className="access-denied__card">
          <span className="access-denied__icon">
            <LockKeyhole aria-hidden="true" size={21} />
          </span>
          <p className="eyebrow">RESTRICTED WORKSPACE</p>
          <h1>You don't have access to this area.</h1>
          <p>
            This section requires a role and project relationship authorized by
            the backend.
          </p>
          <Link className="button button--secondary button--medium" to="/app">
            <ArrowLeft aria-hidden="true" size={16} />
            <span>Return to overview</span>
          </Link>
        </Card>
      </section>
    );
  }
  return children;
}

function LoadingSession() {
  return (
    <main aria-live="polite" className="session-loading">
      <LoaderCircle aria-hidden="true" className="spin" size={25} />
      <p>Checking your secure session…</p>
    </main>
  );
}

function SessionRecovery({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => Promise<void>;
  onSignOut: () => void;
}) {
  return (
    <main className="session-recovery">
      <Card className="session-recovery__card">
        <p className="eyebrow">SESSION CHECK</p>
        <ErrorPanel message={message} title="We couldn't verify your session" />
        <div className="session-recovery__actions">
          <Button
            onClick={() => void onRetry()}
            leadingIcon={<RotateCw aria-hidden="true" size={15} />}
          >
            Try again
          </Button>
          <Button onClick={onSignOut} variant="secondary">
            Sign out
          </Button>
        </div>
      </Card>
    </main>
  );
}
