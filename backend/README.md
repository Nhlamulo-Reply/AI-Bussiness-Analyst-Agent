# AI Business Analyst Agent Backend

Node.js/TypeScript API with temporary JSON-file storage and asynchronous LangGraph workflows using OpenAI structured outputs. MongoDB remains a later storage target.

## Requirements

- Node.js 20.19 or newer within v20, or 22.3 or newer (the current development environment uses Node 22.19)
- npm

## Setup

From the `backend` directory in PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` in `.env` to a private random value of at least 32 characters. `JSON_STORAGE_PATH` defaults to `./data/ai-business-analyst.json`, relative to the backend working directory. Keep `.env` private and never commit credentials or stored user data.

Set `OPENAI_API_KEY` locally to enable AI workflows; it is optional at startup. `OPENAI_MODEL` defaults to `gpt-6-luna` and can be changed to a model available to your OpenAI account. Workflow requests send the selected source/project context to OpenAI using structured outputs with response storage disabled. Do not send sensitive documents unless authorized to do so.

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

## Container

Build and run from the `backend` directory. Docker Desktop or Docker Engine is required.

```powershell
docker build -t ai-business-analyst-agent-backend:local .
docker volume create ai-business-analyst-data
docker run --rm --name ai-business-analyst-agent-backend `
  -p 3000:3000 `
  --mount type=volume,source=ai-business-analyst-data,target=/data `
  --env JWT_SECRET `
  ai-business-analyst-agent-backend:local
```

Set `JWT_SECRET` in the shell or inject it from a secret manager before running the container. To enable AI workflows, separately configure `OPENAI_API_KEY` through the same secret mechanism and pass `--env OPENAI_API_KEY`. The image does not copy `.env` files. The process runs as the non-root `node` user, stores its JSON file under `/data`, and exposes port `3000`. A container health check calls `/api/v1/health/ready`; use `/api/v1/health/live` for process liveness.

Keep the named `/data` volume across container replacement. This JSON-backed service is single-process and supports one replica only; it is not production-ready for horizontally scaled or ephemeral-storage deployments. Do not mount the same JSON file into multiple containers.

## Smoke-test example

The following response was captured from the running backend during local startup verification. The request ID is generated per request.

```http
GET /api/v1/health/ready
HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,"data":{"status":"ready","storage":"json"},"requestId":"c471050c-76e9-4323-9942-3c2f7a0da9b4"}
```

In PowerShell, check a running local or containerized instance with:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health/ready
```

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
- `PATCH /api/v1/artifacts/:id` — revise an artifact, preserve its prior version, and return it to draft; edits are blocked while an approval is pending.
- `POST /api/v1/approvals`, `PATCH /api/v1/approvals/:id` — submit for review and record reviewer decisions.
- `PATCH /api/v1/users/:id/roles` — admin-only role assignment.
- `GET /api/v1/projects/:id/export?format=json|markdown|csv` — export project data without document bytes.
- `POST /api/v1/requirements/analyze`, `/requirements/extract`, `/stories/generate`, `/acceptance-criteria/generate`, `/requirements/validate`, `/risks/analyze`, `/roadmap/generate` — submit an authenticated, project-scoped workflow; returns `202` with an execution record.
- `GET /api/v1/executions/:id` — poll execution status and retrieve its result.
- `GET /api-docs` — Swagger UI for implemented APIs.

New accounts receive only the `user` role. Elevated roles must be assigned by an admin; for the initial local setup, an admin must be provisioned out of band in the JSON file. Role changes are reflected in newly issued JWTs, so users must log in again. Project access is limited to the owner and project members. Workflow processing runs in-process, is limited to 10 submissions per 15 minutes per client IP, and is not resumable after a process crash; a durable queue/checkpoint store is future work.

Uploaded file content is stored as base64 in the local JSON file and is excluded from API metadata responses and exports. The 5 MiB per-file limit does not make JSON storage suitable for production or large document collections.

## Verify

```powershell
npm run typecheck
npm test
```

Tests for environment parsing, JSON persistence, the HTTP/auth APIs, and workflow execution use isolated temporary files and a fake provider; tests do not call OpenAI. MongoDB integration is intentionally deferred.

### Offline workflow evaluation evidence

| Dimension | Evidence | Result and boundary |
|---|---|---|
| Faithfulness | Verbatim citation accepted; unsupported source quote fails validation. | Passes for the fixture; does not measure live-model faithfulness. |
| Completeness and clarity | Expected requirement title/description/type and required fields are asserted. | Basic acceptance checks pass; no semantic clarity score is claimed. |
| Traceability | Source document ID, execution ID, and requirement/story links are verified. | Passes for the fixture. |
| Testability | Generated acceptance criteria must retain Given/When/Then structure and requirement links. | Passes for the fixture. |
| Untrusted input | Prompt-injection text remains in user content, separated from system instructions. | Boundary is tested; this does not prove a live model will resist injection. |

These are deterministic fixture checks, not a live OpenAI model evaluation or a quality score; model output remains a draft until human approval. Workflow timeout, rate-limit, and connection failures are simulated without network calls.

Workflow submissions have no idempotency key, so retrying a submission may enqueue and bill for another run. MongoDB repository tests are not applicable until the deferred MongoDB adapter is approved and implemented.

### Operations and future persistence

The service writes Pino JSON logs to stdout/stderr; collect them through the hosting platform and avoid enabling request-body logging. Terminate TLS at a trusted ingress or load balancer, expose only the API port, and inject secrets through the platform's secret manager. Back up the JSON file only from a consistent copy or volume snapshot, encrypt backups, restrict access (the file contains password hashes and uploaded document content), and test restoration. The current storage does not provide point-in-time recovery or multi-replica coordination.

MongoDB is not part of this image and no MongoDB service is needed today. Before adopting it, implement and approve the MongoDB adapter/migration, apply the indexes in `docs/backend/Database-Design.md`, use TLS and least-privilege credentials, enable automated encrypted backups with point-in-time recovery where available, and perform restore drills. Deployment to a specific cloud platform remains a separate decision.
