import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth, RequireGuest, RequireRole } from "./AuthGuards";
import { AppShell } from "../components/layout/AppShell";
import {
  ApprovalWorkspacePage,
  ArtifactWorkspaceRoute,
  AuthPage,
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
        element: page(<CreateProjectPage />),
      },
      {
        path: "projects/:projectId",
        element: page(<ProjectOverviewPage />),
      },
      {
        path: "projects/:projectId/documents",
        element: page(<ProjectDocumentLibraryRoute />),
      },
      {
        path: "projects/:projectId/requirements",
        element: page(<RequirementListRoute />),
      },
      {
        path: "projects/:projectId/requirements/new",
        element: page(<CreateRequirementRoute />),
      },
      {
        path: "projects/:projectId/workflows",
        element: page(<WorkflowWorkbenchRoute />),
      },
      {
        path: "projects/:projectId/artifacts",
        element: page(<ArtifactWorkspaceRoute />),
      },
      {
        path: "projects/:projectId/approvals",
        element: (
          <RequireRole roles={["reviewer", "admin"]}>
            {page(<ApprovalWorkspacePage />)}
          </RequireRole>
        ),
      },
      {
        path: "projects/:projectId/exports",
        element: page(<ProjectExportRoute />),
      },
      {
        path: "profile",
        element: page(<ProfilePage />),
      },
      { path: "*", element: page(<NotFoundPage />) },
    ],
  },
  { path: "*", element: page(<NotFoundPage />) },
]);
