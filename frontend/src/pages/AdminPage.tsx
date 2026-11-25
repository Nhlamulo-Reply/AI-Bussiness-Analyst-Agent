import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { useAuth } from "../features/auth/useAuth";
import { userRoles } from "../features/auth/auth.schemas";
import { hasPermission } from "../features/auth/permissions";
import { getRoleLabel } from "../features/auth/role-label";
import { AdminAccessManagement } from "../features/admin/AdminAccessManagement";
import {
  claimFirstAdmin,
  downloadAuditExport,
  listAdminAuditEvents,
  listAdminUsers,
  updateAdminUserActive,
  updateAdminUserRoles,
} from "../features/admin/admin-api";
import { AdminTemplateManager } from "../features/admin/AdminTemplateManager";
import type {
  AdminUser,
  AuditEvent,
  UserRole,
} from "../features/admin/admin.schemas";
import { ApiError, getApiErrorPresentation } from "../lib/api-client";

const pageSize = 100;
const pageFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const userColumns: DataTableColumn<AdminUser>[] = [
  {
    key: "email",
    header: "User",
    render: (user) => (
      <span className="admin-user-email" title={user.email}>
        {user.email}
      </span>
    ),
  },
  {
    key: "roles",
    header: "Roles",
    render: (user) => user.roles.map(getRoleLabel).join(", ") || "No role",
  },
  {
    key: "status",
    header: "Status",
    render: (user) =>
      user.roles.length === 0
        ? "Awaiting role assignment"
        : user.active
          ? "Active"
          : "Inactive",
  },
  {
    key: "created",
    header: "Created",
    render: (user) => (
      <time dateTime={user.createdAt}>
        {pageFormatter.format(new Date(user.createdAt))}
      </time>
    ),
  },
];

const auditColumns: DataTableColumn<AuditEvent>[] = [
  {
    key: "event",
    header: "Event",
    render: (event) => event.action.replaceAll(".", " "),
  },
  {
    key: "actor",
    header: "Actor",
    render: (event) => <code>{event.actorUserId}</code>,
  },
  {
    key: "resource",
    header: "Resource",
    render: (event) => (
      <span>
        {event.resourceType} <code>{event.resourceId}</code>
      </span>
    ),
  },
  {
    key: "time",
    header: "Time",
    render: (event) => (
      <time dateTime={event.createdAt}>
        {pageFormatter.format(new Date(event.createdAt))}
      </time>
    ),
  },
];

export function AdminPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasPermission(session?.user.roles, "admin.users");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<
    Record<string, UserRole[]>
  >({});
  const usersQuery = useQuery({
    queryKey: ["admin", session?.user.id, "users"],
    queryFn: ({ signal }) => listAdminUsers(signal),
    enabled: isAdmin,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", session?.user.id, "audit"],
    queryFn: ({ signal }) => listAdminAuditEvents(signal),
    enabled: isAdmin,
  });
  const bootstrapMutation = useMutation({
    mutationFn: claimFirstAdmin,
    onSuccess: () => setBootstrapToken(""),
    retry: false,
  });
  const rolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: UserRole[] }) =>
      updateAdminUserRoles(userId, roles),
    onSuccess: async (updatedUser) => {
      setSelectedRoles((selected) => {
        const next = { ...selected };
        delete next[updatedUser.id];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", session?.user.id, "users"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", session?.user.id, "audit"],
        }),
      ]);
    },
    retry: false,
  });
  const activeMutation = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      updateAdminUserActive(userId, active),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", session?.user.id, "users"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", session?.user.id, "audit"],
        }),
      ]);
    },
    retry: false,
  });
  const exportMutation = useMutation({
    mutationFn: (format: "json" | "csv") => downloadAuditExport(format),
    onSuccess: (file) => {
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    retry: false,
  });

  const users = usersQuery.data?.items ?? [];
  const auditEvents = auditQuery.data?.items ?? [];
  const bootstrapError = bootstrapMutation.isError
    ? getApiErrorPresentation(
        bootstrapMutation.error,
        "The first administrator could not be claimed.",
      )
    : undefined;
  const userError = usersQuery.isError
    ? getApiErrorPresentation(
        usersQuery.error,
        "The user directory is unavailable.",
      )
    : undefined;
  const auditError = auditQuery.isError
    ? getApiErrorPresentation(
        auditQuery.error,
        "The audit history is unavailable.",
      )
    : undefined;
  const rolesError = rolesMutation.isError
    ? getApiErrorPresentation(
        rolesMutation.error,
        "The role change could not be saved.",
      )
    : undefined;
  const activeError = activeMutation.isError
    ? getApiErrorPresentation(
        activeMutation.error,
        "The user's access status could not be changed.",
      )
    : undefined;
  const exportError = exportMutation.isError
    ? getApiErrorPresentation(
        exportMutation.error,
        "The audit history could not be exported.",
      )
    : undefined;
  const alreadyBootstrapped =
    bootstrapMutation.error instanceof ApiError &&
    bootstrapMutation.error.status === 409;

  const columns: DataTableColumn<AdminUser>[] = [
    ...userColumns,
    {
      key: "manage-roles",
      header: "Manage roles",
      render: (user) => {
        if (user.id === session?.user.id) {
          return <span>Use another admin to change your roles.</span>;
        }
        const roles = selectedRoles[user.id] ?? user.roles;
        return (
          <div className="admin-role-editor">
            <fieldset aria-label={`Roles for ${user.email}`}>
              {userRoles.map((role) => (
                <label key={role}>
                  <input
                    checked={roles.includes(role)}
                    disabled={rolesMutation.isPending}
                    onChange={(event) => {
                      const next: UserRole[] = event.currentTarget.checked
                        ? role === "admin"
                          ? ["admin"]
                          : [
                              ...roles.filter(
                                (selected) => selected !== "admin",
                              ),
                              role,
                            ]
                        : roles.filter((selected) => selected !== role);
                      setSelectedRoles((current) => ({
                        ...current,
                        [user.id]: next,
                      }));
                    }}
                    type="checkbox"
                  />
                  <span>{getRoleLabel(role)}</span>
                </label>
              ))}
            </fieldset>
            <Button
              disabled={
                rolesMutation.isPending ||
                roles.join("|") === user.roles.join("|")
              }
              onClick={() => rolesMutation.mutate({ userId: user.id, roles })}
              size="small"
              type="button"
              variant="secondary"
            >
              Save roles
            </Button>
          </div>
        );
      },
    },
    {
      key: "manage-active",
      header: "Access",
      render: (user) =>
        user.id === session?.user.id ? (
          <span>You cannot deactivate your own account.</span>
        ) : (
          <Button
            disabled={activeMutation.isPending}
            onClick={() =>
              activeMutation.mutate({
                userId: user.id,
                active: !user.active,
              })
            }
            size="small"
            type="button"
            variant="secondary"
          >
            {user.active ? "Deactivate" : "Reactivate"}
          </Button>
        ),
    },
  ];

  return (
    <section aria-labelledby="admin-title" className="admin-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE CONTROLS</p>
          <h1 id="admin-title">Administration</h1>
          <p>
            Manage workspace access and review important administrative and
            lifecycle events.
          </p>
        </div>
      </header>

      {!isAdmin ? (
        <Card as="section" className="admin-bootstrap-card">
          <h2>First administrator setup</h2>
          <p>
            If no administrator has been configured, an authorized user can
            claim the first admin role using the one-time token supplied by the
            system operator.
          </p>
          {bootstrapMutation.isSuccess ? (
            <p className="admin-success" role="status">
              Administrator access is enabled. Sign out and sign in again to
              activate it.
            </p>
          ) : alreadyBootstrapped ? (
            <p className="admin-inline-error" role="status">
              An administrator is already configured. Ask an existing
              administrator for access.
            </p>
          ) : null}
          {bootstrapError && !alreadyBootstrapped ? (
            <ErrorPanel
              message={bootstrapError.message}
              requestId={bootstrapError.requestId}
              title="Bootstrap unsuccessful"
            />
          ) : null}
          <form
            className="admin-bootstrap-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (bootstrapToken.length >= 32) {
                bootstrapMutation.mutate(bootstrapToken);
              }
            }}
          >
            <label htmlFor="admin-bootstrap-token">Bootstrap token</label>
            <input
              autoComplete="off"
              id="admin-bootstrap-token"
              minLength={32}
              onChange={(event) => setBootstrapToken(event.currentTarget.value)}
              required
              type="password"
              value={bootstrapToken}
            />
            <Button
              disabled={
                bootstrapToken.length < 32 || bootstrapMutation.isPending
              }
              type="submit"
            >
              {bootstrapMutation.isPending
                ? "Verifying"
                : "Claim administrator access"}
            </Button>
          </form>
        </Card>
      ) : (
        <>
          <section
            aria-labelledby="admin-users-title"
            className="admin-section"
          >
            <div className="admin-section__heading">
              <div>
                <h2 id="admin-users-title">Users and roles</h2>
                <p>
                  {usersQuery.data
                    ? `${usersQuery.data.total} registered users`
                    : "Loading user directory"}
                </p>
                <p>
                  Users awaiting role assignment have no workspace permissions.
                  Assign a role before they can use the application.
                </p>
              </div>
              <Button
                disabled={usersQuery.isFetching}
                onClick={() => void usersQuery.refetch()}
                size="small"
                type="button"
                variant="secondary"
              >
                Refresh
              </Button>
            </div>
            {usersQuery.isPending ? (
              <Card aria-busy="true" role="status">
                <LoadingSkeleton lines={4} />
              </Card>
            ) : null}
            {userError ? (
              <ErrorPanel
                message={userError.message}
                requestId={userError.requestId}
                title="Users unavailable"
              />
            ) : null}
            {rolesError ? (
              <ErrorPanel
                message={rolesError.message}
                requestId={rolesError.requestId}
                title="Role update unsuccessful"
              />
            ) : null}
            {activeError ? (
              <ErrorPanel
                message={activeError.message}
                requestId={activeError.requestId}
                title="Access update unsuccessful"
              />
            ) : null}
            {activeMutation.isSuccess ? (
              <p className="admin-success" role="status">
                User access status was updated. Deactivation revokes existing
                sessions.
              </p>
            ) : null}
            {rolesMutation.isSuccess ? (
              <p className="admin-success" role="status">
                User roles were updated.
              </p>
            ) : null}
            {usersQuery.data ? (
              <DataTable
                caption="Registered users and their workspace roles"
                columns={columns}
                emptyMessage="No users are registered."
                rowKey={(user) => user.id}
                rows={users}
              />
            ) : null}
          </section>

          <AdminAccessManagement />

          {session?.user.id ? (
            <AdminTemplateManager userId={session.user.id} />
          ) : null}

          <section
            aria-labelledby="admin-audit-title"
            className="admin-section"
          >
            <div className="admin-section__heading">
              <div>
                <h2 id="admin-audit-title">Audit history</h2>
                <p>
                  Audit events are retained indefinitely. The table shows the
                  latest 100; exports include the full history.
                </p>
              </div>
              <div className="admin-audit-actions">
                <Button
                  disabled={auditQuery.isFetching}
                  onClick={() => void auditQuery.refetch()}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Refresh
                </Button>
                <Button
                  disabled={exportMutation.isPending}
                  onClick={() => exportMutation.mutate("json")}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Export JSON
                </Button>
                <Button
                  disabled={exportMutation.isPending}
                  onClick={() => exportMutation.mutate("csv")}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Export CSV
                </Button>
              </div>
            </div>
            {exportError ? (
              <ErrorPanel
                message={exportError.message}
                requestId={exportError.requestId}
                title="Audit export unsuccessful"
              />
            ) : null}
            {auditQuery.isPending ? (
              <Card aria-busy="true" role="status">
                <LoadingSkeleton lines={4} />
              </Card>
            ) : null}
            {auditError ? (
              <ErrorPanel
                message={auditError.message}
                requestId={auditError.requestId}
                title="Audit history unavailable"
              />
            ) : null}
            {auditQuery.data ? (
              <DataTable
                caption={`${Math.min(auditQuery.data.total, pageSize)} most recent audit events`}
                columns={auditColumns}
                emptyMessage="No audit events have been recorded."
                rowKey={(event) => event.id}
                rows={auditEvents}
              />
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
