# AI Business Analyst Agent Backend

Phase 3 backend foundation using Node.js, TypeScript, Express, temporary JSON-file storage, Zod and Jest/Supertest. MongoDB remains a later storage target.

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
- `GET /api-docs` — Swagger UI for the implemented foundation endpoints.

New accounts cannot grant themselves reviewer, admin, or project-owner roles. Reusable role and project-membership authorization middleware is in place for later project-scoped routes. No project CRUD or AI-analysis endpoints are implemented in this phase.

## Verify

```powershell
npm run typecheck
npm test
```

Tests for environment parsing, JSON persistence, and the HTTP/auth foundation use isolated temporary files and repositories; no external database service is required. MongoDB integration is intentionally deferred.
