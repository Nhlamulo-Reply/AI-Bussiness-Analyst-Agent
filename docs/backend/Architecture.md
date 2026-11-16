# Backend Architecture

## Purpose

This document defines the architecture for the AI Business Analyst Agent backend in a greenfield implementation. The repository currently has no application code, so this design is a target architecture for the next implementation phase rather than a description of existing code.

## Architecture principles

- Modular monolith first; boundaries are clear enough to extract later if needed.
- HTTP route -> middleware -> controller -> service -> repository -> MongoDB.
- AI workflow execution is kept separate from normal request handling.
- All external input is validated with Zod.
- AI output is treated as draft and subject to human approval.
- Source facts, assumptions, open questions, and recommendations are tracked separately.

## Recommended runtime baseline

This is the design baseline for the implementation phase. The exact dependency versions must be confirmed during the scaffold step and pinned in `package.json`.

- Node.js: 20 LTS (recommended baseline)
- TypeScript: 5.x (strict mode enabled)
- Express.js: current stable supported by the selected Node.js version
- MongoDB driver: current stable MongoDB Node driver compatible with the chosen Node version
- LangGraph.js: selected package versions must match the chosen Node.js/TypeScript versions and must be installed only after compatibility verification
- LLM provider SDKs: OpenAI and/or Anthropic SDKs selected to match the chosen runtime

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
  +--> Domain services / repositories / MongoDB
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
- MongoDB repositories
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

## Async execution model

Long-running analysis jobs must not block request handling. The API contract is:

1. Client submits a request to an analysis endpoint.
2. Server creates a workflow execution record with status = `queued`.
3. Server returns an execution ID and a status URL.
4. A background worker or asynchronous workflow runner executes graph nodes.
5. Client polls `GET /api/v1/executions/:id` for status.
6. Results are persisted only after schema validation succeeds.

This keeps the API responsive while preserving traceability and auditability.

## Security model

- JWT or secure session tokens for authenticated users
- Role-based access control for user, reviewer, admin, and project owner roles
- Ownership checks on project-level resources
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
