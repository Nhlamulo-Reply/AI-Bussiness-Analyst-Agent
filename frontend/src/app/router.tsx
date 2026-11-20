import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth, RequireGuest, RequireRole } from "./AuthGuards";
import { AppShell } from "../components/layout/AppShell";
import { AuthPage } from "../pages/AuthPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { OverviewPage } from "../pages/OverviewPage";
import { PagePlaceholder } from "../pages/PagePlaceholder";
import { CreateProjectPage } from "../pages/CreateProjectPage";
import { ProjectListPage } from "../pages/ProjectListPage";
import { ProjectOverviewPage } from "../pages/ProjectOverviewPage";
import { ProfilePage } from "../pages/ProfilePage";
import { ProjectDocumentLibraryRoute } from "../pages/DocumentLibraryPage";
import { CreateRequirementRoute } from "../pages/CreateRequirementPage";
import { RequirementListRoute } from "../pages/RequirementListPage";
import { WorkflowWorkbenchRoute } from "../pages/WorkflowWorkbenchPage";
import { ArtifactWorkspaceRoute } from "../pages/ArtifactWorkspacePage";

const placeholder = (title: string, description: string) => (
  <PagePlaceholder title={title} description={description} />
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/app" replace />,
  },
  {
    path: "/login",
    element: (
      <RequireGuest>
        <AuthPage mode="login" />
      </RequireGuest>
    ),
  },
  {
    path: "/register",
    element: (
      <RequireGuest>
        <AuthPage mode="register" />
      </RequireGuest>
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
      { index: true, element: <OverviewPage /> },
      {
        path: "projects",
        element: <ProjectListPage />,
      },
      {
        path: "projects/new",
        element: <CreateProjectPage />,
      },
      {
        path: "projects/:projectId",
        element: <ProjectOverviewPage />,
      },
      {
        path: "projects/:projectId/documents",
        element: <ProjectDocumentLibraryRoute />,
      },
      {
        path: "projects/:projectId/requirements",
        element: <RequirementListRoute />,
      },
      {
        path: "projects/:projectId/requirements/new",
        element: <CreateRequirementRoute />,
      },
      {
        path: "projects/:projectId/workflows",
        element: <WorkflowWorkbenchRoute />,
      },
      {
        path: "projects/:projectId/artifacts",
        element: <ArtifactWorkspaceRoute />,
      },
      {
        path: "projects/:projectId/approvals",
        element: (
          <RequireRole roles={["reviewer", "admin"]}>
            {placeholder(
              "Approvals",
              "Review actions will be grounded in approval records supplied by the backend.",
            )}
          </RequireRole>
        ),
      },
      {
        path: "projects/:projectId/exports",
        element: placeholder(
          "Project exports",
          "Prepare project information in a format that works for your team.",
        ),
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
