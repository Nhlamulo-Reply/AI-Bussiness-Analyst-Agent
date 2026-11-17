# Phase 3 Backend Walkthrough

This guide explains the current Phase 3 backend: how the process starts, how an HTTP request moves through the code, what each file is responsible for, and which APIs are available. Persistence currently uses a temporary JSON file; MongoDB is deferred to a later approved phase.

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
| `GET /api-docs` | Serves the Swagger UI. | Describes the Phase 3 health and authentication endpoints. |

The current endpoint contracts are also summarized in [`../docs/api/API-Specification.md`](../docs/api/API-Specification.md).

## 5. File map: where to read next

### Process and application composition

| File | Main responsibility |
|---|---|
| [`src/server.ts`](src/server.ts) | Actual process entry point. Loads config, initializes JSON storage, creates the app, listens on the port, and handles shutdown signals. |
| [`src/app.ts`](src/app.ts) | Creates the Express app and installs security headers, request logging/IDs, JSON parsing, health routes, auth routes, Swagger UI, not-found handling, and centralized errors. |
| [`package.json`](package.json) | Dependencies and the `dev`, `build`, `start`, `typecheck`, and `test` commands. |
| [`tsconfig.json`](tsconfig.json) | Strict TypeScript compiler settings and source/test inclusion. |
| [`README.md`](README.md) | Environment setup, run commands, and a short endpoint list. |

### Configuration and infrastructure

| File | Main responsibility |
|---|---|
| [`src/config/env.ts`](src/config/env.ts) | Defines and validates environment values with Zod; exports `loadConfig()`. |
| [`src/config/storage.ts`](src/config/storage.ts) | Owns the JSON-file storage lifecycle. Implements connect, readiness check, close, user lookup/insert, project membership lookup, JSON validation, and atomic writes. |
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

### Implemented in Phase 3

- Express/TypeScript foundation and configuration
- JSON storage initialization, validation, atomic writes, and readiness check
- Request IDs, structured logging, centralized errors, and Zod body validation
- JWT authentication, password hashing, role checks, and project-access guard
- Rate limiting, Helmet security headers, health routes, Swagger UI, and test setup

### Not implemented yet

- Projects, documents, requirements, stories, approvals, exports, or execution CRUD APIs (Phase 4)
- MongoDB adapter and migration (deferred; JSON remains temporary until approved)
- LangGraph workflows or LLM-provider integrations (Phase 5)
- Docker setup (Phase 8)

The next step is to review this map alongside the source files. No Phase 4 implementation is included in this walkthrough.
