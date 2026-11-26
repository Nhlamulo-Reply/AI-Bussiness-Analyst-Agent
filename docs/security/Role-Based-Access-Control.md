# Role-Based Access Control

This report describes the role model after backend and frontend permission
parity. Role capabilities are enforced by the API and reflected in frontend
navigation, route guards, dashboards, and role-specific actions. Project
ownership or membership remains an independent requirement for project content.

## Canonical roles and permissions

| Capstone role               | Stored role        | Backend capabilities                                                                                                                        |
| --------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Business Analyst            | `business_analyst` | `project.read`, `project.create`, `project.business.read`, `project.delivery.read`, `project.export`, `analysis.prepare`, `analysis.submit` |
| Product Owner / Stakeholder | `product_owner`    | `project.read`, `project.business.read`, `approval.decide_business`                                                                         |
| Delivery Lead               | `delivery_lead`    | `project.read`, `project.delivery.read`, `delivery.review`                                                                                  |
| Administrator               | `admin`            | `admin.users`, `admin.project_access`, `admin.templates`, `admin.audit`                                                                     |

The backend role union is defined in
`backend/src/modules/auth/user.repository.ts`; its permission map is in
`backend/src/common/authorization/permissions.ts`. Admin is mutually exclusive
with project roles. Self-registered users have no roles or application
permissions until an administrator assigns them. Bootstrap assigns `admin` to
the registering account; role assignment and invitations reject mixed
Admin/project roles.
Stored legacy combinations are normalized to Admin-only for authorization and
user listings.

## Project access and content scopes

Project content requires `project.read` and project ownership or active
membership. The project list is scoped to the current user. Members must be
active, have a project role, and cannot be Administrators.

- `project.business.read` allows Business Analysts and Product Owners to read
  requirements, source-document metadata, and business artifacts
  (`epic`, `story`, `acceptance_criteria`, `business_rule`).
- `project.delivery.read` allows Business Analysts and Delivery Leads to read
  delivery artifacts (`risk`, `dependency`, `implementation_plan`).
- Project export is restricted to Business Analysts because exports contain
  the full project dataset.
- Administrators do not receive project-content permissions, even if a legacy
  record contains project roles alongside `admin`.

Administrators can use a separate project-access API to list only project ID,
name, status, owner ID, and member IDs, and to replace member IDs. It does not
return project briefs, documents, requirements, artifacts, approvals, or
exports. Project owners retain their member-management route. Both paths audit
the actual actor and member-ID changes.

## Permission enforcement

| Capability                                             | Permission                 | Project requirement                                               |
| ------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------- |
| Create a project                                       | `project.create`           | Business Analyst                                                  |
| Prepare or edit requirements, artifacts, and workflows | `analysis.prepare`         | Business Analyst; project access                                  |
| Submit work for review                                 | `analysis.submit`          | Business Analyst; project access                                  |
| Review and decide business approvals                   | `approval.decide_business` | Product Owner; project access; self-review is rejected            |
| View pending delivery reviews and provide feedback     | `delivery.review`          | Delivery Lead; project access; feedback cannot decide an approval |
| Manage users and canonical role assignments            | `admin.users`              | Administrator                                                     |
| Manage project membership metadata                     | `admin.project_access`     | Administrator; no project-content access                          |
| Manage workflow templates                              | `admin.templates`          | Administrator                                                     |
| View/export audit history                              | `admin.audit`              | Administrator                                                     |

The Admin user directory returns only ID, email, roles, active state, and
timestamps. Invitation links are single-use, expire, and activate an invited
account only after the invitee sets a password. Only a token hash is stored.

## Human approval and AI boundary

- LangGraph workflows create draft requirements/artifacts; workflows do not
  create approval decisions.
- Business Analysts submit drafts for review.
- Product Owners can approve, reject, or request changes. Decisions are
  pending-only, require project access, and cannot be made by the submitter.
- Delivery Leads can review pending delivery artifacts and add feedback, but
  do not receive approval-decision authority.
- Approval transitions and feedback are retained in the audit history.

## Current phase boundary

The frontend permission map mirrors the backend scopes, including Admin
precedence for legacy mixed-role sessions. Dashboards, navigation, and
project-level actions are role-gated; the Admin UI supports invitations and
metadata-only project membership. The API remains authoritative for project
membership and content access. A separate visual redesign and light/dark theme
phase has not been started.

The local JSON store remains single-process storage and is not intended for
multi-instance deployment.
