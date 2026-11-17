# Component Design

## System overview

The backend is a modular monolith with distinct component groups for API handling, application logic, persistence, workflow orchestration, and integrations.

## Component map

```text
+-------------------------+
| HTTP/API Layer          |
| Routes / Controllers    |
+-----------+-------------+
            |
            v
+-------------------------+
| Application Services     |
| Project, Document,      |
| Requirement, Approval,  |
| Export, Execution        |
+-----------+-------------+
            |
            v
+-------------------------+
| Domain Logic            |
| Validation, ownership,  |
| approval rules, rules  |
| for generated content  |
+-----------+-------------+
            |
            v
+-------------------------+
| Data Access Layer       |
| Mongo repositories      |
| pagination + queries   |
+-----------+-------------+
            |
            v
+-------------------------+
| Workflow Layer          |
| LangGraph graphs        |
| node execution          |
| provider adapter        |
+-----------+-------------+
            |
            v
+-------------------------+
| External Integrations   |
| MongoDB, LLM provider, |
| storage backend         |
+-------------------------+
```

## Component responsibilities

### API Gateway / Express app
- mounts versioned API routes under `/api/v1`
- installs middleware for logging, rate limiting, validation, auth, errors
- ensures secure HTTP defaults

### Auth and RBAC component
- user identity validation
- role enforcement
- project ownership checks
- approval permission checks

### Project service
- create project
- manage project members
- list and retrieve projects
- enforce project-level access

### Document service
- upload validation
- metadata persistence
- link document to project
- text extraction and sanitization

### Requirements service
- manage requirement lifecycle
- trigger extraction or analysis jobs
- review quality and traceability
- support edits and versions

### Workflow orchestration service
- create execution records
- invoke LangGraph graph
- collect node-level results
- store final output and status

### Export service
- generate JSON, Markdown, and CSV exports
- label draft vs approved status
- include metadata and provenance notes

## Dependency design

- Application services depend on repositories and workflow interfaces.
- Repositories depend on a storage adapter. Phase 3 currently uses a temporary JSON-file adapter; MongoDB is the planned later adapter.
- Workflow nodes depend on the LLM provider adapter and schema validation layer.
- Shared middleware depends only on config and logging utilities.

## Design note

The architecture does not assume an existing repository layout. It is a component blueprint for a greenfield implementation and must be adapted to the actual repo once the backend is scaffolded.

The current implementation uses `backend/src/config/storage.ts` as the temporary JSON-file adapter. MongoDB-specific collection/index decisions below remain the planned target, not the current runtime behavior.
