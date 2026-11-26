# Backend API Specification

Base path: `/api/v1`. Authenticated endpoints require `Authorization: Bearer <token>`. Successful JSON responses use `{ "success": true, "data": ..., "requestId": "..." }`; errors use the shared error envelope and include a request ID. The matching OpenAPI 3.1 document is served at `/api-docs`.

## Phase 3 foundation

| Method | Path             | Behavior                                                               |
| ------ | ---------------- | ---------------------------------------------------------------------- |
| `GET`  | `/health/live`   | Process liveness, independent of storage.                              |
| `GET`  | `/health/ready`  | Checks JSON-file storage and returns `503` if unavailable.             |
| `POST` | `/auth/register` | Creates an account with no roles and no application permissions until an administrator assigns a role; email and 12–128 character password required. |
| `POST` | `/auth/login`    | Authenticates credentials and returns a short-lived JWT.               |
| `GET`  | `/auth/me`       | Returns the authenticated user.                                        |

JSON-file storage is temporary, single-process storage configured by `JSON_STORAGE_PATH`; MongoDB is deferred.

## Phase 4 project and domain APIs

| Method  | Path                                              | Behavior                                                                                                                                                                                                    |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/projects`                                       | Creates a project owned by the authenticated user. Optional brief fields include `businessObjective`, `inScope`, `outOfScope`, up to 50 list values, and an active `project_intake` `intakeTemplateId`.            |
| `GET`   | `/projects?page=&limit=`                          | Lists accessible projects (limit 1–100).                                                                                                                                                                    |
| `GET`   | `/projects/:id`                                   | Reads an accessible project.                                                                                                                                                                                |
| `PATCH` | `/projects/:id`                                   | Project-owner-only update of project name, description, and structured brief fields.                                                                                                                        |
| `PATCH` | `/projects/:id/members`                           | Project owner replaces members using `{ "memberIds": ["..."] }`; all IDs must belong to active registered users.                                                                                             |
| `POST`  | `/projects/:id/documents`                         | Multipart field `file`; PDF, DOCX, UTF-8 text only; maximum 5 MiB. The response and document list contain metadata only, not file bytes.                                                                    |
| `GET`   | `/projects/:id/documents`                         | Lists active document metadata. `?includeArchived=true` is owner-only.                                                                                                                                      |
| `PATCH` | `/projects/:id/documents/:documentId/archive`     | Owner-only reversible soft-archive; file bytes remain stored.                                                                                                                                               |
| `PATCH` | `/projects/:id/documents/:documentId/restore`     | Owner-only restore of an archived document.                                                                                                                                                                 |
| `POST`  | `/projects/:id/requirements`                      | Creates a draft requirement; linked documents must belong to the same project.                                                                                                                              |
| `GET`   | `/projects/:id/requirements?page=&limit=`         | Lists requirements.                                                                                                                                                                                         |
| `PATCH` | `/requirements/:id`                               | Revises a requirement, sets it back to draft, and stores the prior version.                                                                                                                                 |
| `GET`   | `/requirements/:id/versions`                      | Lists requirement snapshots.                                                                                                                                                                                |
| `GET`   | `/artifacts/:id/versions?type=...`                | Lists snapshots for a supported artifact type.                                                                                                                                                              |
| `POST`  | `/projects/:id/artifacts`                         | Creates a draft epic, story, acceptance criteria, business rule, risk, dependency, or implementation plan record; linked requirements must belong to the project.                                           |
| `GET`   | `/projects/:id/artifacts?page=&limit=`            | Lists project artifacts.                                                                                                                                                                                    |
| `PATCH` | `/artifacts/:id`                                  | Edits an artifact, saves the previous snapshot, increments its version, and returns it to draft; linked requirements must belong to the same project. An artifact with a pending approval cannot be edited. |
| `POST`  | `/approvals`                                      | Submits a requirement/artifact for review.                                                                                                                                                                  |
| `PATCH` | `/approvals/:id`                                  | Reviewer/admin decides pending submission; self-review is rejected and completed approvals cannot be changed.                                                                                               |
| `PATCH` | `/users/:id/roles`                                | Admin assigns roles or removes all roles to return an account to pending access. New registrations cannot assign roles; role changes invalidate existing JWTs. The last active admin cannot be demoted. |
| `POST`  | `/users/bootstrap-admin`                          | Claims the first admin using `ADMIN_BOOTSTRAP_TOKEN`; enabled only when configured and safe for concurrent calls.                                                                                           |
| `GET`   | `/admin/users?page=&limit=`                       | Admin-only user directory; password hashes are never returned. Includes active/inactive status.                                                                                                             |
| `PATCH` | `/admin/users/:id/active`                          | Admin-only reversible deactivate/reactivate. Self-deactivation and deactivation/demotion of the last active admin are rejected; inactive users cannot log in or use existing JWTs.                          |
| `GET`   | `/templates?type=`                                | Lists active templates for authenticated users. Categories: `project_intake`, `requirements`, `epics_stories`, `acceptance_criteria`, and `risks_roadmaps`.                                                |
| `GET`   | `/admin/templates`                                | Admin-only list of active and inactive templates.                                                                                                                                                           |
| `POST`  | `/admin/templates`                                | Admin creates a template with category, name, description, and instructions. Names are unique within each category.                                                                                         |
| `PATCH` | `/admin/templates/:id`                            | Admin edits template fields or changes status. Templates are deactivated, not deleted.                                                                                                                       |
| `GET`   | `/admin/audit-events?page=&limit=`                | Admin-only append-only history for registration, role/account lifecycle, projects and exports, documents, requirements, artifacts, workflows, templates, and approvals.                                    |
| `GET`   | `/admin/audit-events/export?format=json\|csv`      | Admin-only full audit download; each export is itself recorded. Events are retained indefinitely with no automatic purge.                                                                                   |
| `GET`   | `/projects/:id/export?format=json\|markdown\|csv` | Exports project, requirements, artifacts, and approval data; Markdown includes the structured project brief. Document file bytes are excluded.                                                              |

Project resources are visible only to the project owner and active members. Project-member editing and document archive/restore are owner-only. Archived documents are excluded from standard document lists, AI workflows, and exports; their bytes are retained. Approval decisions create a version snapshot and update the underlying artifact status. Only drafts without an existing pending approval can be submitted. Exports include each requirement and artifact's draft/approved/rejected status. First-admin bootstrap requires an explicitly configured one-time token; a newly registered roleless account may sign in to claim the first administrator role. Users must sign in again after role changes to receive fresh claims. Every authenticated request also checks current account status and roles, so deactivation revokes existing sessions immediately.

## Phase 5 asynchronous workflows

The following authenticated, project-scoped endpoints enqueue LangGraph jobs and return `202` with the execution record:

- `POST /requirements/analyze`
- `POST /requirements/extract`
- `POST /stories/generate`
- `POST /acceptance-criteria/generate`
- `POST /requirements/validate`
- `POST /risks/analyze`
- `POST /roadmap/generate`

Workflow requests accept `projectId` and optional project-owned `documentIds`, `requirementIds`, `storyId`, and up to 10 matching active `templateIds`. Template categories are checked by the server for each workflow; administrator instructions supplement but cannot override structured output validation. Project-description-only context includes the structured project brief; document content is never inferred when IDs are omitted, and non-empty document selections require `shareDocumentContent: true`. Requirement outputs include an optional 0–1 model confidence score; generated stories are grouped under epics and enforce the As-a/I-want/so-that fields. Acceptance criteria require positive, negative, boundary, validation, and edge scenario categories per story. Each submission is limited to 10 documents and 40,000 extracted input characters; at most 10 workflow submissions are accepted per 15 minutes per client IP. `GET /executions/:id` returns the queued/running/completed/failed status, node states, timestamps, and a validated result only when the caller can access its project.

Set `LLM_PROVIDER=openai` with `OPENAI_API_KEY`, or `LLM_PROVIDER=groq` with `GROQ_API_KEY`, to enable provider calls; without the selected provider's key, submissions return `503 AI_PROVIDER_NOT_CONFIGURED`. Source documents and project context included in a workflow request are sent to the configured provider. Requests disable response storage, but callers must still ensure they are permitted to share the selected content. AI outputs are persisted as drafts, with source citations checked against extracted text.

Execution runs are in-process and persisted to the temporary JSON store. They are not crash-resumable and are not suitable for multi-process production deployment. Graceful shutdown waits for active jobs.

## Operational notes

- Swagger UI is available at `/api-docs`.
- Pagination rejects invalid page/limit values rather than silently clamping them.
- File upload errors use `400` for unsupported/mismatched content and `413` for files over 5 MiB.
- Audit events are retained indefinitely in JSON storage. There is no purge operation; exports include the full event set and are audited.
- MongoDB remains deferred; workflow jobs use the configured temporary JSON storage and OpenAI integration.
