# High-Level Design (HLD)

## Overview

This HLD covers the backend design for the AI Business Analyst Agent as a modular monolith. The implementation is designed to support requirements capture, document processing, AI workflow execution, review, approvals, export, and auditability.

## Functional view

The system supports the following broad user-facing flows:

1. Create and manage projects.
2. Upload BRDs and supporting documents.
3. Extract and review business, functional, and non-functional requirements.
4. Detect ambiguity, gaps, and conflicts.
5. Generate epics, stories, and acceptance criteria.
6. Review quality and risk.
7. Produce implementation plan suggestions.
8. Submit artifacts for approval.
9. Export approved or draft artifacts for downstream use.

## Non-functional requirements addressed by the design

- Secure access control and ownership rules
- Traceable AI execution with execution IDs
- Typed graph workflow state and validation
- Schema validation before persistence
- Async processing for analysis jobs
- Clear separation between source facts and AI suggestions
- Record-level versioning and review history

## Service decomposition

### Project module
Responsibilities:
- project creation
- project membership and ownership
- project list and detail retrieval
- project scoping for requirements and artifacts

### Document module
Responsibilities:
- upload validation
- document metadata persistence
- storage adapter integration
- text extraction and sanitization
- untrusted-content handling

### Requirements module
Responsibilities:
- requirement CRUD
- extraction job orchestration
- quality review
- edit and version history

### Workflow execution module
Responsibilities:
- execution lifecycle
- status tracking
- retry and timeout controls
- checkpoint capture
- provider integration

### Approval and versioning module
Responsibilities:
- approval submissions
- reviewer decisions
- history and change tracking
- export status labeling

## Deployment model

The backend runs as a single service with separate internal modules. `backend/Dockerfile` provides a multi-stage Node.js 22 image intended to run behind a reverse proxy or load balancer. The image runs as a non-root user and expects the JSON storage volume at `/data`.

### Local development
- `npm install`
- `.env` file with local startup configuration (never copy it into a container image)
- temporary JSON file storage configured through `JSON_STORAGE_PATH`

### Production deployment
- containerized app with a persistent `/data` volume and exactly one replica while JSON storage is used
- secret manager for `JWT_SECRET` and optional `OPENAI_API_KEY`
- TLS termination at a trusted ingress, with readiness `/api/v1/health/ready` and liveness `/api/v1/health/live`
- structured logs collected from stdout/stderr; do not log document bodies or credentials
- encrypted, access-controlled JSON-volume backups and restoration drills

The current JSON adapter is temporary, single-process storage and does not provide multi-replica coordination or point-in-time recovery. MongoDB is not a current runtime requirement. Before a production migration, implement and approve its adapter, apply the indexes described in `Database-Design.md`, enable encrypted automated backups and point-in-time recovery where supported, and test restores. Cloud-provider-specific deployment steps are intentionally left for the hosting-target decision.

## Risks and mitigations

### Prompt injection risk
Mitigation: treat uploaded text as untrusted; isolate system prompts from user content; validate model output before persistence.

### Unclear or conflicting requirements
Mitigation: separate source facts from assumptions and open questions; route the workflow to clarification when a requirement is insufficient.

### Approval bypass
Mitigation: enforce RBAC and project ownership; reviewers edit approvals only within policy constraints.

### Long-running jobs
Mitigation: queue or async execution model with status polling and persisted execution state.

## HLD conclusion

This design provides a secure, reviewable, and auditable backend foundation for a greenfield implementation. It aligns with the project plan and leaves room for controlled extension once actual repository code exists and the user approves the next implementation phase.
