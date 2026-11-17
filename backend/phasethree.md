# Phase 3–4 Backend Walkthrough

This walkthrough follows the backend from process startup through its current Phase 3 foundation and Phase 4 project/domain APIs. Persistence currently uses a temporary JSON file; MongoDB is deferred. AI workflow endpoints remain explicit Phase 5 placeholders.

## 1. Start here

The process entry point is [`src/server.ts`](src/server.ts). From the `backend` folder:

```powershell
npm run dev
```

For a compiled run:

```powershell
npm run build
npm start
```

Before starting, copy `.env.example` to `.env` and replace `JWT_SECRET` with a private random secret that is at least 32 characters long. The storage file is configured by `JSON_STORAGE_PATH` (default: `./data/ai-business-analyst.json`, relative to the backend working directory). No database service is required.

## 2. Startup path

```mermaid
flowchart TD
    CMD["npm run dev or npm start<br/>backend/package.json"] --> ENTRY["src/server.ts<br/>loads dotenv; calls startServer()"]
    ENTRY --> CONFIG["src/config/env.ts<br/>loadConfig() validates environment with Zod"]
    CONFIG -->|Invalid| CONFIGFAIL["Startup stops<br/>non-zero exit"]
    CONFIG -->|Valid| LOGGER["src/config/logger.ts<br/>createLogger()"]
    LOGGER --> STORE["src/config/storage.ts<br/>construct JsonFileStorage"]
    STORE --> CONNECT["JsonFileStorage.connect()<br/>create directory/file or load and validate JSON"]
    CONNECT -->|Failure| STOREFAIL["Log safe failure and abort startup"]
    CONNECT -->|Success| APP["src/app.ts<br/>createApp()"]
    APP --> HTTP["Create Node HTTP server<br/>listen on configured PORT"]
    HTTP --> RUNNING["API accepting requests"]
    RUNNING --> SIGNAL["SIGINT / SIGTERM"]
    SIGNAL --> CLOSE["Stop HTTP server<br/>wait for queued JSON writes"]
```

### Startup details

1. `dotenv/config` loads local `.env` values.
2. `loadConfig()` checks required values and bounds such as the port, JSON file path, JWT secret, and token lifetime.
3. `createLogger()` creates the structured Pino logger with sensitive-field redaction.
4. `JsonFileStorage.connect()` creates the parent directory and initial versioned JSON file when missing, or loads and validates the existing file.
5. Only after storage initializes does `createApp()` assemble the HTTP application and the server begin listening.
6. User mutations are serialized and written through a temporary file followed by an atomic rename. Shutdown waits for queued writes.

## 3. HTTP request path

```mermaid
flowchart TD
    CLIENT["HTTP client"] --> APP["src/app.ts<br/>Express application"]
    APP --> HEADERS["Helmet<br/>security response headers"]
    HEADERS --> REQUEST["pino-http + request-context.ts<br/>request ID and request logging"]
    REQUEST --> JSON["Express JSON parser<br/>1 MB body limit"]
    JSON --> ROUTE{"Matched route?"}

    ROUTE -->|GET health/live| LIVE["Return process liveness"]
    ROUTE -->|GET health/ready| READY["storage.ping()"]
    READY -->|File accessible| READYOK["200 ready<br/>storage: json"]
    READY -->|File unavailable| ERROR["AppError"]

    ROUTE -->|POST auth/register or auth/login| AUTHROUTER["modules/auth/auth.routes.ts"]
    AUTHROUTER --> LIMIT["Authentication rate limit<br/>10 attempts / 15 minutes"]
    LIMIT --> VALIDATE["common/middleware/validation.ts<br/>Zod validates and normalizes body"]
    VALIDATE --> SERVICE["modules/auth/auth.service.ts<br/>register or login"]
    SERVICE --> REPO["UserRepository"]
    REPO --> JSON["Configured JSON file<br/>users array"]
    SERVICE --> TOKEN["Password hash/compare<br/>Create short-lived JWT"]
    TOKEN --> AUTHRESPONSE["Success envelope + request ID"]

    ROUTE -->|GET auth/me| BEARER["authentication.ts<br/>verify Bearer JWT"]
    BEARER --> ME["Return current authenticated user"]

    ROUTE -->|projects, documents, artifacts| PROJECTS["modules/projects/project.routes.ts"]
    PROJECTS --> ACCESS["project-access.ts<br/>owner or member guard"]
    ACCESS --> PROJECTDATA["config/storage.ts<br/>versioned JSON collections"]
    ROUTE -->|requirements| REQUIREMENTS["modules/requirements/requirement.routes.ts"]
    REQUIREMENTS --> PROJECTDATA
    ROUTE -->|approvals| APPROVALS["modules/approvals/approval.routes.ts"]
    APPROVALS --> PROJECTDATA
    ROUTE -->|roles| USERS["modules/users/user.routes.ts"]
    USERS --> PROJECTDATA
    ROUTE -->|AI workflow request| PLACEHOLDERS["modules/workflows/workflow-placeholder.routes.ts<br/>501; no generated results"]
    ROUTE -->|export| EXPORT["modules/exports/project-exporter.ts<br/>JSON / Markdown / CSV"]

    ROUTE -->|GET /api-docs| SWAGGER["src/docs/openapi.ts<br/>Swagger UI"]
    ROUTE -->|No match or error| ERROR
    JSON -->|Malformed or oversized body| ERROR
    VALIDATE -->|Invalid body| ERROR
    BEARER -->|Missing or invalid token| ERROR
    ERROR --> HANDLER["common/middleware/error-handler.ts<br/>standard error response"]
    HANDLER --> CLIENT
    LIVE --> CLIENT
    READYOK --> CLIENT
    AUTHRESPONSE --> CLIENT
    ME --> CLIENT
    PROJECTDATA --> CLIENT
    PLACEHOLDERS --> CLIENT
    EXPORT --> CLIENT
    SWAGGER --> CLIENT
```

The normal API response shape is `{ success, data, requestId }`. Errors use `{ success: false, error: { code, message, details, requestId } }`. Request IDs are returned in both the response body and the `X-Request-Id` header.

## 4. Implemented HTTP APIs

| Method and path | What it does | Important behavior |
|---|---|---|
| `GET /api/v1/health/live` | Confirms the process is running. | Does not depend on storage. |
| `GET /api/v1/health/ready` | Checks whether JSON storage is usable. | Checks that the configured file is initialized and accessible; responds `503 SERVICE_UNAVAILABLE` otherwise. |
| `POST /api/v1/auth/register` | Creates a standard user account. | Requires valid email and a 12–128 character password. Always assigns `user`; never accepts elevated roles from the request. |
| `POST /api/v1/auth/login` | Checks credentials and issues an access token. | Returns a short-lived JWT; invalid credentials receive a generic `401`. |
| `GET /api/v1/auth/me` | Returns the current authenticated user. | Requires `Authorization: Bearer <token>`. |
| `POST /api/v1/projects` | Creates a project. | The authenticated user is the owner. |
| `GET /api/v1/projects?page=&limit=` | Lists accessible projects. | Pagination is validated; access is owner/member scoped. |
| `GET /api/v1/projects/:id` | Reads project data. | Inaccessible project IDs return `404`. |
| `PATCH /api/v1/projects/:id/members` | Replaces project members. | Owner-only; all member IDs must belong to registered users. |
| `POST /api/v1/projects/:id/documents` | Uploads a document. | PDF, DOCX, UTF-8 text; 5 MiB limit; metadata response omits file bytes. |
| `GET /api/v1/projects/:id/documents` | Lists document metadata. | Stored file bytes are not returned. |
| `POST /api/v1/projects/:id/requirements` | Creates a draft requirement. | Source documents must belong to the same project. |
| `GET /api/v1/projects/:id/requirements?page=&limit=` | Lists project requirements. | Paginated. |
| `PATCH /api/v1/requirements/:id` | Revises a requirement. | Saves the prior snapshot, increments version, and resets status to draft. |
| `GET /api/v1/requirements/:id/versions` | Lists requirement history. | Requires access to its project. |
| `GET /api/v1/artifacts/:id/versions?type=...` | Lists artifact version snapshots. | Requires a valid artifact type and project access. |
| `POST /api/v1/projects/:id/artifacts` | Creates a draft artifact. | Supports epic, story, acceptance criteria, business rule, risk, dependency, and implementation plan types. |
| `GET /api/v1/projects/:id/artifacts?page=&limit=` | Lists project artifacts. | Paginated. |
| `POST /api/v1/approvals` | Submits an artifact for review. | Artifact must belong to the declared project. |
| `PATCH /api/v1/approvals/:id` | Records a review decision. | Reviewer/admin only; self-review is rejected; decided approvals cannot be changed. |
| `PATCH /api/v1/users/:id/roles` | Assigns user roles. | Admin-only. Initial admin provisioning is out-of-band; changed roles take effect for newly issued tokens. |
| `GET /api/v1/projects/:id/export?format=json\|markdown\|csv` | Exports project data. | Document file bytes are excluded. |
| `POST /api/v1/requirements/analyze` (and other generation routes) | Phase 5 placeholder. | Returns explicit `501 NOT_IMPLEMENTED`; does not fabricate or persist results. |
| `GET /api/v1/executions/:id` | Reads an execution record. | Returns `404` if no record exists or project access is denied. |
| `GET /api-docs` | Serves the Swagger UI. | Documents the implemented Phase 3/4 endpoints and Phase 5 placeholders. |

The current endpoint contracts are also summarized in [`../docs/api/API-Specification.md`](../docs/api/API-Specification.md).

## 5. File map: where to read next

### Process and application composition

| File | Main responsibility |
|---|---|
| [`src/server.ts`](src/server.ts) | Actual process entry point. Loads config, initializes JSON storage, creates the app, listens on the port, and handles shutdown signals. |
| [`src/app.ts`](src/app.ts) | Creates the Express app and mounts health, auth, project, requirement, workflow-placeholder, approval, user-role, and Swagger routes with shared middleware and errors. |
| [`package.json`](package.json) | Dependencies and the `dev`, `build`, `start`, `typecheck`, and `test` commands. |
| [`tsconfig.json`](tsconfig.json) | Strict TypeScript compiler settings and source/test inclusion. |
| [`README.md`](README.md) | Environment setup, run commands, and a short endpoint list. |

### Configuration and infrastructure

| File | Main responsibility |
|---|---|
| [`src/config/env.ts`](src/config/env.ts) | Defines and validates environment values with Zod; exports `loadConfig()`. |
| [`src/config/storage.ts`](src/config/storage.ts) | Owns JSON-file lifecycle, version-1 migration, validation, atomic writes, and user/project/document/requirement/artifact/approval/version/execution persistence. |
| [`src/config/logger.ts`](src/config/logger.ts) | Creates the structured Pino logger and redacts sensitive fields. |
| [`.env.example`](.env.example) | Lists local configuration names and safe placeholders. The JWT placeholder is deliberately invalid until replaced. |

### HTTP middleware and shared errors

| File | Main responsibility |
|---|---|
| [`src/common/middleware/request-context.ts`](src/common/middleware/request-context.ts) | Uses a valid supplied `X-Request-Id` or generates one, then adds it to the response header. |
| [`src/common/middleware/validation.ts`](src/common/middleware/validation.ts) | `validateBody(schema)` validates a request body and returns standard validation errors. |
| [`src/common/middleware/authentication.ts`](src/common/middleware/authentication.ts) | `authenticate(secret)` verifies bearer JWTs; `requireRoles(...)` enforces roles. |
| [`src/common/middleware/project-access.ts`](src/common/middleware/project-access.ts) | `requireProjectAccess(repository)` checks project ownership/membership and returns not-found for inaccessible projects. |
| [`src/common/middleware/error-handler.ts`](src/common/middleware/error-handler.ts) | Converts application, malformed-JSON, oversized-body, and unknown errors into the common error envelope; also defines not-found handling. |
| [`src/common/errors/app-error.ts`](src/common/errors/app-error.ts) | Shared `AppError` type carrying status, code, message, and validation details. |
| [`src/common/types/express.d.ts`](src/common/types/express.d.ts) | Adds the request ID and authenticated-user fields to Express request types. |

### Authentication module and API description

| File | Main responsibility |
|---|---|
| [`src/modules/auth/auth.routes.ts`](src/modules/auth/auth.routes.ts) | Defines `POST /register`, `POST /login`, and `GET /me`; applies rate limiting and body validation. |
| [`src/modules/auth/auth.service.ts`](src/modules/auth/auth.service.ts) | Normalizes email, hashes/checks passwords, prevents duplicate registration, and issues JWTs. |
| [`src/modules/auth/user.repository.ts`](src/modules/auth/user.repository.ts) | Defines the user record and repository contract used by the auth service. |
| [`src/modules/domain/domain.schemas.ts`](src/modules/domain/domain.schemas.ts) | Defines Zod persistence and request schemas for projects and domain records. |
| [`src/modules/projects/project.routes.ts`](src/modules/projects/project.routes.ts) | Project CRUD, membership management, document upload/list, artifact create/list, and export routes. |
| [`src/modules/requirements/requirement.routes.ts`](src/modules/requirements/requirement.routes.ts) | Draft requirement creation/list/edit and version-history routes. |
| [`src/modules/approvals/approval.routes.ts`](src/modules/approvals/approval.routes.ts) | Approval submission and reviewer decision/state transitions. |
| [`src/modules/users/user.routes.ts`](src/modules/users/user.routes.ts) | Admin-only role assignment. |
| [`src/modules/workflows/workflow-placeholder.routes.ts`](src/modules/workflows/workflow-placeholder.routes.ts) | Execution lookup and explicit Phase 5 `501` workflow routes. |
| [`src/modules/exports/project-exporter.ts`](src/modules/exports/project-exporter.ts) | Renders JSON, Markdown, and CSV exports; escapes Markdown and CSV values. |
| [`src/docs/openapi.ts`](src/docs/openapi.ts) | OpenAPI 3.1 document served by Swagger UI. |

## 6. Environment values

| Name | Required/default | Purpose |
|---|---|---|
| `NODE_ENV` | Defaults to `development` | Runtime environment (`development`, `test`, or `production`). |
| `PORT` | Defaults to `3000` | HTTP listening port. |
| `JSON_STORAGE_PATH` | Defaults to `./data/ai-business-analyst.json` | JSON file path; relative paths resolve from the backend working directory. |
| `JWT_SECRET` | Required, minimum 32 characters | Signs and verifies access tokens. |
| `JWT_TTL_SECONDS` | Defaults to `900`; allowed `60–86400` | Access-token lifetime. |
| `LOG_LEVEL` | Defaults to `info` | Pino log level. |

## 7. Authentication and project access in plain language

- Registration stores a bcryptjs password hash (cost factor 12), not the raw password.
- New accounts receive only the `user` role. Elevated roles are not self-assigned through registration.
- Login issues a JWT whose subject is the user's generated string ID and whose claims include the user's roles.
- `authenticate()` verifies the token before setting `request.user`.
- `requireRoles()` can guard routes that require a specific role.
- `requireProjectAccess()` asks the JSON-backed project repository whether the authenticated user is the project owner or a member.
- The project-access guard is implemented for future project routes, but **there are no project CRUD routes yet**.

## 8. Tests and current boundary

Tests live under [`tests/`](tests/). They exercise environment validation, JSON persistence/reload, write serialization, health/readiness responses, request validation, registration/login/token behavior, role checks, and project-access middleware. Storage tests use isolated temporary files.

Run the checks from `backend`:

```powershell
npm run typecheck
npm test
```

### Implemented in Phases 3 and 4

- Express/TypeScript foundation and configuration
- Versioned JSON storage initialization/migration, validation, atomic writes, and readiness check
- Request IDs, structured logging, centralized errors, and Zod body validation
- JWT authentication, password hashing, role checks, and project-access guard
- Project/document/requirement/artifact/approval/version/execution records and APIs
- Role assignment, project membership, paginated reads, exports, and upload validation
- Rate limiting, Helmet security headers, health routes, Swagger UI, and API tests

### Not implemented yet

- AI extraction, generation, analysis, asynchronous workflow processing, or document parsing (Phase 5)
- MongoDB adapter and migration (deferred; JSON remains temporary until approved)
- LangGraph workflows or LLM-provider integrations (Phase 5)
- Docker setup (Phase 8)

The next step after reviewing Phase 4 is to wait for explicit approval before starting Phase 5.
