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
  CreateProjectPage,
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
  WorkflowWorkbenchRoute,
} from "./lazy-pages";

const page = (element: ReactNode) => <SuspendedPage>{element}</SuspendedPage>;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/app" replace />,
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
    path: "/app",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(<OverviewPage />) },
      {
        path: "projects",
        element: page(<ProjectListPage />),
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
        path: "projects/:projectId",
        element: page(<ProjectOverviewPage />),
      },
      {
        path: "projects/:projectId/documents",
        element: (
          <RequirePermission permission="project.read">
            {page(<ProjectDocumentLibraryRoute />)}
          </RequirePermission>
        ),
      },
      {
        path: "projects/:projectId/requirements",
        element: (
          <RequirePermission permission="project.read">
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
          <RequirePermission permission="project.read">
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
        path: "projects/:projectId/exports",
        element: (
          <RequirePermission permission="project.read">
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
