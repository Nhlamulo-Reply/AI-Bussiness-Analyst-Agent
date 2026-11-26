import { lazy, Suspense, type ReactNode } from "react";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";

export const AuthPage = lazy(() =>
  import("../pages/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
export const LandingPage = lazy(() =>
  import("../pages/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
export const ForgotPasswordPage = lazy(() =>
  import("../pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
export const ResetPasswordPage = lazy(() =>
  import("../pages/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
export const GoogleCallbackPage = lazy(() =>
  import("../pages/GoogleCallbackPage").then((module) => ({
    default: module.GoogleCallbackPage,
  })),
);
export const PendingAccessPage = lazy(() =>
  import("../pages/PendingAccessPage").then((module) => ({
    default: module.PendingAccessPage,
  })),
);
export const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
export const OverviewPage = lazy(() =>
  import("../pages/OverviewPage").then((module) => ({
    default: module.OverviewPage,
  })),
);
export const CreateProjectPage = lazy(() =>
  import("../pages/CreateProjectPage").then((module) => ({
    default: module.CreateProjectPage,
  })),
);
export const ProjectListPage = lazy(() =>
  import("../pages/ProjectListPage").then((module) => ({
    default: module.ProjectListPage,
  })),
);
export const ProjectOverviewPage = lazy(() =>
  import("../pages/ProjectOverviewPage").then((module) => ({
    default: module.ProjectOverviewPage,
  })),
);
export const ProfilePage = lazy(() =>
  import("../pages/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);
export const ProjectDocumentLibraryRoute = lazy(() =>
  import("../pages/DocumentLibraryPage").then((module) => ({
    default: module.ProjectDocumentLibraryRoute,
  })),
);
export const CreateRequirementRoute = lazy(() =>
  import("../pages/CreateRequirementPage").then((module) => ({
    default: module.CreateRequirementRoute,
  })),
);
export const RequirementListRoute = lazy(() =>
  import("../pages/RequirementListPage").then((module) => ({
    default: module.RequirementListRoute,
  })),
);
export const WorkflowWorkbenchRoute = lazy(() =>
  import("../pages/WorkflowWorkbenchPage").then((module) => ({
    default: module.WorkflowWorkbenchRoute,
  })),
);
export const ArtifactWorkspaceRoute = lazy(() =>
  import("../pages/ArtifactWorkspacePage").then((module) => ({
    default: module.ArtifactWorkspaceRoute,
  })),
);
export const ApprovalWorkspacePage = lazy(() =>
  import("../pages/ApprovalWorkspacePage").then((module) => ({
    default: module.ApprovalWorkspacePage,
  })),
);
export const DeliveryReviewWorkspacePage = lazy(() =>
  import("../pages/DeliveryReviewWorkspacePage").then((module) => ({
    default: module.DeliveryReviewWorkspacePage,
  })),
);
export const AdminPage = lazy(() =>
  import("../pages/AdminPage").then((module) => ({
    default: module.AdminPage,
  })),
);
export const ProjectExportRoute = lazy(() =>
  import("../pages/ProjectExportPage").then((module) => ({
    default: module.ProjectExportRoute,
  })),
);

export function SuspendedPage({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="route-loading" role="status">
          <LoadingSkeleton lines={4} />
          <span>Loading page...</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
