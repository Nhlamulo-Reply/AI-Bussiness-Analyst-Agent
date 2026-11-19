# Database Design (MongoDB)

> **Interim implementation note (2026-11-17):** the current Phase 3 backend uses a local JSON file configured by `JSON_STORAGE_PATH`. This document describes the planned MongoDB target for a later phase; MongoDB is not currently connected or required to run the backend.

## Database strategy

The proposed system uses MongoDB as the primary persistence layer, with document collections designed to support project ownership, nested requirement structures, reviews, workflow execution state, and version history.

## Core collections

### `users`
Stores user identity and roles.

```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "passwordHash": "hashed-value",
  "firstName": "Jane",
  "lastName": "Doe",
  "roles": ["user", "reviewer"],
  "createdAt": "2026-11-16T10:00:00Z",
  "updatedAt": "2026-11-16T10:00:00Z"
}
```

Recommended indexes:
- `email` unique
- `roles`

### `projects`
Stores high-level project context.

```json
{
  "_id": "ObjectId",
  "name": "AI Business Analyst Agent",
  "description": "Project description",
  "ownerUserId": "ObjectId",
  "members": ["ObjectId"],
  "status": "active",
  "createdAt": "2026-11-16T10:00:00Z",
  "updatedAt": "2026-11-16T10:00:00Z"
}
```

Recommended indexes:
- `ownerUserId`
- `members`
- `status`

### `documents`
Stores uploaded BRDs or supporting documents.

```json
{
  "_id": "ObjectId",
  "projectId": "ObjectId",
  "uploadedByUserId": "ObjectId",
  "fileName": "brd.pdf",
  "storageKey": "projects/123/documents/brd.pdf",
  "mimeType": "application/pdf",
  "status": "uploaded",
  "createdAt": "2026-11-16T10:00:00Z"
}
```

Recommended indexes:
- `projectId`
- `uploadedByUserId`

### `requirements`
Stores structured business, functional, and non-functional requirements.

```json
{
  "_id": "ObjectId",
  "projectId": "ObjectId",
  "title": "User can submit a project brief",
  "type": "functional",
  "status": "draft",
  "sourceFacts": [],
  "assumptions": [],
  "openQuestions": [],
  "traceability": {
    "documentIds": ["ObjectId"],
    "executionId": "ObjectId"
  },
  "version": 1,
  "createdAt": "2026-11-16T10:00:00Z",
  "updatedAt": "2026-11-16T10:00:00Z"
}
```

Recommended indexes:
- `projectId`
- `type`
- `status`
- `version`

### `epics` and `stories`
Stores generated epics and stories linked to requirement IDs.

Recommended indexes:
- `projectId`
- `requirementIds`
- `status`

### `approvals`
Stores review and approval history.

```json
{
  "_id": "ObjectId",
  "projectId": "ObjectId",
  "artifactType": "requirement",
  "artifactId": "ObjectId",
  "reviewerUserId": "ObjectId",
  "decision": "approved",
  "comments": "Looks complete",
  "createdAt": "2026-11-16T10:00:00Z"
}
```

Recommended indexes:
- `artifactType` + `artifactId`
- `reviewerUserId`
- `decision`

### `workflow_executions`
Stores execution metadata for LangGraph runs.

```json
{
  "_id": "ObjectId",
  "projectId": "ObjectId",
  "workflowName": "requirements-analysis",
  "status": "running",
  "nodeStates": [
    {
      "node": "RequirementExtractionNode",
      "status": "completed",
      "startedAt": "2026-11-16T10:00:00Z",
      "completedAt": "2026-11-16T10:00:00Z"
    }
  ],
  "executionId": "uuid",
  "createdAt": "2026-11-16T10:00:00Z",
  "updatedAt": "2026-11-16T10:00:00Z"
}
```

Recommended indexes:
- `projectId`
- `status`
- `executionId` unique
- `createdAt`

## Ownership and access model

Every project-owned collection should include a project-level ownership field or a direct project reference when relevant. Requirement, story, approval, and document resources should enforce project membership and owner/reviewer permissions.

## Data retention and deletion

The implementation should define:
- deletion policy for uploaded documents
- retention for execution records and approval history
- archive strategy for rejected or superseded artifacts
- soft-delete semantics where appropriate

## Database design conclusion

This MongoDB design supports the required project, requirement, review, and execution tracking model without overcomplicating the initial implementation. It is intentionally aligned to the modular monolith design and is ready to be adapted in the actual scaffold phase.
