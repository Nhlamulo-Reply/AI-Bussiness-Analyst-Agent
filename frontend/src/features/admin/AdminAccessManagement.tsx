import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ErrorPanel } from "../../components/ui/ErrorPanel";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { getRoleLabel } from "../auth/role-label";
import { userRoles } from "../auth/auth.schemas";
import { hasPermission, rolePermissions } from "../auth/permissions";
import { useAuth } from "../auth/useAuth";
import {
  addAdminProjectMember,
  inviteAdminUser,
  listAdminProjectAccessPage,
  listAdminProjectMembers,
  removeAdminProjectMember,
  searchAdminUsers,
} from "./admin-api";
import type { AdminUser, ProjectAccess, UserRole } from "./admin.schemas";
import { getApiErrorPresentation } from "../../lib/api-client";
import {
  ChevronLeft,
  ChevronRight,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";
import { TrashConfirmationDialog } from "../../components/ui/TrashConfirmationDialog";
import { MoveToBinMenu } from "../../components/ui/MoveToBinMenu";
import { useMoveToTrash } from "../trash/trash-queries";

const projectAccessQueryKey = (
  userId: string,
  page: number,
  search: string,
) => ["admin", userId, "project-access", { page, search }];

const projectAccessRootQueryKey = (userId: string) => [
  "admin",
  userId,
  "project-access",
];
const membershipPageSize = 10;

export function AdminAccessManagement() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? "anonymous";
  const canInvite = hasPermission(session?.user.roles, "admin.users");
  const canManageProjectAccess = hasPermission(
    session?.user.roles,
    "admin.project_access",
  );
  const canTrashProjects = hasPermission(session?.user.roles, "admin.trash");
  const [email, setEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<UserRole[]>([
    "business_analyst",
  ]);
  const [copyError, setCopyError] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectPage, setProjectPage] = useState(1);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [trashTarget, setTrashTarget] = useState<ProjectAccess | null>(null);
  const trashMutation = useMoveToTrash();

  const projectAccessQuery = useQuery({
    queryKey: projectAccessQueryKey(userId, projectPage, projectSearch),
    queryFn: ({ signal }) =>
      listAdminProjectAccessPage(
        {
          page: projectPage,
          limit: membershipPageSize,
          search: projectSearch,
        },
        signal,
      ),
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
  const projectAccess = projectAccessQuery.data?.items ?? [];
  const selectedProject = projectAccess.find(
    (project) => project.id === selectedProjectId,
  );
  const projectPageCount = Math.max(
    1,
    Math.ceil((projectAccessQuery.data?.total ?? 0) / membershipPageSize),
  );

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
          <label className="field">
            <span className="field__label">Search projects</span>
            <input
              className="field__control"
              onChange={(event) => {
                setProjectSearch(event.currentTarget.value);
                setProjectPage(1);
                setSelectedProjectId("");
              }}
              placeholder="Project name or ID"
              type="search"
              value={projectSearch}
            />
          </label>
          {projectAccess.map((project) => (
            <Card
              as="article"
              className="admin-project-access-card"
              key={project.id}
            >
              <div className="admin-section__heading">
                <div>
                  <h3>{project.name}</h3>
                  <p>
                    {project.status === "active" ? "Active" : "Archived"} ·{" "}
                    {project.memberCount}{" "}
                    {project.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <Button
                  onClick={() => setSelectedProjectId(project.id)}
                  size="small"
                  type="button"
                  variant={
                    selectedProjectId === project.id ? "secondary" : "primary"
                  }
                >
                  {selectedProjectId === project.id
                    ? "Managing members"
                    : "Manage members"}
                </Button>
                {canTrashProjects ? (
                  <MoveToBinMenu
                    disabled={trashMutation.isPending}
                    itemLabel={`project ${project.name}`}
                    onMoveToBin={() => setTrashTarget(project)}
                  />
                ) : null}
              </div>
            </Card>
          ))}
          {!projectAccessQuery.isPending &&
          projectAccessQuery.data?.total === 0 ? (
            <Card>
              <p>No projects match this search.</p>
            </Card>
          ) : null}
          {projectAccessQuery.data && projectAccessQuery.data.total > 0 ? (
            <div
              aria-label="Project membership pagination"
              className="admin-project-access-pagination"
              role="group"
            >
              <Button
                disabled={projectPage <= 1 || projectAccessQuery.isFetching}
                leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
                onClick={() => {
                  setProjectPage((page) => page - 1);
                  setSelectedProjectId("");
                }}
                size="small"
                type="button"
                variant="secondary"
              >
                Previous
              </Button>
              <span>
                Page {projectPage} of {projectPageCount} ·{" "}
                {projectAccessQuery.data.total} projects
              </span>
              <Button
                disabled={
                  projectPage >= projectPageCount ||
                  projectAccessQuery.isFetching
                }
                onClick={() => {
                  setProjectPage((page) => page + 1);
                  setSelectedProjectId("");
                }}
                size="small"
                trailingIcon={<ChevronRight aria-hidden="true" size={15} />}
                type="button"
                variant="secondary"
              >
                Next
              </Button>
            </div>
          ) : null}
          {selectedProject ? (
            <ProjectMembershipManager
              key={selectedProject.id}
              onUpdated={() =>
                queryClient.invalidateQueries({
                  queryKey: projectAccessRootQueryKey(userId),
                })
              }
              project={selectedProject}
            />
          ) : null}
          {projectAccessQuery.data?.total === 0 ? (
            <p className="admin-form-hint">Search by project name or ID.</p>
          ) : null}
        </section>
      ) : null}

      <TrashConfirmationDialog
        error={
          trashMutation.isError
            ? getApiErrorPresentation(
                trashMutation.error,
                "The project couldn't be moved to the bin.",
              ).message
            : undefined
        }
        isPending={trashMutation.isPending}
        itemLabel={trashTarget?.name ?? ""}
        onConfirm={() => {
          if (!trashTarget) return;
          trashMutation.mutate(
            { resourceType: "project", resourceId: trashTarget.id },
            { onSuccess: () => setTrashTarget(null) },
          );
        }}
        onOpenChange={(open) => {
          if (!open && !trashMutation.isPending) {
            setTrashTarget(null);
            trashMutation.reset();
          }
        }}
        open={Boolean(trashTarget)}
        requestId={
          trashMutation.isError
            ? getApiErrorPresentation(
                trashMutation.error,
                "The project couldn't be moved to the bin.",
              ).requestId
            : undefined
        }
      />

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

function ProjectMembershipManager({
  project,
  onUpdated,
}: {
  project: ProjectAccess;
  onUpdated: () => void;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? "anonymous";
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidatePage, setCandidatePage] = useState(1);
  const [notice, setNotice] = useState("");
  const membersQuery = useQuery({
    queryKey: [
      "admin",
      userId,
      "project-members",
      project.id,
      { page: memberPage, search: memberSearch },
    ],
    queryFn: ({ signal }) =>
      listAdminProjectMembers(
        project.id,
        { page: memberPage, limit: membershipPageSize, search: memberSearch },
        signal,
      ),
  });
  const candidatesQuery = useQuery({
    queryKey: [
      "admin",
      userId,
      "member-candidates",
      { page: candidatePage, search: candidateSearch },
    ],
    queryFn: ({ signal }) =>
      searchAdminUsers(
        {
          page: candidatePage,
          limit: membershipPageSize,
          search: candidateSearch,
        },
        signal,
      ),
    enabled: candidateSearch.trim().length >= 2,
  });
  const invalidateMembershipData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin", userId, "project-members", project.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", userId, "member-candidates"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin", userId, "audit"],
      }),
    ]);
    onUpdated();
  };
  const addMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string; email: string }) =>
      addAdminProjectMember(project.id, memberId),
    onSuccess: async (result, variables) => {
      setNotice(
        result.alreadyMember
          ? `${variables.email} is already a member of ${project.name}.`
          : `${variables.email} was added to ${project.name}.`,
      );
      await invalidateMembershipData();
    },
    retry: false,
  });
  const removeMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string; email: string }) =>
      removeAdminProjectMember(project.id, memberId),
    onSuccess: async (_result, variables) => {
      setNotice(`${variables.email} was removed from ${project.name}.`);
      setMemberPage(1);
      await invalidateMembershipData();
    },
    retry: false,
  });
  const membersPageCount = Math.max(
    1,
    Math.ceil((membersQuery.data?.total ?? 0) / membershipPageSize),
  );
  const candidatesPageCount = Math.max(
    1,
    Math.ceil((candidatesQuery.data?.total ?? 0) / membershipPageSize),
  );
  const membershipError = addMutation.error ?? removeMutation.error;
  const membershipErrorPresentation = membershipError
    ? getApiErrorPresentation(
        membershipError,
        "Project membership could not be updated.",
      )
    : undefined;

  return (
    <Card as="article" className="admin-project-access-card">
      <div className="admin-section__heading">
        <div>
          <p>
            Managing members for <strong>{project.name}</strong>. The project
            owner remains unchanged, and administrators do not receive project
            content access.
          </p>
        </div>
      </div>
      <p className="admin-form-hint">
        {project.memberCount} current{" "}
        {project.memberCount === 1 ? "member" : "members"}.
      </p>
      {notice ? (
        <p className="admin-success" role="status">
          {notice}
        </p>
      ) : null}
      {membershipErrorPresentation ? (
        <ErrorPanel
          message={membershipErrorPresentation.message}
          requestId={membershipErrorPresentation.requestId}
          title="Membership update unsuccessful"
        />
      ) : null}
      <label className="field">
        <span className="field__label">Find current members</span>
        <input
          className="field__control"
          onChange={(event) => {
            setMemberSearch(event.currentTarget.value);
            setMemberPage(1);
          }}
          placeholder="Search by email or user ID"
          type="search"
          value={memberSearch}
        />
      </label>
      {membersQuery.isPending ? (
        <LoadingSkeleton lines={2} />
      ) : membersQuery.isError ? (
        <ErrorPanel
          message={
            getApiErrorPresentation(
              membersQuery.error,
              "Current project members could not be loaded.",
            ).message
          }
          title="Members unavailable"
        />
      ) : membersQuery.data?.items.length ? (
        <ul className="admin-project-member-list">
          {membersQuery.data.items.map((member) => (
            <ProjectMemberRow
              key={member.id}
              member={member}
              onRemove={() => {
                setNotice("");
                removeMutation.mutate({
                  memberId: member.id,
                  email: member.email,
                });
              }}
              pending={removeMutation.isPending}
              removable
            />
          ))}
        </ul>
      ) : (
        <p className="admin-form-hint">
          {memberSearch
            ? "No current members match this search."
            : "This project has no members yet."}
        </p>
      )}
      {membersQuery.data && membersQuery.data.total > 0 ? (
        <MembershipPagination
          label="Current member pagination"
          page={memberPage}
          pageCount={membersPageCount}
          pending={membersQuery.isFetching}
          setPage={setMemberPage}
          total={membersQuery.data.total}
        />
      ) : null}
      <label className="field">
        <span className="field__label">Find users to add</span>
        <input
          className="field__control"
          onChange={(event) => {
            setCandidateSearch(event.currentTarget.value);
            setCandidatePage(1);
            setNotice("");
          }}
          placeholder="Type at least two characters"
          type="search"
          value={candidateSearch}
        />
      </label>
      {candidateSearch.trim().length < 2 ? (
        <p className="admin-form-hint">
          Enter at least two characters to search.
        </p>
      ) : candidatesQuery.isPending ? (
        <LoadingSkeleton lines={2} />
      ) : candidatesQuery.isError ? (
        <ErrorPanel
          message={
            getApiErrorPresentation(
              candidatesQuery.error,
              "Users could not be searched.",
            ).message
          }
          title="User search unavailable"
        />
      ) : candidatesQuery.data?.items.length ? (
        <ul className="admin-project-member-list">
          {candidatesQuery.data.items.map((candidate) => {
            const eligible =
              candidate.active &&
              candidate.roles.length > 0 &&
              !candidate.roles.includes("admin") &&
              candidate.id !== project.ownerUserId;
            return (
              <ProjectMemberRow
                key={candidate.id}
                actionLabel="Add"
                icon={<UserRoundPlus aria-hidden="true" size={15} />}
                member={candidate}
                onRemove={() => {
                  setNotice("");
                  addMutation.mutate({
                    memberId: candidate.id,
                    email: candidate.email,
                  });
                }}
                pending={addMutation.isPending}
                removable={eligible}
              />
            );
          })}
        </ul>
      ) : (
        <p className="admin-form-hint">No users match this search.</p>
      )}
      {candidatesQuery.data && candidatesQuery.data.total > 0 ? (
        <MembershipPagination
          label="User search pagination"
          page={candidatePage}
          pageCount={candidatesPageCount}
          pending={candidatesQuery.isFetching}
          setPage={setCandidatePage}
          total={candidatesQuery.data.total}
        />
      ) : null}
    </Card>
  );
}

function ProjectMemberRow({
  member,
  onRemove,
  pending,
  removable,
  actionLabel = "Remove",
  icon = <UserRoundX aria-hidden="true" size={15} />,
}: {
  member: Pick<AdminUser, "id" | "email" | "roles" | "active">;
  onRemove: () => void;
  pending: boolean;
  removable: boolean;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <li className="admin-project-member">
      <div>
        <strong>{member.email}</strong>
        <span>
          {member.roles.map(getRoleLabel).join(", ") || "No role"} ·{" "}
          {member.active ? "Active" : "Inactive"}
        </span>
      </div>
      <Button
        disabled={!removable || pending}
        leadingIcon={icon}
        onClick={onRemove}
        size="small"
        type="button"
        variant={actionLabel === "Remove" ? "danger" : "secondary"}
      >
        {actionLabel}
      </Button>
    </li>
  );
}

function MembershipPagination({
  label,
  page,
  pageCount,
  pending,
  setPage,
  total,
}: {
  label: string;
  page: number;
  pageCount: number;
  pending: boolean;
  setPage: Dispatch<SetStateAction<number>>;
  total: number;
}) {
  return (
    <div
      aria-label={label}
      className="admin-project-access-pagination"
      role="group"
    >
      <Button
        disabled={page <= 1 || pending}
        leadingIcon={<ChevronLeft aria-hidden="true" size={15} />}
        onClick={() => setPage((current) => current - 1)}
        size="small"
        type="button"
        variant="secondary"
      >
        Previous
      </Button>
      <span>
        Page {page} of {pageCount} · {total} results
      </span>
      <Button
        disabled={page >= pageCount || pending}
        onClick={() => setPage((current) => current + 1)}
        size="small"
        trailingIcon={<ChevronRight aria-hidden="true" size={15} />}
        type="button"
        variant="secondary"
      >
        Next
      </Button>
    </div>
  );
}
