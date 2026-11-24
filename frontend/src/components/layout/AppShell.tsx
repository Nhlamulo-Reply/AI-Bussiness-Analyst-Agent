import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleHelp,
  Files,
  Layers3,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Menu,
  Moon,
  ShieldCheck,
  Settings,
  Sparkles,
  Sun,
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
import {
  hasAnyPermission,
  hasPermission,
} from "../../features/auth/permissions";
import type { Permission } from "../../features/auth/permissions";
import {
  getInitialTheme,
  setThemePreference,
  type Theme,
} from "../../features/theme/theme";

const workspaceLinks: Array<{
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  permission: Permission | readonly Permission[];
}> = [
  {
    label: "Overview",
    to: "/app",
    icon: LayoutDashboard,
    end: true,
    permission: "project.read",
  },
  {
    label: "Projects",
    to: "/app/projects",
    icon: BriefcaseBusiness,
    permission: "project.read",
  },
];

const projectLinks: Array<{
  label: string;
  suffix: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  permission: Permission | readonly Permission[];
}> = [
  {
    label: "Overview",
    suffix: "",
    icon: LayoutDashboard,
    end: true,
    permission: "project.read",
  },
  {
    label: "Documents",
    suffix: "/documents",
    icon: Files,
    permission: "project.business.read",
  },
  {
    label: "Requirements",
    suffix: "/requirements",
    icon: Layers3,
    permission: "project.business.read",
  },
  {
    label: "AI workflows",
    suffix: "/workflows",
    icon: Workflow,
    permission: "analysis.prepare",
  },
  {
    label: "Deliverables",
    suffix: "/artifacts",
    icon: Sparkles,
    permission: ["project.business.read", "project.delivery.read"],
  },
  {
    label: "Approvals",
    suffix: "/approvals",
    icon: ShieldCheck,
    permission: "approval.decide_business",
  },
  {
    label: "Delivery reviews",
    suffix: "/delivery-reviews",
    icon: MessageSquareText,
    permission: "delivery.review",
  },
  {
    label: "Exports",
    suffix: "/exports",
    icon: ArrowUpRight,
    permission: "project.export",
  },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { projectId } = useParams();
  const { session } = useAuth();
  const isAdmin = hasPermission(session?.user.roles, "admin.users");

  return (
    <nav aria-label="Main navigation" className="sidebar__navigation">
      <p className="sidebar__label">Workspace</p>
      {workspaceLinks
        .filter(({ permission }) =>
          typeof permission === "string"
            ? hasPermission(session?.user.roles, permission)
            : hasAnyPermission(session?.user.roles, permission),
        )
        .map(({ label, to, icon: Icon, end }) => (
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
      {isAdmin ? (
        <NavLink
          className={({ isActive }) =>
            `nav-link ${isActive ? "nav-link--active" : ""}`
          }
          onClick={onNavigate}
          to="/app/admin"
        >
          <Settings aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>Administration</span>
        </NavLink>
      ) : null}

      {projectId && hasPermission(session?.user.roles, "project.read") ? (
        <>
          <p className="sidebar__label sidebar__label--project">
            Current project
          </p>
          {projectLinks
            .filter(({ permission }) =>
              typeof permission === "string"
                ? hasPermission(session?.user.roles, permission)
                : hasAnyPermission(session?.user.roles, permission),
            )
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
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [menuState, setMenuState] = useState({
    open: false,
    locationKey: location.key,
  });
  const menuOpen = menuState.open && menuState.locationKey === location.key;
  const setMenuOpen = (open: boolean) => {
    setMenuState({ open, locationKey: location.key });
  };
  const pageTitle = getPageTitle(location.pathname);
  const roleLabel = hasPermission(user?.roles, "admin.users")
    ? getRoleLabel("admin")
    : user?.roles[0]
      ? getRoleLabel(user.roles[0])
      : "Member";
  const profileRoles = hasPermission(user?.roles, "admin.users")
    ? [getRoleLabel("admin")]
    : (user?.roles.map(getRoleLabel) ?? []);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const handleThemeToggle = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    setThemePreference(nextTheme);
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
            <Link className="profile-link__details" to="/app/profile">
              <span className="profile-link__avatar">
                <UserRound aria-hidden="true" size={17} />
              </span>
              <span className="profile-link__copy">
                <strong title={user?.email}>{user?.email}</strong>
                <small>{profileRoles.join(" · ")}</small>
              </span>
              <span className="visually-hidden">View profile</span>
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
            <IconButton
              aria-pressed={theme === "dark"}
              className="topbar__theme-toggle"
              label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              onClick={handleThemeToggle}
            >
              {theme === "light" ? (
                <Moon aria-hidden="true" size={17} />
              ) : (
                <Sun aria-hidden="true" size={17} />
              )}
            </IconButton>
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
              <small>{profileRoles.join(" · ")}</small>
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
  if (pathname.endsWith("/delivery-reviews")) return "Delivery reviews";
  if (pathname.endsWith("/exports")) return "Exports";
  if (pathname === "/app/profile") return "Profile";
  if (pathname === "/app/admin") return "Administration";
  if (pathname.endsWith("/new")) return "Create project";
  if (/^\/app\/projects\/[^/]+$/.test(pathname)) return "Project overview";
  return "Workspace";
}
