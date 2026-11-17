# AI Business Analyst Agent Backend

Phase 3 foundation and Phase 4 project/domain APIs using Node.js, TypeScript, Express, temporary JSON-file storage, Zod and Jest/Supertest. MongoDB remains a later storage target; Phase 5 AI workflows are not implemented.

## Requirements

- Node.js 20.19 or newer (the current development environment uses Node 22.19)
- npm

## Setup

From the `backend` directory in PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` in `.env` to a private random value of at least 32 characters. `JSON_STORAGE_PATH` defaults to `./data/ai-business-analyst.json`, relative to the backend working directory. Keep `.env` private and never commit credentials or stored user data.

## Run locally

Start the API in development mode:

```powershell
npm run dev
```

Build and run the compiled server:

```powershell
npm run build
npm start
```

The server validates its environment, creates the JSON storage file if it does not exist, and validates the file before listening. Malformed or inaccessible storage causes startup to fail with a non-zero exit code. File writes use a temporary file and atomic rename; this interim store is for a single backend process.

## Endpoints

- `GET /api/v1/health/live` — process liveness.
- `GET /api/v1/health/ready` — readiness, including a JSON file accessibility check.
- `POST /api/v1/auth/register` — create a standard `user` account (email and password of 12–128 characters).
- `POST /api/v1/auth/login` — return a short-lived JWT access token.
- `GET /api/v1/auth/me` — return the authenticated user; requires `Authorization: Bearer <token>`.
- `POST /api/v1/projects`, `GET /api/v1/projects`, `GET /api/v1/projects/:id` — create, list, and read accessible projects.
- `PATCH /api/v1/projects/:id/members` — project owner replaces project members.
- `POST /api/v1/projects/:id/documents`, `GET /api/v1/projects/:id/documents` — upload (PDF, DOCX, UTF-8 text, max 5 MiB) and list document metadata.
- `POST /api/v1/projects/:id/requirements`, `GET /api/v1/projects/:id/requirements` — create draft requirements and list them.
- `PATCH /api/v1/requirements/:id`, `GET /api/v1/requirements/:id/versions` — edit draft requirements and inspect prior versions.
- `GET /api/v1/artifacts/:id/versions?type=...` — inspect artifact version snapshots.
- `POST /api/v1/projects/:id/artifacts`, `GET /api/v1/projects/:id/artifacts` — create and list draft artifacts.
- `POST /api/v1/approvals`, `PATCH /api/v1/approvals/:id` — submit for review and record reviewer decisions.
- `PATCH /api/v1/users/:id/roles` — admin-only role assignment.
- `GET /api/v1/projects/:id/export?format=json|markdown|csv` — export project data without document bytes.
- `GET /api/v1/executions/:id` — read an existing execution record.
- `GET /api-docs` — Swagger UI for implemented APIs.

New accounts receive only the `user` role. Elevated roles must be assigned by an admin; for the initial local setup, an admin must be provisioned out of band in the JSON file. Role changes are reflected in newly issued JWTs, so users must log in again. Project access is limited to the owner and project members. AI workflow endpoints validate requests and return explicit `501 NOT_IMPLEMENTED` responses until Phase 5.

Uploaded file content is stored as base64 in the local JSON file and is excluded from API metadata responses and exports. The 5 MiB per-file limit does not make JSON storage suitable for production or large document collections.

## Verify

```powershell
npm run typecheck
npm test
```

Tests for environment parsing, JSON persistence, and the HTTP/auth foundation use isolated temporary files and repositories; no external database service is required. MongoDB integration is intentionally deferred.
