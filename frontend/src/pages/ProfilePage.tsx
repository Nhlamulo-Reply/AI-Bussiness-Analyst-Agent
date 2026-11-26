import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getRoleLabel } from "../features/auth/role-label";
import { useAuth } from "../features/auth/useAuth";

export function ProfilePage() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const user = session?.user;

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <section aria-labelledby="profile-title" className="profile-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1 id="profile-title">Your profile</h1>
          <p className="page-heading__description">
            Review your signed-in identity and current workspace access.
          </p>
        </div>
      </header>

      <Card className="profile-card">
        <div className="profile-card__identity">
          <span className="profile-card__avatar">
            <UserRound aria-hidden="true" size={23} />
          </span>
          <div>
            <p className="eyebrow">SIGNED-IN ACCOUNT</p>
            <h2>{user?.email}</h2>
          </div>
        </div>
        <dl className="profile-details">
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Workspace roles</dt>
            <dd className="profile-details__roles">
              {user?.roles.map((role) => (
                <Badge key={role} tone="accent">
                  {getRoleLabel(role)}
                </Badge>
              ))}
            </dd>
          </div>
          <div>
            <dt>Session storage</dt>
            <dd className="profile-details__session">
              <ShieldCheck aria-hidden="true" size={15} />
              In memory only
            </dd>
          </div>
        </dl>
        <p className="profile-card__note">
          For your security, this short-lived session is not saved in browser
          storage. Refreshing or closing this page signs you out.
        </p>
        <div className="profile-card__actions">
          <Button
            leadingIcon={<LogOut aria-hidden="true" size={16} />}
            onClick={handleSignOut}
            variant="secondary"
          >
            Sign out
          </Button>
        </div>
      </Card>
    </section>
  );
}
