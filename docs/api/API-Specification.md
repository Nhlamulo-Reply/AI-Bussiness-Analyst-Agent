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
| `POST` | `/approvals` | Submits a requirement/artifact for review. |
| `PATCH` | `/approvals/:id` | Reviewer/admin decides pending submission; self-review is rejected and completed approvals cannot be changed. |
| `PATCH` | `/users/:id/roles` | Admin assigns roles. New registrations cannot assign elevated roles. Role changes apply to newly issued tokens. |
| `GET` | `/projects/:id/export?format=json\|markdown\|csv` | Exports project, requirements, artifacts, and approval data. Document file bytes are excluded. |

Project resources are visible only to the project owner and members. Project-member editing is owner-only. Approval decisions create a version snapshot and update the underlying artifact status. For initial local setup, an administrator must be provisioned out of band in the JSON store before using admin-only role assignment.

## Phase 5 workflow placeholders

The following authenticated endpoints validate the project request but intentionally return `501 NOT_IMPLEMENTED` without creating or fabricating results:

- `POST /requirements/analyze`
- `POST /requirements/extract`
- `POST /stories/generate`
- `POST /acceptance-criteria/generate`
- `POST /requirements/validate`
- `POST /risks/analyze`
- `POST /roadmap/generate`

`GET /executions/:id` returns an execution record only when one exists and the caller can access its project. AI execution remains Phase 5 work.

## Operational notes

- Swagger UI is available at `/api-docs`.
- Pagination rejects invalid page/limit values rather than silently clamping them.
- File upload errors use `400` for unsupported/mismatched content and `413` for files over 5 MiB.
- MongoDB, AI model integrations, document text extraction, and actual asynchronous workflows are not implemented in Phase 4.
