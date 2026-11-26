# AI Business Analyst Agent Backend

Node.js/TypeScript API with MongoDB persistence and asynchronous LangGraph workflows using structured outputs from OpenAI or Groq.

## Requirements

- Node.js 20.19 or newer within v20, or 22.3 or newer (the current development environment uses Node 22.19)
- npm

## Setup

From the `backend` directory in PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` in `.env` to a private random value of at least 32 characters. `MONGODB_URI` defaults to `mongodb://127.0.0.1:27017`, and `MONGODB_DATABASE` defaults to `ai_business_analyst_agent`. For MongoDB Atlas, replace the URI with the connection string from your Atlas cluster and keep the password private. If your configured DNS resolver blocks Atlas SRV lookups, optionally set `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8`; this changes DNS servers for the backend Node.js process only. The backend creates its collections and indexes on startup. If MongoDB is empty and the legacy file at `JSON_STORAGE_PATH` exists, its records are imported once; the JSON file is not used after that import. Keep `.env` private and never commit credentials or stored user data.

To email account and project notifications, administrator invitations, and password-reset links, set `EMAIL_PROVIDER=smtp` and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and `EMAIL_FROM`. Set `SMTP_USER` and `SMTP_PASS` when your mail server requires authentication. Administrator invitations include the administrator's short message and a single-use account-setup link; the administrator can still copy the link from the UI. If invitation email delivery fails, the setup link remains available in the UI and the delivery failure is shown explicitly. Registration, project membership, approval, decision, and approved-deliverable emails use formal templates; notification delivery failures are logged without undoing the related account or workflow change.

### Google sign-in setup

Create a Google OAuth 2.0 **Web application** client and set these values exactly:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/v1/auth/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`. The client secret must be the OAuth client secret from Google, not the client ID. Keep the secret private and restart the backend after changing `.env`.

For a fresh installation, optionally set `ADMIN_BOOTSTRAP_TOKEN` to a private random value of at least 32 characters. Register the intended administrator as a roleless user, sign in, and call `POST /api/v1/users/bootstrap-admin` with the token and that user's bearer token. Only one active administrator can be claimed, even when requests race. Bootstrap assigns the exclusive `admin` role to the registering account. The token is disabled when the environment variable is absent; remove it from the environment after bootstrap. Sign in again after bootstrap or role changes to receive updated claims. Admins can invite users with one-time setup links, reversibly deactivate/reactivate accounts, assign canonical roles, manage templates and project membership metadata, and review/export audit events. Password hashes, session versions, Google subjects, and project contents are not returned by admin listing endpoints.

AI workflows are optional at startup. Set `LLM_PROVIDER=openai` with `OPENAI_API_KEY` and `OPENAI_MODEL`, or set `LLM_PROVIDER=groq` with `GROQ_API_KEY` and `GROQ_MODEL`. The Groq model defaults to `openai/gpt-oss-120b`, which supports structured outputs. The OpenAI client connects to Groq's OpenAI-compatible Responses API when Groq is selected. Optional `GEMINI_API_KEY` and `INCEPTION_API_KEY` configure ordered per-node fallbacks after the selected primary provider; model defaults are `gemini-4-hydrogen` and `mercury-3`. Gemini and Inception use their OpenAI-compatible Chat Completions structured-output APIs. A provider request or schema-validation failure tries the next configured provider for that node; context validation errors occur before any provider call. The execution's model field updates to the provider that most recently returned a successful output, and workflow outputs remain drafts requiring human approval.

Fallbacks send the same node prompt and selected project/source context to each configured provider reached in the chain. Configure credentials only if your organization's data-sharing policy permits sending that information to Google or Inception. Inception has announced that Mercury API access will end after December 28, 2026, so treat it as a temporary fallback and migrate away before then. Do not send sensitive documents unless authorized to do so.

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

The server validates its environment and establishes a MongoDB connection before listening. An unavailable database or invalid stored records causes startup to fail with a non-zero exit code. The current repository layer keeps a process-local snapshot, so run one backend instance at a time; multi-instance coordination is not supported.

## Container

Build and run from the `backend` directory. Docker Desktop or Docker Engine is required.

```powershell
docker build -t ai-business-analyst-agent-backend:local .
docker run --rm --name ai-business-analyst-agent-backend `
  -p 3000:3000 `
  --env JWT_SECRET `
  --env MONGODB_URI `
  ai-business-analyst-agent-backend:local
```

Set `JWT_SECRET` and `MONGODB_URI` in the shell or inject them from a secret manager before running the container. To enable AI workflows, configure the selected provider's key (`OPENAI_API_KEY` or `GROQ_API_KEY`) and `LLM_PROVIDER` through the same secret mechanism. Optional fallbacks use `GEMINI_API_KEY` and `INCEPTION_API_KEY`. The image does not copy `.env` files. The process runs as the non-root `node` user and exposes port `3000`. A container health check calls `/api/v1/health/ready`; use `/api/v1/health/live` for process liveness.

The MongoDB connection must be reachable from the container. When using MongoDB Atlas, allow the deployment's outbound IP and use TLS in the connection string. The service currently supports one backend process because repository state is cached in memory; do not scale it horizontally.

## Smoke-test example

The following response was captured from the running backend during local startup verification. The request ID is generated per request.

```http
GET /api/v1/health/ready
HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,"data":{"status":"ready","storage":"mongodb"},"requestId":"c471050c-76e9-4323-9942-3c2f7a0da9b4"}
```

In PowerShell, check a running local or containerized instance with:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health/ready
```

## Endpoints

- `GET /api/v1/health/live` — process liveness.
- `POST /api/v1/auth/register` — create an account with no assigned roles. The registrant receives an account-created confirmation and active administrators receive a review request. The account can sign in but has no application permissions until an administrator assigns a role (email and password of 12–128 characters).
- `GET /api/v1/health/ready` — readiness, including a MongoDB ping.
- `POST /api/v1/auth/login` — return a short-lived JWT access token.
- `GET /api/v1/auth/me` — return the authenticated user; requires `Authorization: Bearer <token>`.
- `POST /api/v1/projects`, `GET /api/v1/projects`, `GET /api/v1/projects/:id` — create, list, and read accessible projects. Creation accepts a project brief with a business objective, in/out-of-scope descriptions, stakeholders, constraints, and desired outputs; these structured fields are included in project-context-only workflows.
- `PATCH /api/v1/projects/:id` — project-owner-only update of project name, description, and brief.
- `PATCH /api/v1/projects/:id/members` — project owner replaces project members.
- `POST /api/v1/projects/:id/documents`, `GET /api/v1/projects/:id/documents` — upload (PDF, DOCX, UTF-8 text, max 5 MiB) and list active document metadata. The project owner can use `?includeArchived=true`, `PATCH /api/v1/projects/:id/documents/:documentId/archive`, and `PATCH /api/v1/projects/:id/documents/:documentId/restore`. Archive is reversible and retains bytes; archived documents are excluded from workflows, default lists, and exports.
- `POST /api/v1/projects/:id/requirements`, `GET /api/v1/projects/:id/requirements` — create draft requirements and list them.
- `PATCH /api/v1/requirements/:id`, `GET /api/v1/requirements/:id/versions` — edit draft requirements and inspect prior versions.
- `GET /api/v1/artifacts/:id/versions?type=...` — inspect artifact version snapshots.
- `POST /api/v1/projects/:id/artifacts`, `GET /api/v1/projects/:id/artifacts` — create and list draft artifacts.
- `PATCH /api/v1/artifacts/:id` — revise an artifact, preserve its prior version, and return it to draft; edits are blocked while an approval is pending.
- `POST /api/v1/approvals`, `PATCH /api/v1/approvals/:id` — submit for review and record a decision with a required reason. Project Product Owners are emailed on submission; the submitter is emailed the decision and reason. A Delivery Lead email is sent only after approval of a risk, dependency, or implementation plan.
- `GET /api/v1/projects/:id/approvals`, `GET /api/v1/approvals/:id` — Product Owner approval queue and details. Only a Product Owner can decide; a submitter cannot review their own item. Approval links open the selected item after sign-in.
- `GET /api/v1/projects/:id/delivery-reviews`, `POST /api/v1/approvals/:id/delivery-feedback` — Delivery Lead queue for risk, dependency, and implementation-plan reviews and feedback. Feedback does not change approval decisions.
- `GET /api/v1/project-membership-invitations/:id`, `POST /api/v1/project-membership-invitations/:id/respond` — invited users can accept or reject a project membership invitation after signing in. Access is granted only after acceptance.
- `PATCH /api/v1/users/:id/roles` — admin-only role assignment or removal to pending access; stale role claims are rejected and the last active admin cannot be demoted.
- `POST /api/v1/users/bootstrap-admin` — one-time first-admin claim, enabled only when `ADMIN_BOOTSTRAP_TOKEN` is configured.
- `GET /api/v1/admin/users`, `POST /api/v1/admin/users/invitations`, `PATCH /api/v1/admin/users/:id/active` — safe paginated user directory, one-time account invitation links, and reversible account deactivation/reactivation. Invitations create inactive accounts; repeating an invitation for a still-pending account revokes its previous link and issues a new one. The invitee sets their password through the password-setup flow. Admins cannot deactivate themselves or the last active administrator; inactive users lose access immediately, including existing JWT sessions.
- `GET /api/v1/admin/project-access`, `PUT /api/v1/admin/project-access/:id/members` — admin-only project membership management. Adding a person creates a pending invitation; responses contain project metadata and invitation/email status, and access is granted only after acceptance. Administrators do not receive project-content access or reuse `project.read`.
- `GET /api/v1/templates?type=...` — list active templates for intake, requirements, epics/stories, acceptance criteria, or risks/roadmaps. `GET/POST /api/v1/admin/templates` and `PATCH /api/v1/admin/templates/:id` provide admin management; templates are deactivated rather than deleted. Intake templates may be selected at project creation; matching workflow templates add server-validated guidance to prompts without bypassing output schemas.
- `GET /api/v1/admin/audit-events`, `GET /api/v1/admin/audit-events/export?format=json|csv` — paginated append-only event history and full download. Account registration/lifecycle, roles, project/member/export, document, requirement, artifact, workflow, template, approval, and audit-export events are recorded. Audit details do not copy project brief text, document bytes, or template instructions. Events are retained indefinitely; there is no automatic purge or deletion endpoint.
- `GET /api/v1/projects/:id/export?format=json|markdown|csv` — Business Analyst-only project export without document bytes.
- `POST /api/v1/requirements/analyze`, `/requirements/extract`, `/stories/generate`, `/acceptance-criteria/generate`, `/requirements/validate`, `/risks/analyze`, `/roadmap/generate` — submit an authenticated, project-scoped workflow; returns `202` with an execution record.
- `GET /api/v1/executions/:id` — poll execution status and retrieve its result.
- `GET /api-docs` — Swagger UI for implemented APIs.

Self-registered email and Google accounts start with no roles and remain without application permissions until an administrator assigns one. The frontend displays an account-review screen while no roles are assigned. Role changes invalidate existing tokens, so users must sign in again after assignment. A first administrator can still be bootstrapped by registering, signing in, and calling `POST /api/v1/users/bootstrap-admin` with the configured one-time token. An administrator invitation creates an inactive account with the selected canonical role; its single-use, expiring setup link activates the account only after the invitee sets a password. The `admin` role is mutually exclusive with project roles. Authenticated requests validate the current account and role state in MongoDB; account deactivation revokes sessions immediately. Business Analysts and Product Owners can read business requirements and artifacts; Business Analysts and Delivery Leads can read delivery artifacts. Project content access requires the relevant permission and project ownership or active membership. Administrators do not receive project-content access; their dedicated project-access API is metadata-only. LangGraph workflows create drafts and cannot make approval decisions. Workflow processing runs in-process, is limited to 10 submissions per 15 minutes per client IP, and is not resumable after a process crash; a durable queue/checkpoint store is future work.

Uploaded file content is stored as base64 in MongoDB and is excluded from API metadata responses and exports. The MongoDB adapter stores each record in its own document to stay within MongoDB's per-document size limit.

## Verify

```powershell
npm run typecheck
npm test
```

Tests for environment parsing, the legacy JSON reader, the HTTP/auth APIs, and workflow execution use isolated temporary files and a fake provider; tests do not call OpenAI or require a MongoDB server. Run the backend against a local MongoDB instance or Atlas to verify database connectivity and persistence in your environment.

### Offline workflow evaluation evidence

| Dimension                | Evidence                                                                                   | Result and boundary                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Faithfulness             | Verbatim citation accepted; unsupported source quote fails validation.                     | Passes for the fixture; does not measure live-model faithfulness.           |
| Completeness and clarity | Expected requirement title/description/type and required fields are asserted.              | Basic acceptance checks pass; no semantic clarity score is claimed.         |
| Traceability             | Source document ID, execution ID, and requirement/story links are verified.                | Passes for the fixture.                                                     |
| Testability              | Generated acceptance criteria must retain Given/When/Then structure and requirement links. | Passes for the fixture.                                                     |
| Untrusted input          | Prompt-injection text remains in user content, separated from system instructions.         | Boundary is tested; this does not prove a live model will resist injection. |

These are deterministic fixture checks, not a live OpenAI model evaluation or a quality score; model output remains a draft until human approval. Workflow timeout, rate-limit, and connection failures are simulated without network calls.

Workflow submissions have no idempotency key, so retrying a submission may enqueue and bill for another run.

### Operations and future persistence

The service writes Pino JSON logs to stdout/stderr; collect them through the hosting platform and avoid enabling request-body logging. Terminate TLS at a trusted ingress or load balancer, expose only the API port, and inject secrets through the platform's secret manager. Use least-privilege MongoDB credentials, encrypted backups, and test restoration. The current storage does not support multiple backend instances or distributed coordination.

MongoDB indexes are created by the backend on startup. Existing JSON records are imported only when all MongoDB collections are empty; the source JSON file is retained as a backup and is never modified by MongoDB writes. After verifying the imported data, archive the JSON file securely because it contains password hashes and uploaded document content. If MongoDB already contains records, no automatic import is attempted.
