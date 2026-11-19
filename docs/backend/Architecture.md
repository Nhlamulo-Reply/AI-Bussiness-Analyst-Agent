# Backend Architecture

## Purpose

This document defines the architecture for the AI Business Analyst Agent backend. The implemented API and LangGraph workflows use a temporary JSON file store; MongoDB remains the planned later persistence layer.

## Architecture principles

- Modular monolith first; boundaries are clear enough to extract later if needed.
- HTTP route -> middleware -> controller -> service -> repository -> storage adapter.
- The current JSON file adapter is temporary and should be replaceable by MongoDB without changing API or domain services.
- AI workflow execution is kept separate from normal request handling.
- All external input is validated with Zod.
- AI output is treated as draft and subject to human approval.
- Source facts, assumptions, open questions, and recommendations are tracked separately.

## Implemented runtime baseline

The backend foundation is implemented under `backend/`. Dependency versions are pinned in its `package.json`.

- Node.js: 20.19+ on v20 or 22.3+; development verified with Node.js 22.19
- TypeScript: 5.9.3 (strict mode enabled)
- Express.js: 5.3.0
- Persistence: version-2 JSON file at `JSON_STORAGE_PATH`, including version-1 migration (temporary choice); MongoDB adapter deferred
- Zod: 4.6.7
- LangGraph.js 1.7.5 and OpenAI SDK 6.49.0; workflow outputs use Zod structured schemas
- Docker image: multi-stage Node.js 22 Alpine build; runtime runs as the non-root `node` user

## High-level architecture

```text
Client
  |
  v
Express API (v1)
  |-- auth + rbac + request id + validation + rate limit + logging
  v
Controllers
  |
  v
Application services
  |
  +--> Domain services / repositories / JSON file (temporary)
  |
  +--> Workflow service
          |
          v
      LangGraph workflow
          |-- provider adapter
          |-- document parser and storage
          |-- output validators
          |
          +--> persistence + execution records
```

## Module boundaries

The backend should be organized into these conceptual areas:

### 1. API layer
- Routes
- Controllers
- Input validation
- Response shaping
- Request correlation

### 2. Application layer
- Project service
- Requirement service
- Approval service
- Export service
- Workflow orchestration service

### 3. Domain layer
- Core business rules for requirements, stories, approvals, risks, and versions
- Ownership guard logic
- Business validation rules

### 4. Data access layer
- Storage adapter and repositories (currently JSON-file backed)
- Planned MongoDB repositories
- Query builders and pagination utilities
- Document storage adapters

### 5. AI and workflow layer
- LangGraph graph definitions
- Typed workflow state
- Node implementations
- Provider abstraction
- Retry / timeout strategy

### 6. Shared platform concerns
- config
- logger
- errors
- validation
- security middleware
- async job tracking

## Asynchronous execution model

Long-running analysis jobs must not block request handling. The planned API contract is:

1. Client submits a request to an analysis endpoint.
2. Server creates a workflow execution record with status = `queued`.
3. Server returns `202 Accepted` with an execution ID.
4. An in-process asynchronous runner executes graph nodes and persists node states.
5. Client polls `GET /api/v1/executions/:id` for status.
6. Results are persisted only after schema validation succeeds.

This keeps the API responsive while preserving traceability and auditability.

Workflow endpoints return `503 AI_PROVIDER_NOT_CONFIGURED` if `OPENAI_API_KEY` is absent. Runs are in-process and cannot resume after a crash; graceful shutdown waits for active runs. The JSON adapter remains single-process and is not a durable job queue.

## Container and operations boundary

`backend/Dockerfile` packages the compiled service, installs only production dependencies in the runtime image, and stores the JSON file under the mounted `/data` volume. Its health check calls `/api/v1/health/ready`; `/api/v1/health/live` reports process liveness.

The container is a packaging and single-instance deployment option, not a production-scale persistence solution. Keep one replica and a persistent volume for `/data`; do not share the JSON file between containers. Store `JWT_SECRET` and optional `OPENAI_API_KEY` in the hosting platform's secret manager, terminate TLS at a trusted ingress, and collect structured stdout/stderr logs. MongoDB configuration, migration, and backup operations remain future work until its adapter is implemented and approved.

## Security model

- JWT or secure session tokens for authenticated users
- Role-based access control for user, reviewer, admin, and project owner roles
- Ownership checks on project-level resources
- Only project owners can replace a project's member list; project resources are otherwise restricted to owners and members
- Elevated user roles require an admin-only role update; initial admin provisioning is out-of-band for the temporary JSON store
- Uploaded documents and extracted text are untrusted; versioned prompts reject embedded instructions, while output validators verify schemas, ownership-scoped references, and verbatim source citations.
- Selected project/document context is sent to OpenAI when a workflow runs. The Responses API call sets `store: false`; users must avoid submitting content they are not authorized to share.
- TLS termination in deployment environment
- No secrets in logs or source control

## Observability and traceability

Every request should include:

- request ID
- correlation ID
- execution ID when AI workflows are involved
- user context (without exposing secrets)

Each AI execution should persist:

- execution ID
- project ID
- workflow name
- node statuses
- timestamps
- provider model/version
- token and latency metrics when available
- error details without secret leakage

## Delivery constraints

- No AI results may be treated as final without human approval.
- All generated artifacts must distinguish source facts from assumptions and recommendations.
- Graph nodes must be explicit and typed.
- Workflow input and output must be schema-validated.
- The implementation must abide by the mandatory Phase approval gates in the project plan.
- The implemented backend provides the server, temporary JSON storage lifecycle, health/readiness endpoints, request IDs, structured logging, validation, error handling, JWT authentication, RBAC/project-access middleware, rate limiting, security headers, Swagger UI, project/domain APIs, asynchronous LangGraph workflows, human review/versioning/export, and offline test evidence. Docker packaging is available for a single instance. MongoDB and cloud-provider-specific deployment remain deferred.
