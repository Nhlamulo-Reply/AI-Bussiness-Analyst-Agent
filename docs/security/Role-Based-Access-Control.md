# Role-Based Access Control Report

**Status:** Incremental implementation in progress. Backend and frontend canonical role definitions, legacy compatibility, route guards, approval state transitions, and delivery feedback have been added. The app and frontend suites pass; workflow-suite Windows JSON persistence and timeout issues remain under isolated verification.

This report is based on the repository implementation and the supplied Capstone role specification. It is the required pre-implementation assessment. The system must enforce the Capstone roles as application roles, while project ownership and membership remain separate project-scoped relationships.

## 1. Current implementation

### Authentication and account state

- Public routes: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, and health endpoints.
- Protected routes validate a bearer JWT with `authenticate`.
- Authentication reloads the current account and compares the stored role set with the role claims in the token.
- Deactivated accounts and removed/changed role claims are rejected on protected requests.
- Login rejects inactive accounts.
- New accounts receive `["user"]`.
- First-admin bootstrap assigns `admin`; the bootstrap is protected by a one-time environment token.
- `JWT_SECRET` and JSON storage configuration are validated at startup.

### Current application roles

The implemented role union is:

- `user`
- `reviewer`
- `admin`
- `project_owner`

`project_owner` is stored as an application role, but the implementation also models ownership separately with `project.ownerUserId`. A standard `user` who owns a project remains a project owner through `ownerUserId`.

The Capstone's four business roles are not yet represented:

1. Business Analyst
2. Product Owner / Stakeholder
3. Delivery Lead
4. Administrator

### Project access

The shared project-access check permits access when the authenticated account is:

- `project.ownerUserId`, or
- an ID in `project.members`.

Application roles do not replace this check. Project access is currently concealed as `404 Not Found` where possible.

Project membership is independent of role. Project owner operations such as editing the project brief, replacing membership, archiving/restoring documents, and viewing archived documents require `ownerUserId === authenticatedUser.id`.

### Existing backend routes

| Area | Current routes | Existing authorization |
| --- | --- | --- |
| Project creation | `POST /api/v1/projects` | Any authenticated account |
| Project list/read | `GET /api/v1/projects`, `GET /api/v1/projects/:id` | List is scoped to owner/member; read uses project access |
| Project update/membership | `PATCH /api/v1/projects/:id`, `PATCH /api/v1/projects/:id/members` | Project access plus project-owner identity |
| Documents | `POST/PATCH/GET /api/v1/projects/:id/documents...` | Project access; owner required for archive/restore/archived view |
| Requirements | `POST/GET /api/v1/projects/:projectId/requirements`, `PATCH /api/v1/requirements/:id`, version read | Project access |
| Artifacts | `POST/GET /api/v1/projects/:id/artifacts`, `PATCH /api/v1/artifacts/:id`, version read | Project access |
| Workflows | `POST /api/v1/*workflow*`, `GET /api/v1/executions/:id` | Project access |
| Approvals | `POST /api/v1/approvals`, project approval queue, approval detail/decision | Submit requires project access; queue/detail/decision require `reviewer` or `admin` |
| User roles | `PATCH /api/v1/users/:id/roles` | `admin`; self-role change blocked; last active admin demotion blocked |
| First admin | `POST /api/v1/users/bootstrap-admin` | Configured bootstrap token |
| Account lifecycle | `PATCH /api/v1/admin/users/:id/active` | `admin`; self-deactivation and last-admin deactivation blocked |
| Templates | Template discovery plus admin CRUD | Discovery is authenticated; management requires `admin` |
| Audit | Admin audit list/export | `admin` |
| Project exports | `GET /api/v1/projects/:id/export` | Project access |

### Existing approval implementation

The approval API has:

- `draft` and a separate pending approval record.
- `approved`, `rejected`, and `changes_requested` decisions.
- Pending-only decision validation.
- Current project-access enforcement.
- Self-review rejection.
- Artifact status reset to `draft` for `changes_requested`.

Limitations:

- `reviewer` and `admin` are currently the only deciding roles.
- There is no Product Owner role or artifact-category authorization.
- There is no Delivery Lead role or delivery-only review permission.
- An administrator can decide an approval if it also has project access, but that role is not automatically project-authorized.
- A project owner/member can submit an approval regardless of their business-analyst role.
- Requirements also lack explicit pending-approval protection for edits.
- Workflow and requirement/epic creation do not enforce a preparation role.
- The approval model does not maintain an explicit review category or role requirement.

### Existing frontend implementation

- The frontend has `user`, `reviewer`, `admin`, and `project_owner` in its role union.
- Approval routes require `reviewer` or `admin`.
- Approval navigation uses `reviewer` or `admin`.
- The administration navigation is currently displayed to every authenticated user, although the backend protects administration endpoints.
- The administration route itself is not wrapped in `RequireRole`.
- Components perform role checks in several places rather than through one complete centralized permission model.
- Project access is largely displayed based on API responses rather than an explicit role/project authorization policy.

## 2. Identified specification and implementation gaps

### Role gaps

| Gap | Security or product impact |
| --- | --- |
| Missing Business Analyst role | Any authenticated account can create/edit project artifacts |
| Missing Product Owner / Stakeholder role | Approval access is tied to legacy `reviewer`/`admin` |
| Missing Delivery Lead role | Delivery risk, dependency, module, and roadmap review have no dedicated role |
| Legacy `reviewer` role has no Product Owner semantics | It may be used for generic approval even though the Capstone requires role-specific business review |
| Legacy `project_owner` role is ambiguous | Product may confuse application role with project ownership |

### Authorization gaps

- Project creation is not restricted to Business Analysts.
- Requirement and artifact creation/editing are not restricted to authorized preparation roles.
- Project workflows are not restricted by the artifact role responsible for generating the output.
- Approval submission is not restricted to Business Analysts or owners with the required role.
- Approval decisions are not restricted by artifact category:
  - Product Owner should decide business-value, priority, assumptions, and acceptance-criteria outputs.
  - Delivery Lead should review delivery risks/dependencies/modules/roadmaps but not approve business requirements.
- Delivery feedback comments are not yet represented by a separate review/feedback action.
- Requirement edits do not consistently protect a submitted/pending approval.
- The frontend administration route and administration navigation do not provide the same restriction UX as the backend.
- Authorization failures are not consistently audited.

### Account lifecycle gaps

- Account lifecycle and role changes are implemented and take effect through current-account lookup.
- Existing role-change and deactivation tests exist.
- Self-deactivation and last-active-admin protection exist.
- Administrators cannot change their own roles.

### Audit gaps

The append-only JSON audit implementation records many security-sensitive actions, including:

- registration, lifecycle, roles, projects, documents, requirements, artifacts, workflows, templates, exports, and approval decisions.

Missing or not fully represented:

- Authorization failures and rejected direct API attempts.
- Delivery review feedback as a distinct audited action.
- Explicit role-policy violations, such as invalid role assignment attempts or cross-project access attempts.

### State-model gaps

The artifact status union is `draft`, `reviewed`, `approved`, `rejected`, while approvals use `pending`, `approved`, `rejected`, `changes_requested`. This does not provide one complete, explicit artifact state for submitted review and requested changes. The stored implementation uses pending approval records rather than a `submitted` artifact status.

## 3. Permission matrix

Roles marked `No` do not receive that permission by role alone. Shared project access is still required for project-scoped resources.

| Action | Business Analyst | Product Owner / Stakeholder | Delivery Lead | Administrator |
| --- | --- | --- | --- | --- |
| Create projects and intake | Yes | Optional: project access only, not preparation | Optional: project access only, not preparation | No, unless separately assigned BA |
| Submit business problem/upload documents | Yes, project owner/member | No unless granted BA capability | No unless granted BA capability | No unless separately assigned BA |
| Generate/edit requirements and BA artifacts | Yes | No | No | No unless separately assigned BA |
| Submit work for review | Yes | No unless separately assigned BA | No unless separately assigned BA | No unless separately assigned role |
| Approve/reject own submission | No | No | No | No |
| Approve/reject requirements and business decisions | No | Yes, eligible project submission | No | No unless separately assigned PO |
| Approve/reject acceptance criteria | No | Yes | No | No unless separately assigned PO |
| Review delivery risks/dependencies/modules/roadmaps | No unless preparation role | Read/access allowed; approval is for eligible scope | Yes, comment/feedback only | No unless separately assigned role |
| Approve delivery/business work because of role | No | Only authorized business scope | No | No unless separately assigned PO |
| View project history/export | Yes with project access | Yes with project access | Yes with project access | No, unless project owner/member or separate review role |
| Manage users/roles | No | No | No | Yes |
| Deactivate/reactivate users | No | No | No | Yes |
| Manage templates | No | No | No | Yes |
| View/export audit history | No | No | No | Yes |

## 4. Endpoint and frontend permission map

| Capability | Relevant API | Existing frontend surface | Required rule |
| --- | --- | --- | --- |
| Create project | `POST /api/v1/projects` | Projects/New project | Require Business Analyst |
| Project read/list | Project routes | Projects and project overview | Owner/member plus role where the route is role-specific |
| Update project | `PATCH /api/v1/projects/:id` | Project brief editor | Project owner; role restrictions only where a preparation action is performed |
| Manage membership | `PATCH /api/v1/projects/:id/members` | Project overview/member UI | Project owner |
| Upload/list/archive documents | Project document routes | Document library | BA for submit/upload; project access for view; owner for archive/restore |
| Generate/edit requirements | Requirement and workflow routes | Requirements/workflows | BA plus project access |
| Generate/edit epics/stories/acceptance/risk/roadmap | Artifact and workflow routes | Artifact/workflow workspaces | BA plus project access; Delivery Lead has read/comment scope |
| Submit approval | `POST /api/v1/approvals` | Approval submission panel | BA plus project access; draft only; no pending approval |
| Review approval queue/detail | Project approval and approval detail routes | Approvals workspace | PO or separate explicitly assigned approval role plus project access |
| Delivery feedback | New delivery review endpoint/action is required | No complete dedicated UI | DL plus project access; no decision authority |
| Decide approval | `PATCH /api/v1/approvals/:id` | Approval workspace | Eligible PO plus project access; cannot decide own submission |
| User/role management | User/admin routes | Administration | Admin only |
| Template management | Admin template routes | Administration | Admin only |
| Audit management | Admin audit routes | Administration | Admin only |
| Project export | Project export route | Export workspace | Project access only; admin is not automatically included |

## 5. Security gaps and required implementation

1. Replace legacy role semantics with canonical Capstone roles while preserving stored legacy roles during migration.
2. Add centralized backend permission helpers/policies for:
   - Business Analyst preparation;
   - Product Owner decision;
   - Delivery Lead feedback;
   - Administrator management.
3. Prevent project resources from being prepared or reviewed solely through a legacy `reviewer`, `admin`, or `project_owner` role.
4. Keep project access (`ownerUserId` or membership) separate from application-role permission.
5. Define whether `reviewer` is removed or migrated to Product Owner. This is a compatibility ambiguity:
   - **Recommended:** migrate existing `reviewer` assignments to canonical `product_owner`.
   - Retain `reviewer` in stored compatibility data only, with no direct authorization meaning.
6. Define whether `project_owner` remains a role or becomes an alias. The repository already has project ownership by `ownerUserId`.
   - **Recommended:** retain `project_owner` only as a legacy role during migration, because actual owner authority comes from project data.
7. Add explicit canonical role names. Suggested storage values:
   - `business_analyst`
   - `product_owner`
   - `delivery_lead`
   - `admin`
8. Add reusable project-access + role middleware.
9. Add explicit delivery-review comments and audit actions.
10. Add role-specific approval category checks and a complete submitted/changes-requested state model.
11. Restrict the frontend administration route and navigation to `admin`.
12. Replace scattered frontend role checks with a central permission utility.
13. Add positive/negative tests for all four canonical roles, cross-project access, self-review, state transitions, role changes, and deactivation.
14. Optionally record denied authorization attempts in audit history, excluding credentials and tokens.

## 6. Ambiguities requiring a decision

- The Capstone calls for Business Analyst, Product Owner / Stakeholder, Delivery Lead, and Administrator, but the repository has no corresponding canonical role names.
- Existing `reviewer` assignments appear to represent approval access. They are not necessarily identical to the Capstone's Product Owner role.
- Existing `project_owner` is a role as well as a project relationship. The implementation already uses owner identity separately.
- The Capstone does not specify whether one account may hold several roles. The existing system supports multiple roles and should preserve that capability.
- Delivery Lead feedback is described as comments/feedback, but the repository has no delivery-feedback data model or endpoint.
- A full migration policy is needed for existing JSON records, legacy role tokens, and frontend role labels.

**Recommended compatible migration:** add canonical role names, map existing `reviewer` roles to `product_owner`, migrate `project_owner` UI semantics to a project relationship only, and preserve legacy role values in storage long enough to migrate existing accounts. This preserves existing data and does not make administrator or project-owner status equal project access or approval authority.

No irreversible role migration or role-gated endpoint change has been performed yet.
