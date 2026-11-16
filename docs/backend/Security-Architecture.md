# Security Architecture

## Objective

The backend must protect project data, human review processes, and AI-generated artifacts from unauthorized access, prompt manipulation, and unsafe execution patterns.

## Core security controls

### Identity and access
- Authenticated users via JWT or secure session tokens
- Role model: `user`, `reviewer`, `admin`, optionally `project_owner`
- Project memberships and ownership checks on every project-scoped action
- Resource authorization enforced at service or controller layer

### Input validation and request safety
- All inputs validated using Zod before controller/service logic executes
- Uploaded file types and sizes limited and validated
- Document content treated as untrusted and sanitized before analysis

### Prompt injection defense
- System prompts are kept separate from user or document text
- Document content is not allowed to override workflow rules
- Output is validated against schema and business constraints before persistence
- Source facts, assumptions, and uncertainties are persisted separately so that generated recommendations cannot be mistaken for facts

### Logging and secret handling
- Request IDs and execution IDs for traceability
- Secrets stored in environment variables or a secret manager
- Logs contain no tokens, passwords, API keys, or sensitive document content

### Rate limiting and HTTP security
- rate limits for authentication and analysis endpoints
- security headers for browser clients
- secure cookies and token storage settings
- TLS-only deployment in production

## Approval and human-in-the-loop model

AI-generated content should never be treated as final without reviewer approval. The approval flow must include:

- before/after artifact state
- reviewer identity
- timestamp
- decision reason or comments
- version tracking

Only authorized roles may approve or reject artifacts, and policy should prevent unauthorized approval or self-approval where applicable.

## Data minimization and retention

- Only necessary project metadata and supporting document references should be stored
- Document text should be stored in a controlled and auditable way
- Retention/deletion rules should be documented and implemented as part of the operational design

## Security conclusion

This security architecture aligns with the mandatory project rules: treat uploaded content as untrusted, separate facts from AI recommendations, enforce authorization consistently, track execution and approval history, and protect non-human workflows from unsafe prompt injections and invalid business state.
