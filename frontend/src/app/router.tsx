import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth, RequireGuest, RequirePermission } from "./AuthGuards";
import { AppShell } from "../components/layout/AppShell";
import {
  ApprovalWorkspacePage,
  AdminPage,
  ArtifactWorkspaceRoute,
  AuthPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  GoogleCallbackPage,
  PendingAccessPage,
  LandingPage,
  CreateProjectPage,
  DeliveryReviewWorkspacePage,
  CreateRequirementRoute,
  NotFoundPage,
  OverviewPage,
  ProfilePage,
  ProjectDocumentLibraryRoute,
  ProjectExportRoute,
  ProjectListPage,
  ProjectOverviewPage,
  RequirementListRoute,
  SuspendedPage,
  TrashPage,
  WorkflowWorkbenchRoute,
} from "./lazy-pages";
import { hasPermission } from "../features/auth/permissions";
import { useAuth } from "../features/auth/useAuth";

const page = (element: ReactNode) => <SuspendedPage>{element}</SuspendedPage>;

function AppIndexRoute() {
  const { session } = useAuth();
  if (!hasPermission(session?.user.roles, "project.read")) {
    return <Navigate to="/app/admin" replace />;
  }
  return page(<OverviewPage />);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: page(<LandingPage />),
  },
  {
    path: "/login",
    element: <RequireGuest>{page(<AuthPage mode="login" />)}</RequireGuest>,
  },
  {
    path: "/register",
    element: <RequireGuest>{page(<AuthPage mode="register" />)}</RequireGuest>,
  },
  {
    path: "/forgot-password",
    element: <RequireGuest>{page(<ForgotPasswordPage />)}</RequireGuest>,
  },
  {
    path: "/reset-password",
    element: <RequireGuest>{page(<ResetPasswordPage />)}</RequireGuest>,
  },
  {
    path: "/auth/google/callback",
    element: <RequireGuest>{page(<GoogleCallbackPage />)}</RequireGuest>,
  },
  {
    path: "/pending-access",
    element: (
      <RequireAuth allowUnassignedRoles>
        {page(<PendingAccessPage />)}
      </RequireAuth>
    ),
  },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <AppIndexRoute /> },
      {
        path: "projects",
        element: (
          <RequirePermission permission="project.read">
            {page(<ProjectListPage />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/new",
        element: (
          <RequirePermission permission="project.create">
            {page(<CreateProjectPage />)}
          </RequirePermission>
        ),
      },
      {
        path: "trash",
        element: (
          <RequirePermission permission={["project.read", "admin.trash"]}>
            {page(<TrashPage />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId",
        element: (
          <RequirePermission permission="project.read">
            {page(<ProjectOverviewPage />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/documents",
        element: (
          <RequirePermission permission="project.business.read">
            {page(<ProjectDocumentLibraryRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/requirements",
        element: (
          <RequirePermission permission="project.business.read">
            {page(<RequirementListRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/requirements/new",
        element: (
          <RequirePermission permission="analysis.prepare">
            {page(<CreateRequirementRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/workflows",
        element: (
          <RequirePermission permission="analysis.prepare">
            {page(<WorkflowWorkbenchRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/artifacts",
        element: (
          <RequirePermission
            permission={["project.business.read", "project.delivery.read"]}
          >
            {page(<ArtifactWorkspaceRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/approvals",
        element: (
          <RequirePermission permission="approval.decide_business">
            {page(<ApprovalWorkspacePage />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/delivery-reviews",
        element: (
          <RequirePermission permission="delivery.review">
            {page(<DeliveryReviewWorkspacePage />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/exports",
        element: (
          <RequirePermission permission="project.export">
            {page(<ProjectExportRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "profile",
        element: page(<ProfilePage />),
      },
      {
        path: "admin",
        element: (
          <RequirePermission permission="admin.users">
            {page(<AdminPage />)}
          </RequirePermission>
        ),
      },
      { path: "*", element: page(<NotFoundPage />) },
    ],
  },
  { path: "*", element: page(<NotFoundPage />) },
]);
