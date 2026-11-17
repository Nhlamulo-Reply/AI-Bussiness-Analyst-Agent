# AI Business Analyst Agent Backend

Phase 3 backend foundation using Node.js, TypeScript, Express, MongoDB, Zod and Jest/Supertest.

## Requirements

- Node.js 20.19 or newer (the current development environment uses Node 22.19)
- npm
- MongoDB reachable by the configured URI

## Setup

From the `backend` directory in PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` in `.env` to a private random value of at least 32 characters. Keep `.env` private and never commit credentials.

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

The server validates its environment, connects to MongoDB, verifies the connection, and creates the unique user-email index before listening. Startup fails with a non-zero exit code if configuration or MongoDB is invalid/unavailable.

## Endpoints

- `GET /api/v1/health/live` — process liveness.
- `GET /api/v1/health/ready` — readiness, including a MongoDB ping.
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

Tests for environment parsing and the HTTP/auth foundation use isolated repositories; they do not require a live MongoDB instance. MongoDB connection behavior is exercised by the server's real startup/readiness paths when a database is configured.
