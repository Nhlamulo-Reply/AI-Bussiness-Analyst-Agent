# Low-Level Design (LLD)

## Overview

This LLD describes the layered backend design. The Phase 3 foundation now exists; project/domain layers and MongoDB repositories remain future implementation work.

## Request flow

```text
HTTP request
  -> Express router
  -> request validation middleware (Zod)
  -> auth middleware
  -> controller
  -> application service
  -> domain logic
  -> repository / storage adapter (temporary JSON file in Phase 3)
  -> response serializer
```

## Controller responsibilities

Each controller should:
- parse route params and query inputs
- validate request payloads
- call a service method
- map domain errors to API errors
- return consistent HTTP responses

## Service responsibilities

Services own use cases such as:
- `ProjectService.createProject`
- `DocumentService.uploadDocument`
- `RequirementService.extractRequirements`
- `ApprovalService.submitApproval`
- `ExportService.exportProject`

Each service should validate domain invariants before calling repositories or workflow orchestration.

## Repository responsibilities

Repositories isolate storage access for a single aggregate, for example:

- `ProjectRepository`
- `DocumentRepository`
- `RequirementRepository`
- `ApprovalRepository`
- `ExecutionRepository`

Repositories should manage:
- pagination
- filtering
- sort order
- ownership checks where needed
- safe update semantics

## Workflow execution components

### Workflow service
- validates job input
- persists execution metadata
- starts the graph
- tracks node state and final status

### Graph node contract
Each node receives typed workflow state and returns updated state, for example:

- `IntakeNode`
- `StakeholderNode`
- `RequirementExtractionNode`
- `GapDetectionNode`
- `StoryGenerationNode`
- `AcceptanceCriteriaNode`
- `CriticNode`
- `RiskDependencyNode`
- `RoadmapNode`
- `OutputValidatorNode`

Each node must:
- validate model output using Zod
- record assumptions, facts, and uncertainties explicitly
- preserve trace references to source passages when available

## Error model

Use a consistent error envelope:

```json
{
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

Use domain-specific error types for:
- unauthorized
- forbidden
- not found
- validation
- rate limited
- workflow not found
- workflow execution failed

## Logging and diagnostics

Use structured logs with:
- request ID
- execution ID
- operation name
- user ID / role
- project ID
- status code
- duration

The logs must not include tokens, raw passwords, or full sensitive document content.

## Persistence design expectations

The planned MongoDB collections should support:
- project ownership linkage
- per-artifact versions
- approval history
- workflow execution snapshots
- pagination-friendly indexes

The implementation should use a single database namespace, with collection names reflecting where resources live.

For the current Phase 3 backend, `JSON_STORAGE_PATH` points to a versioned JSON file. The MongoDB repository layout above is deferred and should replace the storage adapter in a later phase.

## LLD conclusion

This design provides a conventional layered backend structure that supports both standard API operations and the asynchronous AI workflow execution required by the project plan. It is suitable for a greenfield Node.js/TypeScript implementation and can be refined once the actual repository is available.
