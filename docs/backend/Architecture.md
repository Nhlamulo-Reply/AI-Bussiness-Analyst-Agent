# Backend Architecture

## Purpose

This document defines the architecture for the AI Business Analyst Agent backend. The implemented Phase 3 foundation and Phase 4 domain APIs use a temporary JSON file store; MongoDB remains the planned later persistence layer.

## Architecture principles

- Modular monolith first; boundaries are clear enough to extract later if needed.
- HTTP route -> middleware -> controller -> service -> repository -> storage adapter.
- The current JSON file adapter is temporary and should be replaceable by MongoDB without changing API or domain services.
- AI workflow execution is kept separate from normal request handling.
- All external input is validated with Zod.
- AI output is treated as draft and subject to human approval.
- Source facts, assumptions, open questions, and recommendations are tracked separately.

## Implemented runtime baseline (Phases 3 and 4)

The backend foundation is implemented under `backend/`. Dependency versions are pinned in its `package.json`.

- Node.js: 20.19 or newer; development verified with Node.js 22.19
- TypeScript: 5.9.3 (strict mode enabled)
- Express.js: 5.3.0
- Persistence: version-2 JSON file at `JSON_STORAGE_PATH`, including version-1 migration (temporary choice); MongoDB adapter deferred
- Zod: 4.6.7
- LangGraph.js and LLM provider SDKs: deferred to Phase 5; the current AI workflow routes return `501 NOT_IMPLEMENTED`

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

## Planned async execution model (not implemented)

Long-running analysis jobs must not block request handling. The planned API contract is:

1. Client submits a request to an analysis endpoint.
2. Server creates a workflow execution record with status = `queued`.
3. Server returns an execution ID and a status URL.
4. A background worker or asynchronous workflow runner executes graph nodes.
5. Client polls `GET /api/v1/executions/:id` for status.
6. Results are persisted only after schema validation succeeds.

This keeps the API responsive while preserving traceability and auditability.

The current analysis/generation endpoints are explicit Phase 5 placeholders. They validate project access and return `501 NOT_IMPLEMENTED`; they do not create executions or return fabricated results. `GET /api/v1/executions/:id` reads a persisted record if one exists.

## Security model

- JWT or secure session tokens for authenticated users
- Role-based access control for user, reviewer, admin, and project owner roles
- Ownership checks on project-level resources
- Only project owners can replace a project's member list; project resources are otherwise restricted to owners and members
- Elevated user roles require an admin-only role update; initial admin provisioning is out-of-band for the temporary JSON store
- Safe handling of uploaded document text and prompt-injection filtering
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
- Phases 3 and 4 provide the server, temporary JSON storage lifecycle, health/readiness endpoints, request IDs, structured logging, validation, error handling, JWT authentication, RBAC/project-access middleware, rate limiting, security headers, Swagger UI, and project/domain APIs. MongoDB and LangGraph workflows remain deferred.
