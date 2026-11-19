# Data Flow Design

## Core request flow

```text
User / client
   |
   v
HTTP request to /api/v1/...
   |
   v
Request ID middleware
   |
   +--> Auth middleware
   +--> Validation middleware
   +--> Rate limit / security headers
   |
   v
Controller
   |
   v
Application service
   |
   +--> Repository / storage adapter (temporary JSON file in Phase 3)
   |
   +--> Workflow service (async jobs only)
               |
               v
           LangGraph graph
               |
               +--> provider adapter
               +--> schema validation
               +--> output persistence
               |
               v
          Execution record + draft artifacts
```

## AI workflow data flow

```text
Project + docs -> Intake node
                 -> Stakeholder node
                 -> Requirement extraction node
                 -> Gap detection node
                 -> Clarification routing if needed
                 -> Story generation node
                 -> Acceptance criteria node
                 -> Critic review node
                 -> Risk/dependency node
                 -> Roadmap node
                 -> Output validator -> persistence
```

## Data categories that must remain separate

The system should track and persist separate categories for:

- `source_facts`: statements directly supported by source documents or user-input facts
- `assumptions`: statements that fill missing business context
- `open_questions`: unresolved ambiguities or missing requirements
- `recommendations`: proposed actions or implementation options
- `uncertainties`: items that have weak or conflicting support

This separation is required to keep AI-generated suggestions reviewable and non-authoritative until approved.

## Traceability requirements

Each requirement or generated artifact should carry:

- source references
- project association
- document references
- execution ID
- author or generated-by metadata
- status: `draft`, `reviewed`, `approved`, `rejected`

## Data flow conclusion

The data-flow design supports both ordinary CRUD operations and long-running AI analysis while preserving auditability, versioning, and human approval checkpoints.

The current backend stores Phase 3 user data in the JSON file configured by `JSON_STORAGE_PATH`. MongoDB in the diagrams is the planned later persistence target.
