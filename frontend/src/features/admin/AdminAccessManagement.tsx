import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { getRoleLabel } from "../auth/role-label";
import { userRoles } from "../auth/auth.schemas";
import { hasPermission, rolePermissions } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import {
  inviteAdminUser,
  listAdminProjectAccess,
  updateAdminProjectMembers,
} from "./admin-api";
import type { AdminUser, ProjectAccess, UserRole } from "./admin.schemas";
import { getApiErrorPresentation } from "../../lib/api-client";

interface AdminAccessManagementProps {
  users: AdminUser[];
  usersReady: boolean;
}

const projectAccessQueryKey = (userId: string) => [
  "admin",
  userId,
  "project-access",
];

export function AdminAccessManagement({
  users,
  usersReady,
}: AdminAccessManagementProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? "anonymous";
  const canInvite = hasPermission(session?.user.roles, "admin.users");
  const canManageProjectAccess = hasPermission(
    session?.user.roles,
    "admin.project_access",
  );
  const [email, setEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<UserRole[]>([
    "business_analyst",
  ]);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, string[]>>(
    {},
  );
  const [copyError, setCopyError] = useState("");

  const projectAccessQuery = useQuery({
    queryKey: projectAccessQueryKey(userId),
    queryFn: ({ signal }) => listAdminProjectAccess(signal),
    enabled: canManageProjectAccess,
  });
  const invitationMutation = useMutation({
    mutationFn: inviteAdminUser,
    onSuccess: async () => {
      setEmail("");
      setCopyError("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "users"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "audit"],
        }),
      ]);
    },
    retry: false,
  });
  const membershipMutation = useMutation({
    mutationFn: ({
      projectId,
      memberIds,
    }: {
      projectId: string;
      memberIds: string[];
    }) => updateAdminProjectMembers(projectId, memberIds),
    onSuccess: async (project) => {
      setMemberDrafts((drafts) => ({
        ...drafts,
        [project.id]: project.memberIds,
      }));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectAccessQueryKey(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["admin", userId, "audit"],
        }),
      ]);
    },
    retry: false,
  });

  const invitationError = invitationMutation.isError
    ? getApiErrorPresentation(
        invitationMutation.error,
        "The invitation could not be created.",
      )
    : undefined;
  const projectAccessError = projectAccessQuery.isError
    ? getApiErrorPresentation(
        projectAccessQuery.error,
        "Project access could not be loaded.",
      )
    : undefined;
  const membershipError = membershipMutation.isError
    ? getApiErrorPresentation(
        membershipMutation.error,
        "Project membership could not be updated.",
      )
    : undefined;
  const assignableUsers = users.filter(
    (user) =>
      user.active && user.roles.length > 0 && !user.roles.includes("admin"),
  );
  const assignableUserIds = new Set(assignableUsers.map((user) => user.id));
  const projectAccess = projectAccessQuery.data?.items ?? [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const updateInviteRole = (role: UserRole, checked: boolean) => {
    invitationMutation.reset();
    setCopyError("");
    setInviteRoles((roles) => {
      if (!checked) return roles.filter((selected) => selected !== role);
      if (role === "admin") return ["admin"];
      return [...roles.filter((selected) => selected !== "admin"), role];
    });
  };

  const copyInvitation = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError("");
    } catch {
      setCopyError(
        "Clipboard access is unavailable. Select and copy the invitation link above.",
      );
    }
  };

  return (
    <>
      {canInvite ? (
        <section
          aria-labelledby="admin-invitations-title"
          className="admin-section"
        >
          <div className="admin-section__heading">
            <div>
              <h2 id="admin-invitations-title">Invite a user</h2>
              <p>
                Invitations are one-time links. The invited user chooses a
                password before the account becomes active.
              </p>
            </div>
          </div>
          <Card className="admin-invitation-card">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (email.trim() && inviteRoles.length > 0) {
                  invitationMutation.mutate({
                    email: email.trim(),
                    roles: inviteRoles,
                  });
                }
              }}
            >
              <label className="field">
                <span className="field__label">Email address</span>
                <input
                  autoComplete="email"
                  className="field__control"
                  disabled={invitationMutation.isPending}
                  onChange={(event) => {
                    invitationMutation.reset();
                    setCopyError("");
                    setEmail(event.currentTarget.value);
                  }}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <fieldset className="admin-role-editor__fieldset">
                <legend>Assign role(s)</legend>
                {userRoles.map((role) => (
                  <label key={role}>
                    <input
                      checked={inviteRoles.includes(role)}
                      disabled={invitationMutation.isPending}
                      onChange={(event) =>
                        updateInviteRole(role, event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    <span>{getRoleLabel(role)}</span>
                  </label>
                ))}
              </fieldset>
              <p className="admin-form-hint">
                Administrator is exclusive and cannot be combined with project
                roles.
              </p>
              <Button
                disabled={
                  !email.trim() ||
                  inviteRoles.length === 0 ||
                  invitationMutation.isPending
                }
                type="submit"
              >
                {invitationMutation.isPending
                  ? "Creating link"
                  : "Create invitation"}
              </Button>
            </form>
            {invitationError ? (
              <ErrorPanel
                message={invitationError.message}
                requestId={invitationError.requestId}
                title="Invitation unsuccessful"
              />
            ) : null}
            {invitationMutation.data ? (
              <div aria-live="polite" className="admin-invitation-result">
                <p className="admin-success" role="status">
                  {invitationMutation.data.invitationResent
                    ? "The pending invitation was refreshed."
                    : "Invitation created. Share this one-time link securely."}{" "}
                  Expires{" "}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(invitationMutation.data.expiresAt))}
                  .
                </p>
                <label className="field">
                  <span className="field__label">Invitation link</span>
                  <input
                    className="field__control"
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    value={invitationMutation.data.invitationUrl}
                  />
                </label>
                <Button
                  onClick={() =>
                    void copyInvitation(invitationMutation.data.invitationUrl)
                  }
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  Copy invitation link
                </Button>
                {copyError ? (
                  <p className="admin-inline-error" role="alert">
                    {copyError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      {canManageProjectAccess ? (
        <section
          aria-labelledby="admin-project-access-title"
          className="admin-section"
        >
          <div className="admin-section__heading">
            <div>
              <h2 id="admin-project-access-title">Project membership</h2>
              <p>
                Manage membership metadata only. Administrators do not receive
                project content access; the project owner remains unchanged.
              </p>
            </div>
            <Button
              disabled={projectAccessQuery.isFetching}
              onClick={() => void projectAccessQuery.refetch()}
              size="small"
              type="button"
              variant="secondary"
            >
              Refresh
            </Button>
          </div>
          {projectAccessQuery.isPending ? (
            <Card aria-busy="true" role="status">
              <LoadingSkeleton lines={4} />
            </Card>
          ) : null}
          {projectAccessError ? (
            <ErrorPanel
              message={projectAccessError.message}
              requestId={projectAccessError.requestId}
              title="Project access unavailable"
            />
          ) : null}
          {membershipError ? (
            <ErrorPanel
              message={membershipError.message}
              requestId={membershipError.requestId}
              title="Membership update unsuccessful"
            />
          ) : null}
          {membershipMutation.isSuccess ? (
            <p className="admin-success" role="status">
              Project membership was updated and audited.
            </p>
          ) : null}
          {projectAccess.map((project) => (
            <ProjectMembershipEditor
              key={project.id}
              assignableUsers={assignableUsers}
              assignableUserIds={assignableUserIds}
              canSave={usersReady}
              membershipMutationPending={membershipMutation.isPending}
              onChange={(memberIds) =>
                setMemberDrafts((drafts) => ({
                  ...drafts,
                  [project.id]: memberIds,
                }))
              }
              onSave={(memberIds) =>
                membershipMutation.mutate({
                  projectId: project.id,
                  memberIds,
                })
              }
              project={project}
              selectedMemberIds={(
                memberDrafts[project.id] ?? project.memberIds
              ).filter((memberId) => assignableUserIds.has(memberId))}
              ownerEmail={userById.get(project.ownerUserId)?.email}
            />
          ))}
          {projectAccessQuery.data?.total === 0 ? (
            <Card>
              <p>No projects are available for membership management.</p>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section
        aria-labelledby="admin-permission-map-title"
        className="admin-section"
      >
        <div className="admin-section__heading">
          <div>
            <h2 id="admin-permission-map-title">Role permissions</h2>
            <p>
              This read-only matrix reflects the permissions enforced by the
              application. AI agents are not human roles and cannot approve
              requirements.
            </p>
          </div>
        </div>
        <div className="admin-permission-grid">
          {userRoles.map((role) => (
            <Card as="article" className="admin-permission-card" key={role}>
              <h3>{getRoleLabel(role)}</h3>
              {rolePermissions[role].length ? (
                <ul>
                  {rolePermissions[role].map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              ) : (
                <p>No application permissions are assigned.</p>
              )}
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

function ProjectMembershipEditor({
  project,
  assignableUsers,
  assignableUserIds,
  canSave,
  membershipMutationPending,
  selectedMemberIds,
  ownerEmail,
  onChange,
  onSave,
}: {
  project: ProjectAccess;
  assignableUsers: AdminUser[];
  assignableUserIds: Set<string>;
  canSave: boolean;
  membershipMutationPending: boolean;
  selectedMemberIds: string[];
  ownerEmail?: string;
  onChange: (memberIds: string[]) => void;
  onSave: (memberIds: string[]) => void;
}) {
  return (
    <Card as="article" className="admin-project-access-card">
      <div className="admin-section__heading">
        <div>
          <h3>{project.name}</h3>
          <p>
            {project.status === "active" ? "Active" : "Archived"} · Owner:{" "}
            {ownerEmail ?? project.ownerUserId}
          </p>
        </div>
      </div>
      <label className="field">
        <span className="field__label">Project members</span>
        <select
          aria-label={`Members for ${project.name}`}
          className="field__control"
          disabled={membershipMutationPending}
          multiple
          onChange={(event) => {
            const memberIds = Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value,
            );
            onChange(memberIds);
          }}
          size={Math.min(Math.max(assignableUsers.length, 2), 8)}
          value={selectedMemberIds}
        >
          {assignableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email}
            </option>
          ))}
        </select>
      </label>
      {project.memberIds.some(
        (memberId) => !assignableUserIds.has(memberId),
      ) ? (
        <p className="admin-form-hint">
          Inactive or administrator memberships are not assignable and will be
          removed when you save.
        </p>
      ) : null}
      <Button
        disabled={!canSave || membershipMutationPending}
        onClick={() => onSave(selectedMemberIds)}
        size="small"
        type="button"
      >
        Save membership
      </Button>
    </Card>
  );
}
