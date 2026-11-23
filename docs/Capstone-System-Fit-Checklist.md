# Capstone System-Fit Checklist

**Review date:** 2026-11-23  
**Source:** [Capstone Project 02](<../Capstone_02_ai-business-analyst-agent (1).docx>)  
**Review scope:** Current repository working tree, implementation documentation, automated-test definitions/results recorded earlier in this session, and the shared frontend page. This is a requirements-fit review, not a security audit or production certification.

## Executive verdict

**The system does not yet satisfy every Capstone expectation.** It is a substantial working MVP: it has authentication, project-scoped data, document parsing, seven asynchronous AI workflows, editable/versioned requirements and artifacts, human approvals, exports, OpenAPI documentation, and automated tests.

The largest remaining gaps are:

1. **Persistence differs from the Capstone default:** the running service uses a single-process JSON file; MongoDB is designed/documented as future work, not implemented.
2. **Plain-language intake is incomplete:** a project description can hold free text, but requirement analysis/extraction workflows require at least one uploaded document.
3. **Privacy lifecycle is incomplete:** document deletion/retention controls are absent, and the backend defaults document workflows to all project documents when document IDs are omitted. The UI requires selection and confirmation, but that policy is not enforced by the API.
4. **Administrative/audit scope is incomplete:** admins can assign roles, but there is no user-management, template-management, or dedicated audit-history capability. Initial admin provisioning is out of band.
5. **AI output scope is narrower than the Capstone:** no generated epics, no enforced story template or negative/boundary scenario coverage, and no per-requirement confidence field.
6. **Provider/deployment/evaluation differences remain:** the configured providers are OpenAI and Groq rather than Claude and OpenAI; there is no live-provider quality evaluation or cloud-specific deployment evidence.

The current working tree also contains uncommitted implementation changes. The checklist describes that working-tree snapshot, not a released/committed build.

## Status key

- [x] **Implemented** — supported by current code and/or tests.
- [~] **Partial** — some of the expectation exists, but an identified part is missing or constrained.
- [ ] **Gap** — no implementation was found for the stated expectation.
- [?] **Unverified** — depends on coach approval, live deployment, credentials, or evidence not present in the repository.

## 1. Product and business-analysis workflow

- [~] **Capture the business problem and project context.** Project creation stores a name and a description, but not separate business objective, scope, stakeholders, constraints, or desired-output fields. See [project API](../backend/src/modules/projects/project.routes.ts) and [project overview](../frontend/src/pages/ProjectOverviewPage.tsx).
- [ ] **Submit plain-language business problems without a BRD.** The Capstone acceptance criterion allows a natural-language problem. Current analysis/extraction requires source documents; the project description alone cannot start those workflows. See [workflow service](../backend/src/workflows/workflow-service.ts) and [workflow input validation](../backend/src/workflows/workflow-graph.ts).
- [x] **Upload and parse BRD/supporting files.** The system accepts PDF, DOCX, and UTF-8 TXT up to 5 MiB and extracts text for workflows. See [document extraction](../backend/src/integrations/documents/text-extractor.ts), [project routes](../backend/src/modules/projects/project.routes.ts), and [API specification](api/API-Specification.md).
- [~] **Produce structured, uniquely identified, traceable requirements.** Requirements have generated IDs, type, priority, source facts/document links, assumptions, open questions, and versions. A per-requirement confidence indicator is not part of the schema; uncertainty is represented at workflow-result level. See [domain schemas](../backend/src/modules/domain/domain.schemas.ts) and [workflow schemas](../backend/src/workflows/workflow.schemas.ts).
- [~] **Detect ambiguity, missing information, and conflicts.** Analysis/extraction includes gap detection and returns questions/assumptions/uncertainties. It is not an interactive clarification conversation, and conflict-specific findings are not a dedicated required output field. See [workflow graph](../backend/src/workflows/workflow-graph.ts), [workflow prompts](../backend/src/workflows/prompts.ts), and [workflow schemas](../backend/src/workflows/workflow.schemas.ts).
- [~] **Generate epics and user stories in the agreed format.** The artifact model supports manually created epics and the workflow generates traceable stories. The story output schema does not enforce the “As a / I want / So that” form, and the workflow does not generate epics. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts) and [artifact types](../backend/src/modules/domain/domain.schemas.ts).
- [~] **Generate testable acceptance criteria, including negative and boundary scenarios.** Given/When/Then criteria are generated and validated, but scenario classes (positive, negative, boundary, validation, edge) are not required or checked by the output contract. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts) and [workflow tests](../backend/tests/workflow.test.ts).
- [~] **Explain quality-review findings.** The validation workflow returns severity, description, and recommendation linked to project records. Completeness, clarity, consistency, duplication, and testability are prompt responsibilities rather than individually enforced coverage criteria; the result is in the workbench, not a separate persistent quality-review workspace. See [workflow prompts](../backend/src/workflows/prompts.ts), [workflow schemas](../backend/src/workflows/workflow.schemas.ts), and [workflow workbench](../frontend/src/pages/WorkflowWorkbenchPage.tsx).
- [~] **Represent risks and dependencies separately.** Both are generated and linked to requirements. Risk owners, affected systems, and unresolved-decision ownership are not structured fields. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts).
- [~] **Produce an implementation plan with modules, phases, priorities, and relative complexity.** Roadmap milestones, priorities, dependencies, and requirement links are stored. Suggested modules and relative complexity are not represented; estimates are intentionally not commitments. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts) and [workflow graph](../backend/src/workflows/workflow-graph.ts).
- [x] **Keep generated output editable and versioned.** Requirement/artifact edits create snapshots and return the current record to draft; generated results are persisted as drafts. See [storage/versioning](../backend/src/config/storage.ts), [API specification](api/API-Specification.md), and [frontend README](../frontend/README.md).
- [~] **Support human review with reviewer identity, timestamp, comments, and versions.** Approve/reject/request-changes are implemented; reviewer ID, comments, timestamps, and pre-decision resource snapshots are stored. There is no separate append-only audit event log for every transition. See [approval routes](../backend/src/modules/approvals/approval.routes.ts) and [approval storage](../backend/src/config/storage.ts).
- [~] **Export selected draft or approved artifacts.** JSON, Markdown, and CSV exports include project data and exclude document bytes. The UI selects a format, not a subset of artifacts; it exports the project dataset. See [project exporter](../backend/src/modules/exports/project-exporter.ts) and [frontend README](../frontend/README.md).

## 2. Roles and frontend scope

- [~] **Map Business Analyst, Product Owner/Stakeholder, Delivery Lead, and Administrator responsibilities.** Current roles are `user`, `project_owner`, `reviewer`, and `admin`; there are no distinct BA, Product Owner, or Delivery Lead roles. Project ownership is separate from the `project_owner` role. See [user roles](../backend/src/modules/auth/user.repository.ts) and [security architecture](backend/Security-Architecture.md).
- [x] **Allow authorized reviewers to decide approvals with comments.** Reviewer/admin access is enforced, is project-scoped, prevents self-review, and supports approve/reject/request-changes. See [approval routes](../backend/src/modules/approvals/approval.routes.ts) and [reviewer UI](../frontend/src/pages/ApprovalWorkspacePage.tsx).
- [~] **Provide the administrator's user, role, template, and audit functions.** Admin role assignment exists; user listing/lifecycle management, templates, and audit-history screens/APIs were not found. Initial admin provisioning is documented as out of band. See [user routes](../backend/src/modules/users/user.routes.ts) and [backend README](../backend/README.md).
- [~] **Project dashboard shows status, recent activity, and approval indicators.** The dashboard shows accessible projects and recent updates; there is no activity feed or approval-count/indicator view. See [overview page](../frontend/src/pages/OverviewPage.tsx) and [frontend README](../frontend/README.md).
- [~] **Provide a dedicated business-problem intake form.** Project name/description and document upload are available, but the structured intake fields and document-free analysis path are absent. See [frontend routes](../frontend/src/app/router.tsx) and [project overview](../frontend/src/pages/ProjectOverviewPage.tsx).
- [x] **Provide an editable, traceable requirements workspace.** Listing, filtering, details, source links, editing, and version history are implemented. See [frontend README](../frontend/README.md) and [requirement page](../frontend/src/pages/RequirementListPage.tsx).
- [~] **Provide a dedicated epic/story board, quality panel, risk/dependency view, and roadmap view.** The artifact workspace and AI workbench cover the underlying records/results, but these are generic workspace views rather than all of the dedicated modules/screens listed in the Capstone. Epic generation is also absent. See [frontend routes](../frontend/src/app/router.tsx) and [artifact workspace](../frontend/src/pages/ArtifactWorkspacePage.tsx).
- [x] **Provide approval and export centers.** Project-scoped reviewer queue and JSON/Markdown/CSV downloads are implemented. Export selection is project-wide rather than per-artifact. See [frontend README](../frontend/README.md).

## 3. API, architecture, and technology

- [x] **Use React/TypeScript frontend and Node.js/TypeScript/Express REST API under `/api/v1`.** Current implementation follows this stack with Zod validation and modular backend routes/services. See [backend README](../backend/README.md), [frontend README](../frontend/README.md), and [backend app](../backend/src/app.ts).
- [~] **Use the recommended frontend component/styling stack or record an approved alternative.** The frontend uses a custom responsive CSS/token system rather than Material UI or Tailwind; no coach approval for that choice was found. See [frontend styles](../frontend/src/styles/global.css) and [frontend README](../frontend/README.md).
- [~] **Use MongoDB with indexed collections and tenant/user-level access.** MongoDB collections and indexes are documented, but runtime storage is a temporary JSON file with no MongoDB adapter, migrations, or indexes. Project ownership/member checks exist, but there is no separate tenant model. See [database design](backend/Database-Design.md), [storage adapter](../backend/src/config/storage.ts), and [current structure](backend/current-structure.md).
- [~] **Use Claude/OpenAI provider adapters and configurable retrieval where required.** Provider abstraction exists for OpenAI and Groq, not Claude. No embeddings/vector-search implementation was found; current document workflows extract selected text directly and enforce context bounds. See [provider adapter](../backend/src/integrations/llm/structured-output-provider.ts) and [workflow service](../backend/src/workflows/workflow-service.ts).
- [x] **Use explicit, typed workflow components rather than a generic chatbot.** LangGraph workflows have explicit named nodes, schemas, execution IDs, node states, and a provider interface. See [workflow graph](../backend/src/workflows/workflow-graph.ts), [workflow schemas](../backend/src/workflows/workflow.schemas.ts), and [workflow routes](../backend/src/modules/workflows/workflow.routes.ts).
- [x] **Provide the listed core API operations, validation, authorization, asynchronous status, and OpenAPI.** Project, document, requirement, story, criteria, quality, risk, roadmap, approval, export, execution-status, and Swagger/OpenAPI paths exist. Some additional capabilities described elsewhere in the Capstone (such as user/template/audit administration) do not. See [API specification](api/API-Specification.md) and [OpenAPI source](../backend/src/docs/openapi.ts).
- [~] **Make asynchronous workflows durable and safe to retry.** Jobs return execution IDs and status, but run in-process against JSON storage, are not crash-resumable, and have no idempotency key. The frontend correctly avoids automatic submission retries. See [workflow service](../backend/src/workflows/workflow-service.ts) and [frontend README](../frontend/README.md).
- [~] **Keep architecture documentation aligned to required repository deliverables.** Architecture, HLD, LLD, component, data-flow, database, and security documents exist under `docs/backend/`, rather than the Capstone's requested `docs/architecture/` path. API spec and runtime Swagger exist. See [architecture documents](backend/Architecture.md), [API specification](api/API-Specification.md), and [backend README](../backend/README.md).

## 4. Non-functional requirements and operational controls

- [x] **Authentication, role checks, project ownership checks, request validation, and secure upload constraints.** JWT auth, Zod validation, project access checks, 5 MiB file limit, supported file-type checks, and role restrictions are present and covered by tests. See [security middleware tests](../backend/tests/security-middleware.test.ts), [application tests](../backend/tests/app.test.ts), and [project routes](../backend/src/modules/projects/project.routes.ts).
- [~] **Treat documents as untrusted and validate generated output.** Prompts separate source text from system instructions; schemas, project IDs, and verbatim source citations are checked. Deterministic fake-provider tests cover the boundary, but this is not proof of live-model safety. See [prompts](../backend/src/workflows/prompts.ts), [workflow graph](../backend/src/workflows/workflow-graph.ts), and [workflow tests](../backend/tests/workflow.test.ts).
- [~] **Enforce consent and least-privilege document sharing at the API boundary.** The frontend requires selected documents and a privacy confirmation. The backend's document-based workflows default to all project documents if `documentIds` is omitted, so the UI policy is not enforced for direct API clients. This should be resolved before treating the privacy control as complete. See [workflow service](../backend/src/workflows/workflow-service.ts) and [frontend README](../frontend/README.md).
- [ ] **Implement data deletion, retention, and archive controls.** The database design describes retention/deletion needs, but no document/project/requirement/artifact deletion or retention workflow was found. Uploaded bytes are stored in the JSON file. See [database design](backend/Database-Design.md), [domain routes](../backend/src/modules/projects/project.routes.ts), and [storage adapter](../backend/src/config/storage.ts).
- [~] **Provide observability and auditability.** Request IDs, structured logs, execution IDs, node status, token usage, durations, reviewer IDs, and version snapshots exist. Aggregate usage/latency metrics, a dedicated audit log, and full before/after decision-event history are not evident. See [workflow service](../backend/src/workflows/workflow-service.ts), [approval storage](../backend/src/config/storage.ts), and [architecture](backend/Architecture.md).
- [~] **Meet reliability and performance expectations.** API/provider timeouts, bounded provider retry, request limits, pagination, workflow bounds, and graceful shutdown exist. JSON storage is single-process, there are no database indexes, and workflow jobs are volatile across process failure. See [provider adapter](../backend/src/integrations/llm/structured-output-provider.ts), [workflow service](../backend/src/workflows/workflow-service.ts), and [backend README](../backend/README.md).
- [~] **Support scalable deployment and AWS/Azure handover.** A backend Docker image and frontend static-host instructions exist. There is no cloud-specific deployment configuration; the backend explicitly supports one instance only with the current JSON store. See [backend README](../backend/README.md) and [frontend README](../frontend/README.md).
- [x] **Keep runtime secrets and local data out of tracked source paths.** The repository check found tracked `.env.example` files but not tracked `.env` or the ignored runtime JSON store. This was a path/name check, not a full secret scan. See [backend env example](../backend/.env.example), [frontend env example](../frontend/.env.example), and [backend ignore rules](../backend/.gitignore).

## 5. Testing, evaluation, and Definition of Done

- [x] **Provide unit, integration, and frontend tests.** Backend tests cover auth, storage, route access, uploads, approvals, and workflows; frontend tests cover forms, API behavior, routes, and reviewer UX. See [backend tests](../backend/tests/app.test.ts), [workflow tests](../backend/tests/workflow.test.ts), and [frontend tests](../frontend/src).
- [~] **Provide Playwright end-to-end evidence.** The latest recorded run passed 5 browser E2E cases, but those tests use mocked API responses against a production frontend preview; they do not prove a live frontend-to-backend deployment flow. See [Phase 10 E2E tests](../frontend/e2e/phase10.spec.ts) and [frontend README](../frontend/README.md).
- [~] **Provide domain-specific AI evaluation evidence.** Deterministic fake-provider tests verify schemas, traceability, citation rejection, and prompt separation. The backend documentation explicitly limits this evidence; no live-provider quality evaluation or scored evaluation suite was found. See [workflow tests](../backend/tests/workflow.test.ts) and [backend README](../backend/README.md).
- [x] **Document setup, API, and known limitations.** Backend/frontend setup, `.env.example`, Docker instructions, Swagger UI, and current storage/provider constraints are documented. The API specification's operational note should be kept in sync with the current Groq option. See [backend README](../backend/README.md), [frontend README](../frontend/README.md), and [API specification](api/API-Specification.md).
- [~] **Demonstrate the full business workflow without manual database edits.** Core flows are implemented, but a fresh install has no self-service first-admin bootstrap; admin provisioning is documented as out of band. A complete approval demo therefore depends on pre-provisioned roles. See [backend README](../backend/README.md) and [user routes](../backend/src/modules/users/user.routes.ts).
- [?] **Obtain and record coach approval at phase gates and for deviations from the prescribed stack.** The frontend status document explicitly says it is not evidence that formal approval gates were granted. No approval record was found in the reviewed repository. See [frontend README](../frontend/README.md) and [backend implementation plan](../backend/FRONTEND_IMPLEMENTATION_PLAN.md).
- [~] **Prove the app is runnable from the documented setup.** The shared browser currently displays the login page at `http://localhost:5173/login`; this confirms the frontend is serving, not that the backend, AI provider, or complete workflow was exercised during this review.

### Latest recorded automated verification

The latest recorded implementation run in this session reported:

- Backend: 6 suites / 35 tests passed.
- Frontend: 28 files / 80 tests passed.
- Playwright E2E: 5 tests passed.
- Frontend build, lint, formatting, and `git diff --check` passed.

These results support the implemented slices; they do not close the gaps above. The E2E suite mocks the API, and workflow tests use a fake provider. No live model or production deployment was verified in this checklist review.

## Recommended completion order

### P0 — resolve before claiming Capstone completion

1. **Choose and document persistence:** implement the MongoDB adapter/migration/indexes and operational restore plan, or obtain written coach approval for JSON as an intentional capstone alternative.
2. **Complete intake:** add structured problem/objective/scope/stakeholder/constraint fields and allow a plain-language-only analysis workflow.
3. **Enforce document consent server-side:** require explicit document IDs for document workflows and prevent implicit inclusion of every project document.
4. **Add data lifecycle and audit controls:** implement deletion/retention/archive behavior and an append-only audit history for review decisions and administrative actions.
5. **Provide a safe first-admin bootstrap:** enable a fresh installation and complete approval demo without manual JSON edits.

### P1 — close functional and evidence gaps

6. Add epic generation, enforce the story template, and test required negative/boundary acceptance scenarios; add a confidence/uncertainty field where required.
7. Decide whether Claude support is required; implement it or record coach approval for OpenAI/Groq.
8. Add admin user/template/audit capabilities and clarify how Capstone personas map to app roles.
9. Add live-backend E2E coverage and a documented AI evaluation suite using authorized synthetic scenarios.
10. Add deployment-target-specific setup and operational metrics before making production-scale claims.
11. Add artifact-level export selection and the missing dashboard activity/approval indicators if those screens are acceptance criteria.
12. Update API/architecture documents to consistently describe the current providers, persistence, and operational limits.

## Bottom line

The current implementation covers the **core MVP path**—project creation, BRD upload, traceable draft requirements, workflow-generated artifacts, human decisions, version history, and export—but it is **not yet a complete match for the Capstone Definition of Done**. The highest-impact blockers are the unimplemented MongoDB target (unless formally approved as a deviation), lack of document-free intake, missing retention/deletion and full audit controls, and the absence of a fresh-install admin bootstrap. The remaining partial items should be resolved or explicitly accepted by the coach before presenting the system as fully Capstone-compliant.
