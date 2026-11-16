# AI Business Analyst Agent — Backend Implementation Plan

**Project:** Capstone Project 02 — AI Business Analyst Agent  
**Scope:** Backend first  
**Backend stack:** Node.js, TypeScript, Express.js, MongoDB, LangGraph.js  
**API base path:** `/api/v1`  
**Workflow rule:** Complete one phase, present evidence, and STOP. Do not begin the next phase until the user explicitly approves the current phase.

---

## 1. Purpose

Build the backend for an AI Business Analyst Agent that turns a plain-language business problem or uploaded Business Requirements Document (BRD) into structured, reviewable and traceable analysis artifacts.

The backend must support:

- Project intake and project context.
- BRD and supporting-document upload.
- Business, functional and non-functional requirement extraction.
- Ambiguity, gap and conflict detection.
- Epics, user stories and acceptance criteria.
- Quality review.
- Risk, assumption and dependency analysis.
- Suggested implementation roadmaps.
- Human review, approval, rejection and version history.
- Export to Markdown, JSON and CSV.
- Auditable, observable AI workflow execution.

AI-generated content is always a **draft suggestion** until an authorized human reviewer approves it. The system must distinguish source facts, assumptions, uncertainties and AI recommendations.

## 2. Confirmed technology decisions

| Area | Decision |
|---|---|
| Runtime | Node.js |
| Language | TypeScript with strict mode |
| HTTP framework | Express.js |
| Database | MongoDB |
| AI workflow orchestration | **LangGraph.js** |
| LLM integration | Provider adapter supporting OpenAI and/or Claude |
| Request/response validation | Zod |
| API documentation | OpenAPI / Swagger |
| Unit and integration tests | Jest and Supertest |
| Containerization | Docker |
| API versioning | `/api/v1` |

### LangGraph requirement — mandatory

Use **LangGraph.js** for graph-based AI workflow orchestration. Do not implement the agent workflow using LangChain chains, agents, or a generic LangChain orchestration layer.

LangGraph should coordinate explicit workflow nodes, typed state, conditional routing, retries where appropriate, and execution checkpoints. Keep model-provider calls behind a small provider interface so the graph is not coupled to one vendor.

Use only the LangGraph packages and provider SDKs that are compatible with the selected Node.js/TypeScript versions. Confirm package compatibility during the architecture phase and record the chosen versions.

A proposed graph may eventually contain nodes for:

1. Intake and problem understanding.
2. Stakeholder and actor identification.
3. Requirement extraction.
4. Ambiguity and gap detection.
5. Epic and story generation.
6. Acceptance-criteria generation.
7. Requirements quality review.
8. Risk and dependency analysis.
9. Roadmap planning.
10. Output validation and persistence.

Do not build all these nodes in the first phase. The graph is a later phase deliverable.

## 3. Backend architecture principles

Start with a **modular monolith**, not microservices. Keep boundaries clear so modules can be extracted later if there is a real need.

Recommended request flow:

`HTTP Route → Middleware → Controller → Application Service → Domain Logic / Repository → MongoDB`

AI workflow execution should be separated from ordinary request handling:

`API Request → Workflow Service → LangGraph → Provider Adapter / Tools → Output Validation → Persistence`

Long-running analysis must run asynchronously. The API should return an execution identifier and provide endpoints to check execution status and retrieve results.

### Required engineering rules

- Keep routes/controllers, application services, domain logic, repositories, AI workflows and external integrations separate.
- Use TypeScript strict mode.
- Validate all external input with Zod.
- Use centralized error handling and a consistent API error format.
- Keep secrets in environment variables or a secret manager; never commit them.
- Enforce authentication, role-based authorization and project ownership checks.
- Add pagination to collection endpoints.
- Use indexes for common query paths.
- Use request IDs and workflow execution IDs for traceability.
- Do not log passwords, tokens, API keys, or unnecessary sensitive document content.
- Treat uploaded documents and extracted text as untrusted input. Defend against prompt injection and instructions embedded in source documents.
- Use bounded timeouts and retries. Avoid retrying non-idempotent operations without an idempotency strategy.
- Do not claim tests pass unless they have actually been run.

## 4. Suggested backend folder structure

This is a proposed target structure, not permission to overwrite an existing repository. First inspect the supplied repository and adapt to its conventions.

```text
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── database.ts
│   │   └── logger.ts
│   ├── common/
│   │   ├── errors/
│   │   ├── middleware/
│   │   ├── validation/
│   │   ├── types/
│   │   └── utils/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── projects/
│   │   ├── documents/
│   │   ├── requirements/
│   │   ├── epics/
│   │   ├── stories/
│   │   ├── acceptance-criteria/
│   │   ├── business-rules/
│   │   ├── risks/
│   │   ├── dependencies/
│   │   ├── implementation-plans/
│   │   ├── approvals/
│   │   ├── versions/
│   │   ├── exports/
│   │   └── agent-executions/
│   ├── workflows/
│   │   ├── graphs/
│   │   ├── nodes/
│   │   ├── state/
│   │   ├── prompts/
│   │   └── schemas/
│   ├── integrations/
│   │   ├── llm/
│   │   └── storage/
│   └── docs/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

The exact structure may change after repository assessment. Avoid creating empty folders merely to match this example.

---

# 5. Phase-by-phase backend delivery

## Phase 1 — Backend repository assessment

**Goal:** Understand the existing codebase before changing it.

### Tasks

1. Inspect the repository root and identify the current backend location.
2. Identify the current runtime, language, framework and package manager.
3. Inspect existing source folders, entry points, configuration and environment handling.
4. Identify whether MongoDB or another database is already configured.
5. Inspect existing authentication, authorization, validation, logging and error-handling code.
6. Identify existing API routes and whether an `/api/v1` convention is already in place.
7. Inspect existing tests, scripts, Docker files and API documentation.
8. Identify existing AI/LLM integrations and determine whether any are based on LangChain.
9. Identify reusable code, missing capabilities, technical risks and security concerns.
10. Compare the repository against the target backend architecture in this document.

### Required deliverables

Create:

- `docs/backend/initial-assessment.md`
- `docs/backend/current-structure.md`
- `docs/backend/gap-analysis.md`

The assessment must include:

- Existing stack and detected versions.
- Current folder structure.
- Existing backend capabilities.
- Reusable components.
- Missing components.
- Risks and technical debt.
- Recommended changes.
- Any assumptions that need the user's decision.

### Restrictions

- Do not implement features in this phase.
- Do not delete, rename or overwrite existing files.
- Do not install packages unless explicitly needed for a read-only inspection; prefer inspecting first.
- Do not assume the repository matches the proposed structure.
- If no repository is available, report that clearly and ask the user to provide the backend repository or confirm that a new backend should be scaffolded.

### Phase 1 completion report

Present:

1. Summary of the existing backend.
2. Files and folders inspected.
3. Files created or modified (ideally assessment documents only).
4. Findings and gaps.
5. Risks and unresolved questions.
6. Recommendation for Phase 2.

**STOP HERE. Wait for explicit user approval before starting Phase 2.**

---

## Phase 2 — Backend architecture and contracts

**Start only after Phase 1 is explicitly approved.**

**Goal:** Agree on the backend design before implementation.

### Tasks

1. Define module boundaries and responsibilities.
2. Define the request lifecycle and asynchronous workflow execution model.
3. Define authentication and role-based authorization.
4. Design MongoDB collections, relationships, ownership fields and indexes.
5. Define API request and response contracts under `/api/v1`.
6. Define standard error responses and validation behavior.
7. Design the LangGraph workflow architecture and typed graph state.
8. Define the LLM provider adapter contract and configuration strategy.
9. Define document upload, storage, parsing and untrusted-content handling.
10. Define logging, execution tracking, retries, timeouts and observability.
11. Define security controls and data retention/deletion behavior.

### Required deliverables

Create or update:

- `docs/backend/Architecture.md`
- `docs/backend/HLD.md`
- `docs/backend/LLD.md`
- `docs/backend/Component-Design.md`
- `docs/backend/Data-Flow.md`
- `docs/backend/Database-Design.md`
- `docs/backend/Security-Architecture.md`
- `docs/api/API-Specification.md`

Include component, sequence and data-flow diagrams where useful. Include representative MongoDB documents and index definitions. Include an OpenAPI draft.

### Approval checkpoint

Present the architecture, database design, API contracts, LangGraph design and unresolved decisions. Do not begin implementation until the user approves Phase 2.

---

## Phase 3 — Backend foundation

**Start only after Phase 2 is explicitly approved.**

**Goal:** Implement a secure, testable backend foundation.

### Tasks

1. Initialize or adapt the Node.js/TypeScript backend.
2. Configure TypeScript strict mode and development scripts.
3. Implement validated environment configuration.
4. Configure MongoDB connection lifecycle and connection failure handling.
5. Create the Express application and server entry points.
6. Implement request ID and structured logging middleware.
7. Implement centralized error handling and not-found handling.
8. Implement Zod validation middleware.
9. Implement authentication and password/session or token handling according to the approved design.
10. Implement role-based authorization and project ownership guards.
11. Add rate limiting and secure HTTP headers.
12. Add health and readiness endpoints.
13. Configure Swagger/OpenAPI serving.
14. Add unit and integration test foundations.
15. Add `.env.example`, `.gitignore` and local run instructions.

### Minimum verification

- The server starts using documented commands.
- MongoDB connection success and failure are handled.
- Health/readiness endpoints return the documented responses.
- Invalid environment variables prevent unsafe startup.
- Validation errors use the standard error format.
- Unauthorized and forbidden requests are handled correctly.
- Logs include request IDs and do not expose secrets.
- Tests are run and actual results are reported.

### Approval checkpoint

Show changed files, commands, API examples, test output and known issues. Do not begin Phase 4 until approved.

---

## Phase 4 — Core domain APIs

**Start only after Phase 3 is explicitly approved.**

**Goal:** Implement the core business APIs and persistence, without the complete AI workflow.

### Scope

Implement the domain modules and APIs required for:

- Users and roles.
- Projects.
- Business documents.
- Requirements.
- Epics and user stories.
- Acceptance criteria.
- Business rules.
- Risks and dependencies.
- Implementation plans.
- Approvals and artifact versions.
- Agent execution records.

### API endpoints from the project specification

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/projects` | Create a project |
| GET | `/api/v1/projects` | List accessible projects |
| GET | `/api/v1/projects/:id` | Get project details |
| POST | `/api/v1/projects/:id/documents` | Upload a BRD/supporting document |
| POST | `/api/v1/requirements/analyze` | Submit an analysis job |
| POST | `/api/v1/requirements/extract` | Submit a requirement extraction job |
| GET | `/api/v1/projects/:id/requirements` | List project requirements |
| PATCH | `/api/v1/requirements/:id` | Edit a requirement |
| POST | `/api/v1/stories/generate` | Request story generation |
| POST | `/api/v1/acceptance-criteria/generate` | Request acceptance criteria |
| POST | `/api/v1/requirements/validate` | Request quality review |
| POST | `/api/v1/risks/analyze` | Request risk analysis |
| POST | `/api/v1/roadmap/generate` | Request roadmap generation |
| POST | `/api/v1/approvals` | Submit an artifact for approval |
| PATCH | `/api/v1/approvals/:id` | Approve, reject or request changes |
| GET | `/api/v1/projects/:id/export` | Export project artifacts |

The analysis/generation endpoints may initially return a clear `501 Not Implemented` or an agreed job placeholder until Phase 5. Do not fake AI results.

### Approval checkpoint

Demonstrate CRUD operations, persistence, ownership enforcement, validation, pagination and API tests. Wait for approval before Phase 5.

---

## Phase 5 — LangGraph AI workflows

**Start only after Phase 4 is explicitly approved.**

**Goal:** Implement the AI Business Analyst Agent as explicit LangGraph workflows.

### Required design

- Use LangGraph.js as the orchestration engine.
- Define a typed state schema for each workflow or a carefully designed shared state.
- Keep each node focused on one responsibility.
- Validate model output using Zod before it enters domain persistence.
- Preserve source references for extracted statements where available.
- Mark uncertain information and assumptions explicitly.
- Route to clarification when required information is missing or conflicting.
- Store execution IDs, node status, timestamps, errors and relevant usage metrics.
- Apply timeouts and bounded retries.
- Make workflows resumable where the selected persistence/checkpoint strategy supports it.
- Keep prompts versioned and external to business logic.
- Treat source documents and retrieved passages as untrusted data.
- Never allow document instructions to override system/developer workflow rules.

### Suggested workflow

```text
START
  |
  v
Intake / Problem Understanding
  |
  v
Stakeholder and Actor Identification
  |
  v
Requirement Extraction
  |
  v
Ambiguity and Gap Detection
  |----------------------|
  | Clarification needed | No blocking gaps
  v                      v
Await clarification      Epic and Story Generation
                         |
                         v
                 Acceptance Criteria
                         |
                         v
                 Requirements Critic
                         |
                 Conditional routing
                   |           |
             Needs changes   Passes checks
                   |           |
                   v           v
             Revise / flag   Risk and Dependency Analysis
                               |
                               v
                         Roadmap Planning
                               |
                               v
                      Schema Validation
                               |
                               v
                         Save Drafts
                               |
                              END
```

The graph must not silently invent business rules. Separate:

- `source_facts`
- `assumptions`
- `open_questions`
- `recommendations`
- `uncertainties`

### Agent/node responsibilities

| Node | Responsibility |
|---|---|
| Intake | Normalize the problem and identify missing context |
| Stakeholders | Identify actors, stakeholders and external systems |
| Requirement extractor | Extract functional and non-functional requirements |
| Gap detector | Flag ambiguity, missing details and conflicts |
| Story generator | Generate epics and stories linked to requirement IDs |
| Acceptance criteria | Generate testable Given/When/Then scenarios |
| Critic | Review clarity, completeness, consistency, duplication and testability |
| Risk/dependency | Identify risks, assumptions and dependencies |
| Planner | Suggest modules, priorities and delivery phases |
| Output validator | Validate schemas and traceability before persistence |

### Approval checkpoint

Demonstrate graph execution, node-level status, structured outputs, traceability, failure handling and evaluation evidence. Wait for approval before Phase 6.

---

## Phase 6 — Human review, approvals, versioning and exports

**Start only after Phase 5 is explicitly approved.**

**Goal:** Ensure AI outputs remain reviewable and controlled.

### Tasks

1. Support editing of generated artifacts.
2. Preserve prior versions when an artifact changes.
3. Record reviewer identity, decision, comments and timestamps.
4. Enforce role permissions for approval actions.
5. Support approve, reject and request-changes decisions.
6. Prevent unauthorized users from approving their own or other users' artifacts where policy disallows it.
7. Export selected artifacts to Markdown, JSON and CSV.
8. Ensure exports identify draft versus approved status.

### Approval checkpoint

Demonstrate version history, reviewer permissions, audit records and export correctness. Wait for approval before Phase 7.

---

## Phase 7 — Backend testing, security and AI evaluation

**Start only after Phase 6 is explicitly approved.**

### Tasks

- Unit tests for domain services and validation.
- Integration tests for MongoDB repositories and API routes.
- API contract tests against OpenAPI.
- Authentication, authorization and tenant/project isolation tests.
- File validation and upload security tests.
- Prompt-injection and untrusted-document tests.
- LangGraph node and end-to-end workflow tests.
- Provider timeout, rate-limit and unavailable-provider tests.
- Idempotency and duplicate-submission tests where applicable.
- AI evaluation for faithfulness to source, completeness, clarity, traceability and testability.
- Document limitations and known failure modes.

Do not use an AI quality score as a replacement for human approval.

### Approval checkpoint

Provide test commands, actual test output, coverage information where available, security findings, AI evaluation results and unresolved defects. Wait for approval before Phase 8.

---

## Phase 8 — Backend deployment and handover

**Start only after Phase 7 is explicitly approved.**

### Tasks

1. Create and verify the backend Dockerfile.
2. Provide local and production environment configuration guidance.
3. Document MongoDB setup and backup considerations.
4. Document LLM provider setup without exposing secrets.
5. Document health checks, logs and operational troubleshooting.
6. Ensure Swagger/OpenAPI matches the implemented APIs.
7. Update backend README and architecture documents.
8. Provide sample requests and real responses from the running backend.
9. Document deployment steps for the selected hosting environment.

### Final backend deliverables

- Running backend API.
- MongoDB persistence and index setup.
- LangGraph workflow implementation.
- Authentication and authorization.
- Swagger/OpenAPI documentation.
- `.env.example` with placeholders only.
- Docker configuration.
- Unit, integration, API and AI evaluation tests.
- Backend README and setup instructions.
- Architecture and security documentation.
- Known limitations and operational notes.

---

# 6. Mandatory phase approval protocol

This protocol applies to every phase. It overrides any instruction that would otherwise encourage the coding agent to continue automatically.

At the end of a phase, the coding agent must provide:

1. **Phase completed:** phase number and name.
2. **Work summary:** what was done.
3. **Files created:** exact paths.
4. **Files modified/deleted:** exact paths and reasons. Deletions require explicit permission.
5. **Commands executed:** exact commands.
6. **Verification:** actual test/build/API results. Clearly state what was not tested.
7. **Evidence:** relevant code excerpts, API examples, logs or screenshots where appropriate.
8. **Known issues:** defects, limitations and unresolved decisions.
9. **Next phase proposal:** what would happen next, without executing it.

Then the coding agent must stop and ask:

> Phase [N] is complete. Do you approve this phase so I can proceed to Phase [N+1]?

Only an explicit approval from the user, such as **“Approved — proceed to Phase 2”**, authorizes the next phase.

The following do **not** count as approval:

- Silence.
- A new question.
- A request to explain the current phase.
- A request to fix or clarify something in the current phase.
- The coding agent's own claim that the phase is complete.

If changes are requested, remain in the current phase, make only the requested changes, rerun relevant checks and present the phase for approval again.

**Never start, scaffold, partially implement or prepare files for the next phase before approval.** Planning later phases in this document is allowed; executing them is not.

# 7. Initial instruction to the coding agent

Act as a Principal Backend Engineer and AI Systems Architect.

We are building the backend first for the AI Business Analyst Agent described in the capstone specification. Follow this document and the approved architecture decisions.

**Begin with Phase 1 — Backend repository assessment only.** Inspect the repository and report what exists. Create only the Phase 1 assessment documents. Do not start architecture implementation, backend scaffolding, database implementation, API implementation or LangGraph workflow coding during Phase 1.

Use LangGraph.js, not LangChain, for the eventual AI orchestration. Do not substitute another orchestration framework without asking for approval.

At the end of Phase 1, present the completion report and wait. Do not proceed until the user explicitly approves Phase 1.
