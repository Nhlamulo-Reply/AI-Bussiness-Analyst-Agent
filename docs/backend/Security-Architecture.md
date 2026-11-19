# Security Architecture

## Objective

The backend must protect project data, human review processes, and AI-generated artifacts from unauthorized access, prompt manipulation, and unsafe execution patterns.

## Core security controls

### Identity and access
- Authenticated users via short-lived JWT bearer tokens
- Role model: `user`, `reviewer`, `admin`, optionally `project_owner`
- Project memberships and ownership checks on every project-scoped action
- Resource authorization enforced at service or controller layer
- Public registration assigns only the `user` role. An admin can assign roles through the role-management API; initial local admin provisioning is out-of-band for the temporary JSON store.
- Project access is limited to the owning user or an explicit project member; a global admin role does not bypass project membership.
- Only the project owner can replace the member list; added users must already be registered.
- Role claims are included in JWTs, so role changes apply to newly issued tokens and users must log in again.

### Input validation and request safety
- All inputs validated using Zod before controller/service logic executes
- Uploads are limited to PDF, DOCX, and UTF-8 text with a 5 MiB file limit, MIME/extension matching, and basic signature/content checks.
- File bytes are stored base64-encoded in the temporary JSON file and are omitted from metadata responses and exports.
- PDF, DOCX, and text contents are extracted for workflows and must remain untrusted input.

### Prompt injection defense
- Versioned system/task prompts are kept separate from user and document text and explicitly reject embedded instructions.
- Document contents and selected project data are sent to OpenAI when workflow requests execute; the Responses API call disables response storage. Callers must not submit data they are not authorized to share.
- Model output is schema-validated and cross-checked against project-scoped IDs and verbatim source excerpts before persistence.
- Generated results remain drafts. Source facts, assumptions, open questions, recommendations, and uncertainties are represented separately.

### Logging and secret handling
- Request IDs and execution IDs for traceability
- Secrets stored in environment variables or a secret manager
- Logs contain no tokens, passwords, API keys, or sensitive document content
- Request logs omit headers and bodies; sensitive field names are redacted.
- OpenAI API keys are optional environment configuration, are not logged, and must not be committed.
- The temporary JSON file contains account emails and password hashes. Keep it out of version control, restrict access to the local file, and do not use this single-process store as a production database.

### Rate limiting and HTTP security
- rate limits for authentication endpoints (10 requests per 15 minutes per client IP)
- security headers for browser clients
- bearer tokens are not stored in cookies
- TLS-only deployment in production

### Phase 3–5 implementation decisions
- Passwords are hashed with bcryptjs (cost factor 12) and are never returned by API responses.
- Access tokens expire after 900 seconds by default; the lifetime is environment-configurable within a bounded range.
- The JWT secret is required at startup and must be at least 32 characters.
- Environment values are validated before the server starts.

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
