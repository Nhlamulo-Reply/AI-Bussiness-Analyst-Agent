# AI Business Analyst Agent — Frontend Implementation Plan

> **Audience:** GitHub Copilot / AI coding assistant  
> **Repository baseline:** `Nhlamulo-Reply/AI-Bussiness-Analyst-Agent`, branch `phaseone`  
> **Purpose:** Build a polished, responsive, accessible frontend that integrates with the backend APIs that actually exist in `phaseone`.  
> **Execution rule:** Work phase by phase. Stop after every phase and wait for explicit user approval before starting the next phase.

---

## 0. Instructions Copilot must follow

Act as a senior frontend architect and product designer. Build a production-minded frontend for an AI Business Analyst Agent: a professional workspace where business analysts can create projects, upload business documents, run AI-assisted requirements workflows, review generated deliverables, manage approvals, inspect traceability/version history and export project information.

### Non-negotiable rules

1. **Inspect before changing.** First inspect the repository root, existing frontend (if any), package manifests, backend routes, schemas and OpenAPI document. Do not overwrite or delete existing work without explaining why and obtaining approval.
2. **Backend is the contract.** Use only routes, fields, enums and behavior confirmed in `backend/src` and `docs/api/API-Specification.md`. Do not invent CRUD endpoints, roles, pagination fields or capabilities. If a needed UI capability has no API, mark it as unavailable / future work and report the backend gap. Do not silently simulate persistence.
3. **Do not change the backend** as part of frontend phases. Report API gaps separately and wait for authorization before proposing backend changes.
4. **Approval gates are mandatory.** Complete only the current phase. At the end, report files changed, commands run, tests/build output, screenshots or other evidence, known gaps and next-phase proposal. Ask: `Phase N is complete. Do you approve proceeding to Phase N+1?` Then stop. No implicit approval.
5. Use real API integration. Mock data is allowed only in isolated Storybook/test fixtures or a clearly labelled demo mode. Never show fabricated numbers, AI results, user identities or project statuses as live data.
6. Never expose secrets, JWTs, uploaded document bytes or sensitive workflow input in logs, URLs, analytics or browser console output.
7. Keep AI output explicitly labelled as **AI-generated draft** until an authorized human approves it. Never represent model confidence or a quality score unless the backend provides it.
8. Do not claim the existing backend is fully production-ready. It currently uses temporary JSON-file storage, is single-process, and runs workflows in-process without crash-resume. Reflect this as a deployment limitation in developer documentation, not as a scary banner in the normal analyst interface.
9. No automatic workflow submission on page load, selection changes or rerenders. Workflow submissions must be initiated by an explicit user action and have a clear confirmation/loading state.
10. Do not start the next phase because a build passes. Wait for the user.

---

## 1. Product vision and UX principles

### Product positioning

A modern AI-powered business analysis workspace. It should feel like a premium B2B SaaS product used by consulting teams, product managers and business analysts—not a generic admin template and not a chatbot wrapper.

### Primary user journeys

1. Register or sign in.
2. See projects the authenticated user owns or belongs to.
3. Create a project and open its workspace.
4. Upload source BRDs, specifications, policy documents or plain-text files.
5. Select project documents and explicitly run requirements analysis or extraction.
6. Track the asynchronous execution and inspect its generated draft requirements, assumptions, questions, findings and recommendations.
7. Edit requirements and artifacts; inspect versions and source traceability.
8. Generate stories, acceptance criteria, risks and a roadmap from existing project context.
9. Submit draft requirements/artifacts for human review; reviewers approve, reject or request changes.
10. Export project information as JSON, Markdown or CSV.

### Design principles

- Calm, confident, premium and highly readable.
- Strong hierarchy; generous spacing; consistent grid; restrained color.
- Show important information first and secondary metadata second.
- Use progressive disclosure for complex requirement metadata and AI execution details.
- Make source traceability visible rather than burying it.
- Display empty, loading, error, permission-denied and success states for every data-driven view.
- Every screen must work at desktop, tablet and mobile widths.
- Favor clarity over decorative effects. Motion should be subtle and purposeful.

---

## 2. Technical decisions

### Preferred frontend stack

Use the existing frontend technology if one is already established and healthy. If no frontend exists, use:

- **React + TypeScript + Vite** for the application shell and build tooling.
- **React Router** for route-based navigation and protected routes.
- **Tailwind CSS** for design tokens and responsive styling.
- **shadcn/ui (Radix primitives)** for accessible, composable UI primitives; own the resulting component code in the repository.
- **Lucide React** for consistent icons.
- **TanStack Query** for server state, caching, invalidation, retries and polling.
- **React Hook Form + Zod** for forms and runtime validation.
- **Recharts** only where real backend data supports meaningful charts. Do not invent chart data.
- **Sonner** (or the existing toast system) for concise notifications.
- **Vitest + React Testing Library** for unit/component tests; **Playwright** for critical end-to-end flows.

Do not add every library automatically. Check existing dependencies first and justify additions. Keep bundle size and maintenance cost under control.

### Architecture rules

- TypeScript strict mode; avoid `any` and unsafe casts.
- Feature-oriented folders; UI components should not contain API transport logic.
- Central typed API client; central error normalization; central auth/session handling.
- Server state belongs in TanStack Query. Avoid duplicating API data in global client state.
- Use local/component state for ephemeral UI state (open dialogs, active tabs, filters not reflected in the URL).
- Keep access tokens in memory where practical. Do not use localStorage/sessionStorage for long-lived bearer tokens unless a documented security decision is made. The backend currently returns a short-lived JWT bearer token and has no refresh-token endpoint or cookie session. A full page reload may therefore require re-authentication if the token is memory-only; explain this trade-off and do not invent refresh support.
- Never put tokens in query parameters or browser history.
- Use `Authorization: Bearer <token>` for protected endpoints.
- API base URL must come from a public frontend environment variable, e.g. `VITE_API_BASE_URL`; never place backend secrets in Vite variables.
- Set a configurable request timeout, handle abort/cancellation and avoid retrying non-idempotent POST requests automatically.
- Use API response types that match the backend exactly. Derive or validate types from the OpenAPI specification where practical, but verify the generated contract against route/schema implementation because documentation can drift.

### Suggested frontend structure

Adapt to the actual repository before creating files. Suggested shape:

```text
frontend/
  public/
  src/
    app/
      App.tsx
      router.tsx
      providers.tsx
      query-client.ts
    assets/
    components/
      ui/
      layout/
      feedback/
      data-display/
    features/
      auth/
        api.ts
        types.ts
        hooks.ts
        components/
        pages/
      dashboard/
      projects/
      documents/
      requirements/
      workflows/
      artifacts/
      approvals/
      exports/
      settings/
    lib/
      api-client.ts
      api-errors.ts
      auth-store.ts
      env.ts
      formatters.ts
      permissions.ts
      validation.ts
    styles/
      globals.css
      tokens.css
    test/
  .env.example
  package.json
  tsconfig.json
  vite.config.ts
```

If the repository has a different monorepo layout, follow that rather than forcing this exact path.

---

## 3. Visual design system

### Art direction

Create a polished, editorial SaaS interface with a light neutral canvas, deep ink typography, crisp cards, understated borders and one distinctive indigo/violet accent. A dark mode may be included only after light mode is coherent and contrast-tested.

### Suggested palette (centralized tokens)

- App background: warm near-white `#F7F8FC`.
- Main surface: `#FFFFFF`.
- Primary text: deep ink `#171A2B`.
- Secondary text: slate `#687086`.
- Borders: cool light gray `#E7E9F0`.
- Primary accent: rich indigo `#5546D7`.
- Accent tint: pale lavender `#F0EEFF`.
- Success: accessible green; warning: amber; danger: red; info: blue.

These are starting values, not a mandate. Define semantic tokens (`--background`, `--surface`, `--foreground`, `--muted`, `--border`, `--primary`, `--success`, `--warning`, `--danger`) and use them everywhere. Avoid hard-coded color values scattered throughout components.

### Typography

Use a clean modern sans-serif such as Inter or Geist. Establish a scale for display, page title, section title, body, label and caption. Keep body text comfortably readable. Use tabular numerals for metrics and timestamps.

### Layout

- Desktop: collapsible left sidebar (approximately 248 px expanded), compact top header and content canvas with a sensible max width.
- Tablet: collapsible sidebar or drawer.
- Mobile: slide-in navigation drawer, sticky compact header and stacked content.
- Main content should not become excessively wide; use responsive grids and readable text widths.

### Component standards

Build reusable, consistent: buttons, icon buttons, form fields, select/combobox, textarea, badges, status chips, tabs, breadcrumbs, cards, dialogs, drawers, dropdowns, tooltips, tables, pagination, skeletons, empty states, error panels, confirmation dialogs, file dropzone, progress indicators, timeline, code/JSON viewer and toast notifications.

- Use semantic HTML and accessible labels.
- Visible focus states; keyboard support; correct dialog focus trapping and escape behavior.
- Do not rely on color alone to communicate status.
- Ensure WCAG 2.2 AA color contrast for text and controls.
- Respect `prefers-reduced-motion`.

---

## 4. Application navigation and page map

### Public routes

- `/login`
- `/register`

### Authenticated routes

- `/app` — overview/dashboard.
- `/app/projects` — projects list.
- `/app/projects/new` — create project.
- `/app/projects/:projectId` — project overview.
- `/app/projects/:projectId/documents` — source document library.
- `/app/projects/:projectId/requirements` — requirements register.
- `/app/projects/:projectId/workflows` — run workflows and view execution history/status.
- `/app/projects/:projectId/artifacts` — stories, epics, acceptance criteria, risks, dependencies and implementation plans.
- `/app/projects/:projectId/approvals` — review queue / approval state for the project, using records available from implemented APIs only.
- `/app/projects/:projectId/exports` — export actions.
- `/app/profile` — current-user identity/session information; do not create edit-profile UI without an API.

Role-aware navigation should hide or disable actions the current user cannot perform. The backend roles are `user`, `reviewer`, `admin`, `project_owner`. Newly registered accounts receive only `user`. The backend project-owner check is based on the project record's `ownerUserId`, not merely a UI role label. Review decisions require `reviewer` or `admin` and cannot be made by the submitter. Admin role management exists as an API but there is no users-list API; do not build an invented user directory or user search screen.

### Global application shell

Sidebar sections:

- Workspace: Overview, Projects.
- Current project context (when inside a project): Overview, Documents, Requirements, AI Workflows, Deliverables, Approvals, Exports.
- Bottom area: current user identity, role labels, sign out.

Header:

- Breadcrumbs based on route.
- Project context title where relevant.
- Optional global command/search only if it is genuinely implemented locally; do not show a nonfunctional search box.
- Notification UI should not be shown unless notifications exist in the backend.

---

## 5. Page-level requirements

### 5.1 Login and registration

Design an elegant split layout: concise product value proposition/abstract workflow illustration on one side and a focused form on the other. On mobile, collapse into a single-column form.

Login fields: email, password. Registration fields: email, password, confirm password. Show password requirements: 12–128 characters. Email is normalized by the backend. Include show/hide password, loading state, inline validation, accessible error text and password manager support.

Successful registration and login both return an access token and user object. Store the token using the agreed in-memory session strategy, call `/auth/me` to validate the session on app initialization where a token exists, and route to `/app`. Handle duplicate email (`409`), invalid credentials (`401`), validation (`400`) and rate limiting (`429`). Do not claim forgot-password, email verification, social login, MFA or refresh-token capabilities; no such endpoints exist in phaseone.

### 5.2 Dashboard / overview

Purpose: orient the user and provide clear next steps.

Include:

- Greeting based on current user email or safe display identity; do not fabricate a person's name.
- Primary CTA: Create project.
- Recent/available projects based on `GET /projects`.
- Helpful onboarding checklist when no projects exist: create a project → upload source documents → analyze requirements.
- Recent project cards with name, description, active/archived status and created/updated dates.
- Summary tiles only when metrics can be calculated from loaded project data. Do not show fictional metrics like “hours saved” or “AI accuracy”.
- Clear empty, loading and API error states.

There is no cross-project endpoint for dashboard counts, activities or recent executions. Do not create those as live backend features. If counts are derived from each project's fetched resources, label the scope and avoid excessive sequential requests.

### 5.3 Projects list and create project

List accessible projects from `GET /projects?page=&limit=`. Support search/filter client-side over the currently fetched page only unless the backend later supports search. Provide table/list and card views if useful, with pagination that respects server page/limit metadata.

Project card/table fields: name, short description, Active/Archived status, created/updated timestamps. The current API supports create, list and get project; it does not expose project update, archive, delete or clone. Do not show those actions as functional.

Create modal/page: project name (1–160 chars), description (0–4000 chars). After creation, navigate to the project workspace and invalidate project queries.

### 5.4 Project overview

Fetch `GET /projects/:id`. Show project title, description, status, created/updated dates and a concise workflow guide. Provide quick actions: upload documents, review requirements, run analysis, create deliverable, export.

Use available project counts only after fetching actual resources. Make it clear when a section is empty. Do not show project settings/edit controls because no project update endpoint exists.

### 5.5 Document library and upload

This is a core product screen. Use a refined drag-and-drop dropzone with browse button, file icon/type, name, size and upload progress where transport permits. Accept only:

- PDF (`application/pdf`, `.pdf`)
- DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `.docx`)
- UTF-8 plain text (`text/plain`, `.txt`)

Maximum file size is **5 MiB per file**. The backend accepts one file per upload request. It checks extension/MIME and basic content signature. The frontend must validate early but the backend remains authoritative. Clearly reject unsupported formats and files exceeding the limit. Upload using multipart field name `file` to `POST /projects/:id/documents`; do not manually set multipart `Content-Type` if the browser must add its boundary.

List metadata from `GET /projects/:id/documents`: document ID, filename, MIME type, size, upload date, status. The API intentionally excludes content bytes from responses. Do not promise preview, in-browser PDF reader, download, reprocessing, rename or delete: no endpoints currently exist. You may display a file-type icon and metadata only.

Important UX: show a confirmation / privacy note before sending source documents to an AI provider. Backend workflow processing sends selected source text and project context to the configured OpenAI or Groq provider. The user must ensure they are authorized to share those documents.

### 5.6 Requirements register

List from `GET /projects/:projectId/requirements?page=&limit=`. Include columns/cards:

- ID (shortened display only; full ID in details/copy affordance)
- Title and description preview
- Type: `business`, `functional`, `non_functional`
- Priority: `low`, `medium`, `high`, `critical`
- Status: `draft`, `reviewed`, `approved`, `rejected`
- Version
- Source document references / traceability document IDs
- Updated date

Filters: status, type, priority. Search current loaded result set only unless API supports server search. A details drawer/page should reveal full description, source facts, assumptions, open questions, traceability and version information.

Create/edit: create using `POST /projects/:projectId/requirements` with title, description, type, priority, sourceFacts, assumptions, openQuestions and `documentIds`. Edit using `PATCH /requirements/:id`; only send changed allowed fields. The backend saves prior version, increments version and returns it to draft. Display that change transparently.

Version history: `GET /requirements/:id/versions`. Show timeline with version, actor, reason and timestamp when fields are available in the returned snapshot. Inspect actual `VersionRecord` shape before binding all labels.

Do not hard-delete requirements; no delete API exists.

### 5.7 AI workflows

Create a polished AI workbench, not a chat-only UI. Display workflow cards with a short explanation, what inputs are required, an explicit “Run” action and the expected draft output.

Implemented workflow submissions:

| UI action | Method and endpoint | Backend workflow name | Notes |
|---|---|---|---|
| Analyze requirements | `POST /requirements/analyze` | `requirements-analysis` | Requires at least one source document. |
| Extract requirements | `POST /requirements/extract` | `requirements-extraction` | Requires source docs; max 10 documents per run. |
| Generate user stories | `POST /stories/generate` | `story-generation` | Requires at least one requirement. |
| Generate acceptance criteria | `POST /acceptance-criteria/generate` | `acceptance-criteria-generation` | Requires at least one story; optionally send `storyId`. |
| Validate requirements | `POST /requirements/validate` | `requirements-validation` | Requires requirements or artifacts. |
| Analyze risks | `POST /risks/analyze` | `risk-analysis` | Requires at least one requirement. |
| Generate roadmap | `POST /roadmap/generate` | `roadmap-generation` | Requires at least one requirement. |

Request body schema:

```json
{
  "projectId": "project-id",
  "documentIds": ["document-id"],
  "requirementIds": ["requirement-id"],
  "storyId": "optional-story-id"
}
```

Only include applicable optional fields. The request schema allows optional arrays with bounds, and the service enforces 10 documents, at most 40,000 extracted input characters, project ownership of selected records, and relevant preconditions. The frontend should make relevant selections explicit, show the selected source set and avoid submitting empty selections.

After submission, API returns HTTP `202` with an execution record. Poll `GET /executions/:id` using TanStack Query at a modest interval (e.g. 1.5–3 seconds) while status is `queued` or `running`; stop polling on `completed` or `failed`, on unmount, and after a bounded timeout. Do not poll forever. Respect `Retry-After` if present. Show:

- Queued / running / completed / failed state.
- Workflow name and execution ID.
- Node states and status timeline from `nodeStates`.
- Started/completed timestamps and duration when available.
- Model and usage token counts only if returned.
- Validated result when complete: summary, requirement IDs, artifact IDs, stakeholders, assumptions, open questions, recommendations, uncertainties, clarificationRequired and findings.
- Safe generic failure message from backend. Do not expose stack traces, raw provider errors or secrets.

The result is still a draft. Provide links to created requirements/artifacts and ask users to inspect citations/source facts before requesting approval. AI workflow submissions are rate-limited to 10 per 15 minutes per client IP. There is no idempotency key, so do not auto-retry a failed POST; a repeated click may create another run and incur another provider request/cost. Disable the run button while the request is in flight and show a clear confirmation before submission.

The frontend cannot display real-time graph execution events: status is read by polling the execution endpoint. Do not invent WebSocket/SSE support.

### 5.8 Deliverables / artifacts

Artifacts are stored through `POST /projects/:id/artifacts`, listed by `GET /projects/:id/artifacts?page=&limit=`, edited with `PATCH /artifacts/:id`, and version history through `GET /artifacts/:id/versions?type=...`.

Supported types:

- `epic`
- `story`
- `acceptance_criteria`
- `business_rule`
- `risk`
- `dependency`
- `implementation_plan`

Common fields: id, projectId, type, title, description, status, requirementIds, data, version, createdByUserId, createdAt, updatedAt. `data` is type-specific; inspect actual generated schema/result examples before rendering specialized detail fields. Provide a safe generic JSON/detail view for unknown data keys rather than silently dropping data.

Display status: draft, reviewed, approved, rejected. Create and edit forms must preserve type-specific structured `data` and requirement links. An edit during pending approval returns `409`; show that editing is blocked until the review is resolved. Editing creates a new version and returns the artifact to draft.

Use clear visual distinction between AI-generated drafts and human-approved content. Do not claim the AI result is final or certified.

### 5.9 Approvals and review experience

Submit a requirement/artifact using `POST /approvals` with:

```json
{
  "projectId": "project-id",
  "artifactType": "requirement",
  "artifactId": "artifact-id",
  "comments": "Optional context for reviewer"
}
```

The API returns a pending approval. Reviewer/admin decisions use `PATCH /approvals/:id` with `decision` set to `approved`, `rejected` or `changes_requested`, and optional comments. No self-review is permitted. A completed approval cannot be changed. Approvals create a version snapshot and update the underlying artifact status.

**Current API limitation:** phaseone exposes approval creation and decision by ID but no endpoint to list approvals / fetch approval details / list a reviewer queue. Do not build a pretend live approvals inbox. For this phase of the UI, only show approval submission on a resource where its state is known, and show decision controls only when an approval record is obtained from a supported API context. If the API cannot supply the approval ID to the intended user, clearly document this dependency as a backend gap and do not invent it. A future UI-ready approvals queue requires backend list/query endpoints.

Do not build user assignment dropdowns: the API has no user directory/search endpoint and approval creation does not allow selecting a reviewer.

### 5.10 Exports

Support JSON, Markdown and CSV using `GET /projects/:id/export?format=json|markdown|csv`. The response is an attachment; use a robust download helper with safe filename handling, progress/timeout/error UX and revoke any object URLs. Do not claim uploaded document file bytes are included: the backend exporter explicitly excludes document bytes.

---

## 6. API contract and client behavior

### Base URL and routes

Base path: `/api/v1`; Swagger UI is at `/api-docs` on the backend host.

Use environment config:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Never hardcode `localhost` in production code. Validate required environment variables at startup and give a clear configuration error.

### Success envelope

Most JSON endpoints respond:

```json
{
  "success": true,
  "data": {},
  "requestId": "request-id"
}
```

The export endpoint returns a file attachment rather than this JSON envelope.

### Error envelope

Errors use a shared envelope containing `success: false`, `error.code`, `error.message`, `error.details` and `requestId`. Normalize this centrally. Map common HTTP status codes:

- `400`: validation / unsupported file / malformed input.
- `401`: missing/expired/invalid token or wrong login credentials.
- `403`: authenticated but role/operation forbidden.
- `404`: resource missing or inaccessible (do not reveal another project's existence).
- `409`: duplicate email, conflicting approval or artifact edit during pending review.
- `413`: oversized upload or workflow input.
- `429`: rate limited.
- `503`: service unavailable or AI provider not configured.

Show friendly user-facing text; preserve request ID in an expandable “Support details” area to aid debugging. Never show raw internal exception content.

### Auth endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | No | Register standard user. |
| POST | `/auth/login` | No | Login and receive JWT. |
| GET | `/auth/me` | Bearer | Validate token and retrieve current user. |

### Projects/documents/resources

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/projects?page=&limit=` | Bearer | List accessible projects. |
| POST | `/projects` | Bearer | Create project. |
| GET | `/projects/:id` | Bearer | Get project. |
| PATCH | `/projects/:id/members` | Bearer + owner | Replace member IDs. |
| POST | `/projects/:id/documents` | Bearer | Upload one file using multipart `file`. |
| GET | `/projects/:id/documents` | Bearer | List document metadata. |
| GET | `/projects/:id/requirements?page=&limit=` | Bearer | List requirements. |
| POST | `/projects/:id/requirements` | Bearer | Create draft requirement. |
| PATCH | `/requirements/:id` | Bearer | Revise requirement. |
| GET | `/requirements/:id/versions` | Bearer | Requirement versions. |
| GET | `/projects/:id/artifacts?page=&limit=` | Bearer | List artifacts. |
| POST | `/projects/:id/artifacts` | Bearer | Create artifact. |
| PATCH | `/artifacts/:id` | Bearer | Revise artifact. |
| GET | `/artifacts/:id/versions?type=` | Bearer | Artifact versions. |
| POST | `/approvals` | Bearer | Submit draft for review. |
| GET | `/projects/:projectId/approvals?decision=&page=&limit=` | Bearer + reviewer/admin | List project approvals. |
| GET | `/approvals/:id` | Bearer + reviewer/admin | Read approval and current resource. |
| PATCH | `/approvals/:id` | Bearer + reviewer/admin | Decide approval; submitter cannot review own request. |
| PATCH | `/users/:id/roles` | Bearer + admin | Change another user's roles. |
| GET | `/projects/:id/export?format=` | Bearer | Download project export. |

### Important implementation details

- Attach bearer auth only for protected routes.
- On `401`, clear the in-memory session and redirect to login while preserving a safe intended return path (never preserve tokens or sensitive form payloads in the URL).
- Do not log request bodies, bearer headers, uploaded files, AI prompts or generated content by default.
- Do not retry `POST` automatically. Retry safe GET requests selectively with bounded backoff.
- Invalidate the specific related TanStack Query keys after successful mutations.
- Cancel stale requests on route changes where possible.
- Protect against race conditions when users rapidly switch projects.
- Use AbortController for uploads/workflow request cancellation where supported; understand that aborting a browser request does not necessarily cancel a server-side workflow already accepted.
- Display a global API connectivity / readiness indicator only if it calls `/health/ready` intentionally and does not imply more than it checks. The health endpoint returns storage readiness (`storage: json`), not LLM readiness. AI provider readiness should be inferred from a workflow response, not the health check.

---

## 7. Data models for frontend types

Create typed interfaces from the backend source schemas. The following are core shapes; re-check source files before implementation and keep fields optional only where backend schemas mark them optional.

```ts
type UserRole =
  | "business_analyst"
  | "product_owner"
  | "delivery_lead"
  | "admin";
type ProjectStatus = "active" | "archived";
type RequirementType = "business" | "functional" | "non_functional";
type Priority = "low" | "medium" | "high" | "critical";
type ResourceStatus = "draft" | "reviewed" | "approved" | "rejected";
type ArtifactType =
  | "epic"
  | "story"
  | "acceptance_criteria"
  | "business_rule"
  | "risk"
  | "dependency"
  | "implementation_plan";
type ApprovalDecision = "pending" | "approved" | "rejected" | "changes_requested";
type ExecutionStatus = "queued" | "running" | "completed" | "failed";

interface AuthUser {
  id: string;
  email: string;
  roles: UserRole[];
}
interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
interface Project {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
  members: string[];
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
interface DocumentMetadata {
  id: string;
  projectId: string;
  uploadedByUserId: string;
  fileName: string;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "text/plain";
  sizeBytes: number;
  status: "uploaded";
  createdAt: string;
}
interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: RequirementType;
  status: ResourceStatus;
  priority: Priority;
  sourceFacts: string[];
  assumptions: string[];
  openQuestions: string[];
  traceability: {
    documentIds: string[];
    sourceFactReferences?: Array<{ documentId: string; text: string }>;
    executionId?: string;
  };
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
interface Artifact {
  id: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  description: string;
  status: ResourceStatus;
  requirementIds: string[];
  data: Record<string, unknown>;
  version: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
interface Approval {
  id: string;
  projectId: string;
  artifactType: "requirement" | ArtifactType;
  artifactId: string;
  submittedByUserId: string;
  reviewerUserId?: string;
  decision: ApprovalDecision;
  comments: string;
  createdAt: string;
  updatedAt: string;
}
interface Execution {
  id: string;
  projectId: string;
  workflowName: string;
  status: ExecutionStatus;
  model?: string;
  usage?: { requestCount: number; inputTokens: number; outputTokens: number };
  nodeStates: Array<{
    node: string;
    status: "pending" | "running" | "completed" | "failed";
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}
interface VersionRecord {
  id: string;
  projectId: string;
  artifactType: "requirement" | ArtifactType;
  artifactId: string;
  version: number;
  snapshot: Record<string, unknown>;
  actorUserId: string;
  reason: string;
  createdAt: string;
}
```

Pagination response shape must be inspected in `backend/src/config/storage.ts` and `backend/src/common/utils/pagination.ts`; do not assume `items`, `page`, `limit`, `total` fields without checking the exact implementation.

---

## 8. Security, privacy and reliability requirements

- Do not store passwords or password hashes in the frontend.
- JWT must never appear in logs, URLs, error telemetry or screenshots.
- Do not persist uploaded document contents in browser storage.
- Clear in-memory auth state on logout and unauthorized responses.
- Avoid XSS: render user-provided descriptions and AI output as text by default. If Markdown rendering is added, sanitize it and disable unsafe HTML.
- Avoid `dangerouslySetInnerHTML` unless a reviewed sanitizer is used.
- Use strict file accept/type/size checks client-side and rely on backend validation as final authority.
- Treat AI output, filenames, document text and all API data as untrusted input.
- Show AI-generated content as draft and include a human-review step.
- Confirm before sending documents/context to an LLM provider; explain that the backend sends selected source text and project context to the configured provider.
- Do not leak cross-project data through query cache keys. Include project IDs in resource keys and clear user-scoped cache on logout.
- Add CSP/security headers at the hosting layer where feasible; do not attempt to weaken Helmet defaults from the frontend.
- Avoid collecting personal analytics unless approved; never send document content or requirement details to analytics.
- Handle revoked/expired token, network failure, server unavailable, rate limits, invalid provider setup and malformed response defensively.
- Add accessible confirmation for destructive-looking actions. Since deletion endpoints are absent, do not implement deletion now.

### Known backend deployment boundary

The current phaseone README describes temporary JSON storage and in-process workflow execution. It is single-process, not multi-replica, and workflow runs are not resumable after process crash. Frontend can be production-minded, but the overall system must not be marketed as production-ready until backend persistence, durable execution/queueing, deployment, backup/restore, TLS/CORS and operational controls are addressed. Do not solve those issues in frontend code.

---

## 9. Testing and quality gates

### Required checks

- TypeScript strict typecheck passes.
- Production build passes.
- Lint passes with no newly introduced warnings of concern.
- Unit tests cover API client/auth/error handling, validation and permission gating.
- Component tests cover login/register, project creation, upload validation, requirement edit and workflow status display.
- E2E smoke test covers register/login, create project, upload valid document, list it, run a workflow only with configured test backend/provider, poll completion, inspect result and export. Do not require live provider credentials in normal CI; use a controlled fake provider/test backend for deterministic tests.
- Accessibility test on login, app shell, document upload and data tables; keyboard navigation and focus management manually checked.
- Responsive tests at approximately 375 px, 768 px, 1024 px and 1440 px.
- No horizontal overflow, broken routes, console errors, unhandled promise rejections or secret leakage.

### Definition of done per page

- Matches design tokens and responsive layout.
- Correct API endpoint/method/body and runtime validation.
- Loading, empty, success, error and permission states.
- Keyboard-accessible interactions and semantic HTML.
- Unit/component tests for primary behavior.
- No fake live data or nonfunctional controls.

---

## 10. Delivery phases — approval required between each

### Phase 1 — Frontend assessment and implementation blueprint

**Scope:** Inspection only. No application implementation.

Tasks:
1. Inspect root structure and identify any existing frontend, package manager and conventions.
2. Inspect backend endpoint source, Zod schemas, storage response shapes and OpenAPI docs.
3. Confirm route/method/body/response contracts and document any OpenAPI drift.
4. Identify UI features blocked by absent backend endpoints.
5. Propose component architecture, route map, API client approach and dependency list.
6. Produce/update a frontend assessment document only if approved by user or a clearly suitable documentation location exists.

**Deliver:** assessment report, backend-to-frontend capability matrix, implementation plan and unresolved questions. Stop for approval.

### Phase 2 — Frontend scaffold and design system

**Start only after Phase 1 approval.**

Tasks:
1. Create frontend app using the approved stack and existing repo conventions.
2. Configure TypeScript strict mode, lint, formatting, testing and environment validation.
3. Implement global tokens, typography, buttons, fields, cards, dialog/drawer, badges, table, skeleton, empty/error states and responsive shell foundation.
4. Add router and placeholder route boundaries without implementing later feature behavior.
5. Verify build, lint, tests and responsive shell.

**Deliver:** runnable shell and reusable design primitives. Stop for approval.

### Phase 3 — Authentication and app shell

**Start only after Phase 2 approval.**

Tasks:
1. Implement API client, response/error normalization and bearer interceptor.
2. Implement in-memory session, register, login, `/auth/me`, logout and protected routes.
3. Implement desktop/mobile sidebar and header, route breadcrumbs and role-aware navigation.
4. Build polished login/register screens.
5. Add tests for validation, token expiry/401, forbidden state and route protection.

**Deliver:** authenticated shell with real backend login. Stop for approval.

### Phase 4 — Dashboard and projects

**Start only after Phase 3 approval.**

Tasks:
1. Projects list with pagination and accessible empty/loading/error states.
2. Create project form and project overview.
3. TanStack Query keys, cache invalidation and route handling.
4. Responsive project cards/table and quick actions.
5. Verify against backend.

**Deliver:** users can create, list and open actual projects. Stop for approval.

### Phase 5 — Document library and upload

**Start only after Phase 4 approval.**

Tasks:
1. Drag/drop and browse upload component.
2. Client file validation (PDF/DOCX/TXT, one per request, max 5 MiB).
3. Multipart upload integration and metadata list.
4. Upload progress/error states, duplicate filename handling in UI without claiming backend deduplication.
5. Document-to-AI privacy confirmation and tests.

**Deliver:** upload and list valid source documents. Stop for approval.

### Phase 6 — Requirements management

**Start only after Phase 5 approval.**

Tasks:
1. Requirements list with server pagination and client filters.
2. Requirement detail drawer/page with traceability, facts, assumptions and questions.
3. Create/edit forms with Zod validation.
4. Version history timeline.
5. Status/priority/type chips and accessible data table.

**Deliver:** complete requirement register using live APIs. Stop for approval.

### Phase 7 — AI workflow workbench

**Start only after Phase 6 approval.**

Tasks:
1. Workflow selection cards and context selection forms.
2. Explicit provider/privacy confirmation before document workflows.
3. Submit the seven implemented workflow types with valid body fields.
4. Poll execution state with bounded lifecycle and display node states.
5. Render validated results, references, uncertainty and draft labels.
6. Guard against duplicate submission and automatic POST retries.
7. Add tests with deterministic workflow fixtures/fake API.

**Deliver:** user can run and track available LangGraph workflows. Stop for approval.

### Phase 8 — Artifacts and version history

**Start only after Phase 7 approval.**

Tasks:
1. Artifacts list/detail for all supported types.
2. Create/edit artifact forms, generic data inspector and requirement linking.
3. Artifact version history.
4. Pending approval conflict UX (`409`).
5. Link workflow-generated artifacts to their records and distinguish AI draft from human-reviewed state.

**Deliver:** deliverables workspace. Stop for approval.

### Phase 9 — Approval UX and backend-gap report

**Start only after Phase 8 approval.**

Tasks:
1. Implement submission-for-review action on supported draft resources.
2. Implement review decision controls only where the frontend has a valid approval ID and known record from supported APIs.
3. Enforce client-side role/self-review guidance while still relying on backend authorization.
4. Load the reviewer queue from the project-scoped approval list endpoint and inspect records through the approval detail endpoint.
5. Use only the documented approval endpoints; do not fabricate queue records.

**Backend support:** `GET /projects/{projectId}/approvals` provides a paginated, decision-filterable queue. `GET /approvals/{id}` returns the approval and its current requirement or artifact. Both are reviewer/admin-only and enforce project access; `PATCH /approvals/{id}` remains responsible for decisions and self-review prevention.

**Deliver:** API-conformant submission and reviewer decision workflows backed by verified approval records. Stop for approval.

### Phase 10 — Exports, hardening and release readiness

**Start only after Phase 9 approval.**

Tasks:
1. JSON/Markdown/CSV export downloads.
2. Full responsive, keyboard and accessibility review.
3. Security review, route/cache isolation and error handling review.
4. Unit/component/E2E coverage for critical workflows.
5. Performance review (bundle splitting, lazy routes, image/font loading, render stability).
6. Production environment and deployment documentation for the frontend only; do not claim backend infrastructure is production-hardened.
7. Final handover, known limitations and backend dependencies.

**Deliver:** frontend release candidate and readiness report. Stop for approval.

---

## 11. Required phase completion report format

At the end of every phase, provide:

1. Phase number and name.
2. Summary of completed work.
3. Exact files created, modified and deleted (deletions require prior approval).
4. Commands run.
5. Actual build/lint/typecheck/test results (do not fabricate or say “passed” if not run).
6. Screenshots or a clear description of responsive verification.
7. Backend endpoints used and any contract discrepancies found.
8. Known defects, limitations and unresolved decisions.
9. Next phase proposal (description only; do not execute it).

Then ask exactly:

**“Phase [N] is complete. Do you approve proceeding to Phase [N+1]?”**

Stop immediately after asking. If the user requests changes, stay in the current phase and resubmit it for approval.

---

## 12. Initial Copilot prompt

Paste this into Copilot Chat:

> Read `FRONTEND_IMPLEMENTATION_PLAN.md` completely and inspect the current repository, especially the `phaseone` backend implementation and API schemas. Act as a principal frontend engineer and product designer. We are implementing the AI Business Analyst Agent frontend. Follow the specified visual direction, frontend architecture, backend API contracts, privacy/security rules, testing standards and strict phase approval protocol. Start with **Phase 1 only: assessment and blueprint**. Do not scaffold or write application code yet. Verify actual storage pagination and response types directly in source. Identify existing frontend conventions, verify the documented approval queue/read endpoints, identify remaining API gaps, and check for OpenAPI drift. Return the Phase 1 completion report and wait for my explicit approval. Do not proceed automatically.

---

## 13. Repository references reviewed

- `backend/README.md`
- `backend/package.json`
- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/projects/project.routes.ts`
- `backend/src/modules/requirements/requirement.routes.ts`
- `backend/src/modules/workflows/workflow.routes.ts`
- `backend/src/modules/approvals/approval.routes.ts`
- `backend/src/modules/artifacts/artifact.routes.ts`
- `backend/src/modules/users/user.routes.ts`
- `backend/src/modules/domain/domain.schemas.ts`
- `backend/src/workflows/workflow-service.ts`
- `backend/src/workflows/workflow.schemas.ts`
- `backend/src/config/env.ts`
- `docs/api/API-Specification.md`
- `AI_Business_Analyst_Agent_Backend_Phase_Plan.md`

**Branch inspected:** `phaseone`.
