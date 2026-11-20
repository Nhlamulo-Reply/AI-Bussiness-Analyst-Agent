# Backend API Specification

Base path: `/api/v1`. Authenticated endpoints require `Authorization: Bearer <token>`. Successful JSON responses use `{ "success": true, "data": ..., "requestId": "..." }`; errors use the shared error envelope and include a request ID. The matching OpenAPI 3.1 document is served at `/api-docs`.

## Phase 3 foundation

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/health/live` | Process liveness, independent of storage. |
| `GET` | `/health/ready` | Checks JSON-file storage and returns `503` if unavailable. |
| `POST` | `/auth/register` | Creates a standard user; email and 12–128 character password required. |
| `POST` | `/auth/login` | Authenticates credentials and returns a short-lived JWT. |
| `GET` | `/auth/me` | Returns the authenticated user. |

JSON-file storage is temporary, single-process storage configured by `JSON_STORAGE_PATH`; MongoDB is deferred.

## Phase 4 project and domain APIs

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/projects` | Creates a project owned by the authenticated user. |
| `GET` | `/projects?page=&limit=` | Lists accessible projects (limit 1–100). |
| `GET` | `/projects/:id` | Reads an accessible project. |
| `PATCH` | `/projects/:id/members` | Project owner replaces members using `{ "memberIds": ["..."] }`; all IDs must belong to registered users. |
| `POST` | `/projects/:id/documents` | Multipart field `file`; PDF, DOCX, UTF-8 text only; maximum 5 MiB. The response and document list contain metadata only, not file bytes. |
| `GET` | `/projects/:id/documents` | Lists uploaded document metadata. |
| `POST` | `/projects/:id/requirements` | Creates a draft requirement; linked documents must belong to the same project. |
| `GET` | `/projects/:id/requirements?page=&limit=` | Lists requirements. |
| `PATCH` | `/requirements/:id` | Revises a requirement, sets it back to draft, and stores the prior version. |
| `GET` | `/requirements/:id/versions` | Lists requirement snapshots. |
| `GET` | `/artifacts/:id/versions?type=...` | Lists snapshots for a supported artifact type. |
| `POST` | `/projects/:id/artifacts` | Creates a draft epic, story, acceptance criteria, business rule, risk, dependency, or implementation plan record; linked requirements must belong to the project. |
| `GET` | `/projects/:id/artifacts?page=&limit=` | Lists project artifacts. |
| `PATCH` | `/artifacts/:id` | Edits an artifact, saves the previous snapshot, increments its version, and returns it to draft; linked requirements must belong to the same project. An artifact with a pending approval cannot be edited. |
| `POST` | `/approvals` | Submits a requirement/artifact for review. |
| `PATCH` | `/approvals/:id` | Reviewer/admin decides pending submission; self-review is rejected and completed approvals cannot be changed. |
| `PATCH` | `/users/:id/roles` | Admin assigns roles. New registrations cannot assign elevated roles. Role changes apply to newly issued tokens. |
| `GET` | `/projects/:id/export?format=json\|markdown\|csv` | Exports project, requirements, artifacts, and approval data. Document file bytes are excluded. |

Project resources are visible only to the project owner and members. Project-member editing is owner-only. Approval decisions create a version snapshot and update the underlying artifact status. Only drafts without an existing pending approval can be submitted. Exports include each requirement and artifact's draft/approved/rejected status. For initial local setup, an administrator must be provisioned out of band in the JSON store before using admin-only role assignment.

## Phase 5 asynchronous workflows

The following authenticated, project-scoped endpoints enqueue LangGraph jobs and return `202` with the execution record:

- `POST /requirements/analyze`
- `POST /requirements/extract`
- `POST /stories/generate`
- `POST /acceptance-criteria/generate`
- `POST /requirements/validate`
- `POST /risks/analyze`
- `POST /roadmap/generate`

Workflow requests accept `projectId` and optional project-owned `documentIds`, `requirementIds`, or `storyId`. Each submission is limited to 10 documents and 40,000 extracted input characters; at most 10 workflow submissions are accepted per 15 minutes per client IP. `GET /executions/:id` returns the queued/running/completed/failed status, node states, timestamps, and a validated result only when the caller can access its project.

Set `LLM_PROVIDER=openai` with `OPENAI_API_KEY`, or `LLM_PROVIDER=groq` with `GROQ_API_KEY`, to enable provider calls; without the selected provider's key, submissions return `503 AI_PROVIDER_NOT_CONFIGURED`. Source documents and project context included in a workflow request are sent to the configured provider. Requests disable response storage, but callers must still ensure they are permitted to share the selected content. AI outputs are persisted as drafts, with source citations checked against extracted text.

Execution runs are in-process and persisted to the temporary JSON store. They are not crash-resumable and are not suitable for multi-process production deployment. Graceful shutdown waits for active jobs.

## Operational notes

- Swagger UI is available at `/api-docs`.
- Pagination rejects invalid page/limit values rather than silently clamping them.
- File upload errors use `400` for unsupported/mismatched content and `413` for files over 5 MiB.
- MongoDB remains deferred; workflow jobs use the configured temporary JSON storage and OpenAI integration.
