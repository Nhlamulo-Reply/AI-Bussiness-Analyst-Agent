# Capstone System-Fit Checklist

**Review date:** 2026-11-23  
**Source:** [Capstone Project 02](<../Capstone_02_ai-business-analyst-agent (1).docx>)  
**Review scope:** Current repository working tree, implementation documentation, automated-test definitions/results recorded earlier in this session, and the shared frontend page. This is a requirements-fit review, not a security audit or production certification.

## Executive verdict

**The system does not yet satisfy every Capstone expectation.** It is a substantial working MVP: it has authentication, project-scoped data, document parsing, seven asynchronous AI workflows, editable/versioned requirements and artifacts, human approvals, exports, OpenAPI documentation, and automated tests.

The largest remaining gaps are:

1. **Persistence differs from the Capstone default:** the running service uses a single-process JSON file; MongoDB is designed/documented as future work, not implemented. Coach approval of this deviation remains unverified.
2. **Privacy lifecycle is partial:** selected-document consent is enforced at the API boundary, and owner-only reversible archiving excludes archived documents from workflows, standard lists, and exports. Bytes are retained indefinitely; scheduled purge and broader retention/deletion controls are not implemented.
3. **Administrative controls are implemented for the selected scope:** admins can reversibly deactivate/reactivate accounts, manage all five template categories, and export the indefinitely retained append-only audit history. Existing JWTs are rejected after account or role changes, and the last active admin is protected. MongoDB remains deliberately deferred.
4. **AI output contracts are stronger but remain partial:** generation now creates epics, enforces structured “As a / I want / so that” stories, requires positive/negative/boundary/validation/edge acceptance scenarios, and records per-requirement model confidence. Confidence is a model estimate, not a calibrated probability; broader Capstone output and evaluation expectations remain.
5. **Provider/deployment/evaluation differences remain:** the configured providers are OpenAI and Groq rather than Claude and OpenAI; there is no live-provider quality evaluation or cloud-specific deployment evidence.

The current working tree also contains uncommitted implementation changes. The checklist describes that working-tree snapshot, not a released/committed build.

## Status key

- [x] **Implemented** — supported by current code and/or tests.
- [~] **Partial** — some of the expectation exists, but an identified part is missing or constrained.
- [ ] **Gap** — no implementation was found for the stated expectation.
- [?] **Unverified** — depends on coach approval, live deployment, credentials, or evidence not present in the repository.

## 1. Product and business-analysis workflow

- [x] **Capture and maintain the business problem and project context.** Project owners can create and edit the business objective, in/out-of-scope descriptions, stakeholder and constraint lists, and desired outputs. Existing JSON records receive empty defaults, and project-context-only workflows include the structured brief. See [project API](../backend/src/modules/projects/project.routes.ts) and [project overview](../frontend/src/pages/ProjectOverviewPage.tsx).
- [x] **Submit plain-language business problems without a BRD.** Requirement analysis/extraction can use the project description or structured project brief without source files; generated records identify project-context provenance and do not invent document citations. See [workflow service](../backend/src/workflows/workflow-service.ts), [workflow input validation](../backend/src/workflows/workflow-graph.ts), and [workflow page](../frontend/src/pages/WorkflowWorkbenchPage.tsx).
- [x] **Upload and parse BRD/supporting files.** The system accepts PDF, DOCX, and UTF-8 TXT up to 5 MiB and extracts text for workflows. See [document extraction](../backend/src/integrations/documents/text-extractor.ts), [project routes](../backend/src/modules/projects/project.routes.ts), and [API specification](api/API-Specification.md).
- [~] **Produce structured, uniquely identified, traceable requirements.** Requirements have generated IDs, type, priority, source facts/document links, assumptions, open questions, versions, and an optional 0–1 model-confidence estimate for generated requirements. The score is not calibrated as a statistical probability. See [domain schemas](../backend/src/modules/domain/domain.schemas.ts), [workflow schemas](../backend/src/workflows/workflow.schemas.ts), and [requirement details](../frontend/src/features/requirements/RequirementDetailsDialog.tsx).
- [~] **Detect ambiguity, missing information, and conflicts.** Analysis/extraction includes gap detection and returns questions/assumptions/uncertainties. It is not an interactive clarification conversation, and conflict-specific findings are not a dedicated required output field. See [workflow graph](../backend/src/workflows/workflow-graph.ts), [workflow prompts](../backend/src/workflows/prompts.ts), and [workflow schemas](../backend/src/workflows/workflow.schemas.ts).
- [x] **Generate epics and user stories in the agreed format.** The story workflow now generates requirement-linked epics and nested user stories with separately validated “As a / I want / So that” fields. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts), [workflow graph](../backend/src/workflows/workflow-graph.ts), and [workflow tests](../backend/tests/workflow.test.ts).
- [x] **Generate testable acceptance criteria, including negative and boundary scenarios.** Every selected story must include Given/When/Then criteria for positive, negative, boundary, validation, and edge scenario categories or the run fails validation before persistence. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts) and [workflow tests](../backend/tests/workflow.test.ts).
- [~] **Explain quality-review findings.** The validation workflow returns severity, description, and recommendation linked to project records. Completeness, clarity, consistency, duplication, and testability are prompt responsibilities rather than individually enforced coverage criteria; the result is in the workbench, not a separate persistent quality-review workspace. See [workflow prompts](../backend/src/workflows/prompts.ts), [workflow schemas](../backend/src/workflows/workflow.schemas.ts), and [workflow workbench](../frontend/src/pages/WorkflowWorkbenchPage.tsx).
- [~] **Represent risks and dependencies separately.** Both are generated and linked to requirements. Risk owners, affected systems, and unresolved-decision ownership are not structured fields. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts).
- [~] **Produce an implementation plan with modules, phases, priorities, and relative complexity.** Roadmap milestones, priorities, dependencies, and requirement links are stored. Suggested modules and relative complexity are not represented; estimates are intentionally not commitments. See [workflow schemas](../backend/src/workflows/workflow.schemas.ts) and [workflow graph](../backend/src/workflows/workflow-graph.ts).
- [x] **Keep generated output editable and versioned.** Requirement/artifact edits create snapshots and return the current record to draft; generated results are persisted as drafts. See [storage/versioning](../backend/src/config/storage.ts), [API specification](api/API-Specification.md), and [frontend README](../frontend/README.md).
- [~] **Support human review with reviewer identity, timestamp, comments, and versions.** Approve/reject/request-changes are implemented; reviewer ID, comments, timestamps, pre-decision snapshots, and append-only submission/decision events are stored. The event log does not cover every sensitive action. See [approval routes](../backend/src/modules/approvals/approval.routes.ts) and [approval storage](../backend/src/config/storage.ts).
- [~] **Export selected draft or approved artifacts.** JSON, Markdown, and CSV exports include project data and exclude document bytes. The UI selects a format, not a subset of artifacts; it exports the project dataset. See [project exporter](../backend/src/modules/exports/project-exporter.ts) and [frontend README](../frontend/README.md).

## 2. Roles and frontend scope

- [x] **Map Business Analyst, Product Owner/Stakeholder, Delivery Lead, and Administrator responsibilities.** The application now has the four distinct human roles with separate backend permissions, project-scoped access, role-aware dashboards/navigation, and human-only approval decisions. Project ownership remains a relationship separate from application roles. See [role-based access control](security/Role-Based-Access-Control.md) and [frontend README](../frontend/README.md).
- [x] **Allow authorized reviewers to decide approvals with comments.** Reviewer/admin access is enforced, is project-scoped, prevents self-review, and supports approve/reject/request-changes. See [approval routes](../backend/src/modules/approvals/approval.routes.ts) and [reviewer UI](../frontend/src/pages/ApprovalWorkspacePage.tsx).
- [x] **Provide the administrator's user, role, template, and audit functions for the selected admin/audit scope.** Admins can bootstrap the first admin, list users, assign mutually exclusive administrator or project roles, send/resend one-time invitations, manage project membership metadata without project-content access, deactivate/reactivate users, protect the last active administrator, manage templates for all five categories, and export full JSON/CSV audit history. Audit history has indefinite retention and no purge endpoint. See [admin page](../frontend/src/pages/AdminPage.tsx), [admin access management](../frontend/src/features/admin/AdminAccessManagement.tsx), and [admin routes](../backend/src/modules/users/admin.routes.ts).
- [~] **Project dashboard shows status, recent activity, and approval indicators.** The Business Analyst dashboard shows recent projects; Product Owner and Delivery Lead dashboards show project-level pending-review counts and queues. A general activity feed remains unimplemented. See [overview page](../frontend/src/pages/OverviewPage.tsx) and [frontend README](../frontend/README.md).
- [x] **Provide a dedicated business-problem intake form.** Project creation captures objective, scope, stakeholders, constraints, and desired outputs, owners can edit the brief later, and it is available for document-free analysis. See [project creation page](../frontend/src/pages/CreateProjectPage.tsx) and [project overview](../frontend/src/pages/ProjectOverviewPage.tsx).
- [x] **Provide an editable, traceable requirements workspace.** Listing, filtering, details, source links, editing, and version history are implemented. See [frontend README](../frontend/README.md) and [requirement page](../frontend/src/pages/RequirementListPage.tsx).
- [~] **Provide a dedicated epic/story board, quality panel, risk/dependency view, and roadmap view.** Epic/story generation and the underlying artifact records exist, but the artifact workspace and AI workbench are generic views rather than all of the dedicated modules/screens listed in the Capstone. See [frontend routes](../frontend/src/app/router.tsx) and [artifact workspace](../frontend/src/pages/ArtifactWorkspacePage.tsx).
- [x] **Provide approval and export centers.** Project-scoped reviewer queue and JSON/Markdown/CSV downloads are implemented. Export selection is project-wide rather than per-artifact. See [frontend README](../frontend/README.md).

## 3. API, architecture, and technology

- [x] **Use React/TypeScript frontend and Node.js/TypeScript/Express REST API under `/api/v1`.** Current implementation follows this stack with Zod validation and modular backend routes/services. See [backend README](../backend/README.md), [frontend README](../frontend/README.md), and [backend app](../backend/src/app.ts).
- [~] **Use the recommended frontend component/styling stack or record an approved alternative.** The frontend uses a custom responsive CSS/token system rather than Material UI or Tailwind; no coach approval for that choice was found. See [frontend styles](../frontend/src/styles/global.css) and [frontend README](../frontend/README.md).
- [~] **Use MongoDB with indexed collections and tenant/user-level access.** MongoDB collections and indexes are documented, but runtime storage is a temporary JSON file with no MongoDB adapter, migrations, or indexes. Project ownership/member checks exist, but there is no separate tenant model. See [database design](backend/Database-Design.md), [storage adapter](../backend/src/config/storage.ts), and [current structure](backend/current-structure.md).
- [~] **Use Claude/OpenAI provider adapters and configurable retrieval where required.** Provider abstraction exists for OpenAI and Groq, not Claude. No embeddings/vector-search implementation was found; current document workflows extract selected text directly and enforce context bounds. See [provider adapter](../backend/src/integrations/llm/structured-output-provider.ts) and [workflow service](../backend/src/workflows/workflow-service.ts).
- [x] **Use explicit, typed workflow components rather than a generic chatbot.** LangGraph workflows have explicit named nodes, schemas, execution IDs, node states, and a provider interface. See [workflow graph](../backend/src/workflows/workflow-graph.ts), [workflow schemas](../backend/src/workflows/workflow.schemas.ts), and [workflow routes](../backend/src/modules/workflows/workflow.routes.ts).
- [x] **Provide the listed core API operations, validation, authorization, asynchronous status, and OpenAPI.** Project detail editing, document, requirement, story, criteria, quality, risk, roadmap, approval, export, execution-status, user lifecycle, template management, audit export, and Swagger/OpenAPI paths exist. MongoDB persistence and non-admin Capstone functions remain outside this completed slice. See [API specification](api/API-Specification.md) and [OpenAPI source](../backend/src/docs/openapi.ts).
- [~] **Make asynchronous workflows durable and safe to retry.** Jobs return execution IDs and status, but run in-process against JSON storage, are not crash-resumable, and have no idempotency key. The frontend correctly avoids automatic submission retries. See [workflow service](../backend/src/workflows/workflow-service.ts) and [frontend README](../frontend/README.md).
- [~] **Keep architecture documentation aligned to required repository deliverables.** Architecture, HLD, LLD, component, data-flow, database, and security documents exist under `docs/backend/`, rather than the Capstone's requested `docs/architecture/` path. API spec and runtime Swagger exist. See [architecture documents](backend/Architecture.md), [API specification](api/API-Specification.md), and [backend README](../backend/README.md).

## 4. Non-functional requirements and operational controls

- [x] **Authentication, role checks, project ownership checks, request validation, and secure upload constraints.** JWT auth, Zod validation, project access checks, 5 MiB file limit, supported file-type checks, and role restrictions are present and covered by tests. See [security middleware tests](../backend/tests/security-middleware.test.ts), [application tests](../backend/tests/app.test.ts), and [project routes](../backend/src/modules/projects/project.routes.ts).
- [~] **Treat documents as untrusted and validate generated output.** Prompts separate source text from system instructions; schemas, project IDs, and verbatim source citations are checked. Deterministic fake-provider tests cover the boundary, but this is not proof of live-model safety. See [prompts](../backend/src/workflows/prompts.ts), [workflow graph](../backend/src/workflows/workflow-graph.ts), and [workflow tests](../backend/tests/workflow.test.ts).
- [x] **Enforce consent and least-privilege document sharing at the API boundary.** Only explicitly selected documents can be shared, non-empty selections require a consent flag, selections are bounded, and archived documents are excluded from workflow contexts. See [workflow service](../backend/src/workflows/workflow-service.ts), [workflow schema](../backend/src/modules/domain/domain.schemas.ts), and [workflow workbench](../frontend/src/pages/WorkflowWorkbenchPage.tsx).
- [~] **Implement data deletion, retention, and archive controls.** Project owners can reversibly archive and restore documents; users and templates can be deactivated but not hard-deleted. Archived bytes remain stored but are omitted from normal lists, workflow contexts, and exports. Audit events are retained indefinitely with no automatic purge; permanent deletion and scheduled retention remain unimplemented. See [project routes](../backend/src/modules/projects/project.routes.ts) and [storage adapter](../backend/src/config/storage.ts).
- [~] **Provide observability and auditability.** Request IDs, structured logs, execution IDs, node status, token usage, durations, versions, and append-only events for account registration/lifecycle, roles, project/member/export, document, requirement, artifact, workflow, template, approval, and audit exports exist. Audit records are retained indefinitely and exported in full as JSON or CSV. Aggregate usage/latency metrics remain absent. See [workflow service](../backend/src/workflows/workflow-service.ts), [admin routes](../backend/src/modules/users/admin.routes.ts), and [architecture](backend/Architecture.md).
- [~] **Meet reliability and performance expectations.** API/provider timeouts, bounded provider retry, request limits, pagination, workflow bounds, and graceful shutdown exist. JSON storage is single-process, there are no database indexes, and workflow jobs are volatile across process failure. See [provider adapter](../backend/src/integrations/llm/structured-output-provider.ts), [workflow service](../backend/src/workflows/workflow-service.ts), and [backend README](../backend/README.md).
- [~] **Support scalable deployment and AWS/Azure handover.** A backend Docker image and frontend static-host instructions exist. There is no cloud-specific deployment configuration; the backend explicitly supports one instance only with the current JSON store. See [backend README](../backend/README.md) and [frontend README](../frontend/README.md).
- [x] **Keep runtime secrets and local data out of tracked source paths.** The repository check found tracked `.env.example` files but not tracked `.env` or the ignored runtime JSON store. This was a path/name check, not a full secret scan. See [backend env example](../backend/.env.example), [frontend env example](../frontend/.env.example), and [backend ignore rules](../backend/.gitignore).

## 5. Testing, evaluation, and Definition of Done

- [x] **Provide unit, integration, and frontend tests.** Backend tests cover auth, storage, route access, uploads, approvals, and workflows; frontend tests cover forms, API behavior, routes, and reviewer UX. See [backend tests](../backend/tests/app.test.ts), [workflow tests](../backend/tests/workflow.test.ts), and [frontend tests](../frontend/src).
- [~] **Provide Playwright end-to-end evidence.** The latest recorded run passed 5 browser E2E cases, but those tests use mocked API responses against a production frontend preview; they do not prove a live frontend-to-backend deployment flow. See [Phase 10 E2E tests](../frontend/e2e/phase10.spec.ts) and [frontend README](../frontend/README.md).
- [~] **Provide domain-specific AI evaluation evidence.** Deterministic fake-provider tests verify schemas, traceability, citation rejection, and prompt separation. The backend documentation explicitly limits this evidence; no live-provider quality evaluation or scored evaluation suite was found. See [workflow tests](../backend/tests/workflow.test.ts) and [backend README](../backend/README.md).
- [x] **Document setup, API, and known limitations.** Backend/frontend setup, `.env.example`, Docker instructions, Swagger UI, and current storage/provider constraints are documented. The API specification's operational note should be kept in sync with the current Groq option. See [backend README](../backend/README.md), [frontend README](../frontend/README.md), and [API specification](api/API-Specification.md).
- [~] **Demonstrate the full business workflow without manual database edits.** First-admin bootstrap and role assignment remove the need for direct JSON edits, but approval demonstrations still require configured bootstrap credentials and sign-in with refreshed role claims; live-provider behavior remains unevaluated. See [backend README](../backend/README.md) and [user routes](../backend/src/modules/users/user.routes.ts).
- [?] **Obtain and record coach approval at phase gates and for deviations from the prescribed stack.** The frontend status document explicitly says it is not evidence that formal approval gates were granted. No approval record was found in the reviewed repository. See [frontend README](../frontend/README.md) and [backend implementation plan](../backend/FRONTEND_IMPLEMENTATION_PLAN.md).
- [~] **Prove the app is runnable from the documented setup.** The shared browser currently displays the login page at `http://localhost:5173/login`; this confirms the frontend is serving, not that the backend, AI provider, or complete workflow was exercised during this review.

### Latest recorded automated verification

Earlier implementation runs in this session reported:

- Backend: 6 suites / 35 tests passed.
- Frontend: 28 files / 80 tests passed.
- Playwright E2E: 5 tests passed.

Current verification after the admin/audit implementation:

- Backend: 6 suites / 48 tests passed.
- Frontend: 31 files / 92 tests passed.
- Frontend production TypeScript/Vite build passed.
- Frontend lint and repository-wide Prettier checks passed; `git diff --check` passed.
- Playwright E2E was not rerun.

These results support the implemented slices; they do not close the gaps above. The E2E suite mocks the API, and workflow tests use a fake provider. No live model or production deployment was verified in this checklist review.

## Recommended completion order

### P0 — resolve before claiming Capstone completion

1. **Choose and document persistence:** implement the MongoDB adapter/migration/indexes and operational restore plan, or obtain written coach approval for JSON as an intentional capstone alternative.
2. **Complete data lifecycle:** define and implement scheduled retention/permanent purge and deletion controls for projects and other records; document-owner soft archive is reversible only.
3. **Audit policy is implemented for current tracked actions:** user/template lifecycle, project exports, and audit exports are logged; retention is indefinite and full JSON/CSV export is available. Operational backup/restore and future action additions still need governance.
4. **Obtain and record coach approval** for the selected JSON exception, custom frontend stack, and provider choice where the capstone requires formal approval.

### P1 — close functional and evidence gaps

5. Clarify how Capstone personas map to app roles; user lifecycle and template-management workflows are implemented.
6. Decide whether Claude support is required; implement it or record coach approval for OpenAI/Groq.
7. Add live-backend E2E coverage and a documented AI evaluation suite using authorized synthetic scenarios.
8. Add deployment-target-specific setup and operational metrics before making production-scale claims.
9. Add artifact-level export selection and a general dashboard activity feed if those screens are acceptance criteria.
10. Update remaining API/architecture documents to consistently describe the current providers, persistence, and operational limits.

## Bottom line

The current implementation covers the **core MVP path**—project creation, document-free and document-based intake with explicit consent, traceable requirements, generated epics/stories/scenario-based criteria, human decisions, version history, reversible document archiving, role-specific access and dashboards, admin-managed user lifecycle and all five template categories, and indefinite auditable export—but it is **not yet a complete match for the Capstone Definition of Done**. MongoDB, coach approval for the JSON exception, permanent purge/deletion controls, a general activity feed, and live AI/deployment evaluation remain open. Resolve or formally accept these deviations before presenting the system as fully Capstone-compliant.
