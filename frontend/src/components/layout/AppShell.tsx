import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleHelp,
  Files,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "../../features/auth/useAuth";
import { getRoleLabel } from "../../features/auth/role-label";
import { Badge } from "../ui/Badge";
import { Dialog } from "../ui/Dialog";
import { IconButton } from "../ui/IconButton";

const workspaceLinks = [
  { label: "Overview", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Projects", to: "/app/projects", icon: BriefcaseBusiness },
];

const projectLinks = [
  { label: "Overview", suffix: "", icon: LayoutDashboard, end: true },
  { label: "Documents", suffix: "/documents", icon: Files },
  { label: "Requirements", suffix: "/requirements", icon: Layers3 },
  { label: "AI workflows", suffix: "/workflows", icon: Workflow },
  { label: "Deliverables", suffix: "/artifacts", icon: Sparkles },
  { label: "Approvals", suffix: "/approvals", icon: ShieldCheck },
  { label: "Exports", suffix: "/exports", icon: ArrowUpRight },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { projectId } = useParams();
  const { session } = useAuth();
  const canReview = session?.user.roles.some((role) =>
    ["reviewer", "admin"].includes(role),
  );

  return (
    <nav aria-label="Main navigation" className="sidebar__navigation">
      <p className="sidebar__label">Workspace</p>
      {workspaceLinks.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          className={({ isActive }) =>
            `nav-link ${isActive ? "nav-link--active" : ""}`
          }
          end={end}
          key={to}
          onClick={onNavigate}
          to={to}
        >
          <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}

      {projectId ? (
        <>
          <p className="sidebar__label sidebar__label--project">
            Current project
          </p>
          {projectLinks
            .filter(({ label }) => label !== "Approvals" || canReview)
            .map(({ label, suffix, icon: Icon, end }) => (
              <NavLink
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link--active" : ""}`
                }
                end={end}
                key={label}
                onClick={onNavigate}
                to={`/app/projects/${projectId}${suffix}`}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </NavLink>
            ))}
        </>
      ) : null}
    </nav>
  );
}

function Brand() {
  return (
    <Link aria-label="Clarity home" className="brand" to="/app">
      <span className="brand__mark">
        <Sparkles aria-hidden="true" size={18} strokeWidth={2} />
      </span>
      <span className="brand__wordmark">clarity</span>
      <span className="brand__period">.</span>
    </Link>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const user = session?.user;
  const [menuState, setMenuState] = useState({
    open: false,
    locationKey: location.key,
  });
  const menuOpen = menuState.open && menuState.locationKey === location.key;
  const setMenuOpen = (open: boolean) => {
    setMenuState({ open, locationKey: location.key });
  };
  const pageTitle = getPageTitle(location.pathname);
  const roleLabel = user?.roles[0] ? getRoleLabel(user.roles[0]) : "Member";

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <Navigation />
        <div className="sidebar__bottom">
          <div className="sidebar__help">
            <span className="sidebar__help-icon">
              <CircleHelp aria-hidden="true" size={17} />
            </span>
            <span>
              <strong>Made for clear thinking</strong>
              <small>Analysis, with its sources in view.</small>
            </span>
          </div>
          <div className="profile-link">
            <Link
              aria-label="View profile"
              className="profile-link__details"
              to="/app/profile"
            >
              <span className="profile-link__avatar">
                <UserRound aria-hidden="true" size={17} />
              </span>
              <span className="profile-link__copy">
                <strong title={user?.email}>{user?.email}</strong>
                <small>{user?.roles.map(getRoleLabel).join(" · ")}</small>
              </span>
            </Link>
            <IconButton label="Sign out" onClick={handleSignOut}>
              <LogOut aria-hidden="true" size={17} />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <IconButton
            className="topbar__menu"
            label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" size={21} />
          </IconButton>
          <div className="topbar__breadcrumbs">
            <span>Workspace</span>
            <span aria-hidden="true" className="topbar__separator">
              /
            </span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar__right">
            <Badge tone="accent">{roleLabel}</Badge>
            <span aria-hidden="true" className="topbar__divider" />
            <span className="topbar__avatar" title={user?.email}>
              <UserRound aria-hidden="true" size={17} />
            </span>
          </div>
        </header>

        <main className="page-content" id="main-content">
          <Outlet />
          <footer className="app-footer">
            <span>Clarity workspace</span>
            <span>Thoughtful analysis. Traceable decisions.</span>
          </footer>
        </main>
      </div>

      <Dialog
        className="drawer-dialog"
        description="Navigate the Clarity workspace."
        onOpenChange={setMenuOpen}
        open={menuOpen}
        title="Navigation"
      >
        <div className="drawer-dialog__brand">
          <Brand />
          <IconButton
            label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X aria-hidden="true" size={19} />
          </IconButton>
        </div>
        <Navigation onNavigate={() => setMenuOpen(false)} />
        <div className="drawer-dialog__footer">
          <Link className="profile-link__details" to="/app/profile">
            <span className="profile-link__avatar">
              <UserRound aria-hidden="true" size={17} />
            </span>
            <span className="profile-link__copy">
              <strong title={user?.email}>{user?.email}</strong>
              <small>{user?.roles.map(getRoleLabel).join(" · ")}</small>
            </span>
          </Link>
          <IconButton label="Sign out" onClick={handleSignOut}>
            <LogOut aria-hidden="true" size={17} />
          </IconButton>
        </div>
      </Dialog>
    </div>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === "/app") return "Overview";
  if (pathname === "/app/projects") return "Projects";
  if (pathname.endsWith("/documents")) return "Documents";
  if (pathname.endsWith("/requirements")) return "Requirements";
  if (pathname.endsWith("/workflows")) return "AI workflows";
  if (pathname.endsWith("/artifacts")) return "Deliverables";
  if (pathname.endsWith("/approvals")) return "Approvals";
  if (pathname.endsWith("/exports")) return "Exports";
  if (pathname === "/app/profile") return "Profile";
  if (pathname.endsWith("/new")) return "Create project";
  if (/^\/app\/projects\/[^/]+$/.test(pathname)) return "Project overview";
  return "Workspace";
}
