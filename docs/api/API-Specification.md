# API Specification (Draft)

## Base URL

`/api/v1`

## Common response patterns

### Success response

```json
{
  "success": true,
  "data": {},
  "requestId": "req_123"
}
```

### Error response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload is invalid.",
    "details": [
      {
        "field": "projectName",
        "reason": "Required"
      }
    ],
    "requestId": "req_123"
  }
}
```

## Core endpoints

### `POST /api/v1/projects`
Creates a project.

Request body:
```json
{
  "name": "AI Business Analyst Agent",
  "description": "Project description"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "project_123",
    "name": "AI Business Analyst Agent",
    "status": "active"
  }
}
```

### `GET /api/v1/projects`
Lists accessible projects with pagination.

Query params:
- `page`
- `limit`
- `sort`

### `GET /api/v1/projects/:id`
Returns a project record and metadata.

### `POST /api/v1/projects/:id/documents`
Uploads a BRD or supporting document.

Request:
- multipart/form-data
- file upload
- optional document metadata

### `POST /api/v1/requirements/analyze`
Starts a requirement analysis workflow with asynchronous execution.

### `POST /api/v1/requirements/extract`
Starts a requirement extraction workflow.

### `GET /api/v1/projects/:id/requirements`
Lists project requirements with pagination.

### `PATCH /api/v1/requirements/:id`
Edits a requirement.

### `POST /api/v1/stories/generate`
Requests story generation.

### `POST /api/v1/acceptance-criteria/generate`
Requests acceptance criteria generation.

### `POST /api/v1/requirements/validate`
Requests a quality review.

### `POST /api/v1/risks/analyze`
Requests risk analysis.

### `POST /api/v1/roadmap/generate`
Requests roadmap generation.

### `POST /api/v1/approvals`
Submits an artifact for approval.

### `PATCH /api/v1/approvals/:id`
Approves, rejects, or requests changes.

### `GET /api/v1/projects/:id/export`
Exports selected project artifacts as JSON, Markdown, or CSV.

## Execution tracking endpoints

### `GET /api/v1/executions/:id`
Returns workflow execution status and current node state.

Response example:
```json
{
  "success": true,
  "data": {
    "id": "exec_123",
    "status": "running",
    "workflowName": "requirements-analysis",
    "currentNode": "RequirementExtractionNode",
    "startedAt": "2026-11-16T10:00:00Z"
  }
}
```

## OpenAPI note

This is a draft contract and should be formalized in the implemented backend with a real OpenAPI document once the scaffold is created. The final Swagger/OpenAPI file must match the actual backend endpoints and schemas at implementation time.
