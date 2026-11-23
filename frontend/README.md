# AI Business Analyst Agent — Frontend

The frontend is a standalone React, TypeScript, and Vite application. It includes
the responsive workspace shell, in-memory authentication, a live dashboard,
paginated project browsing, project creation, project overview, a live project
document library, a backend-backed requirements register, and a deliverables
workspace. The document library accepts one PDF, DOCX, or plain-text TXT file
per upload (up to 5 MiB), shows upload progress and returned metadata, and does
not provide preview, download, rename, or delete actions. The project AI
workbench offers seven backend-backed workflows with explicit context
selection, privacy confirmation for document-based runs, execution polling,
and validated draft results.

The requirements register supports server pagination, current-page search and
filters, source-document links on creation, requirement details and traceability,
editable fields supported by the API, and a validated version-history timeline.
Editing creates a new version and resets the requirement to draft; linked
document IDs cannot be changed through the current edit endpoint. The
deliverables and project export workspaces are live. Reviewers and admins can
load a project-scoped approval queue, inspect the submitted requirement or
artifact, and record decisions. The backend enforces role, project access, and
self-review restrictions.

## Implementation phase status

Status reviewed against the current frontend code on 2026-11-23. This is an
implementation snapshot, not evidence that the approval gates in
`backend/FRONTEND_IMPLEMENTATION_PLAN.md` were formally granted.

| Phase                             | Status                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Assessment and blueprint       | Documented in the implementation plan and this README.                                                                                                                                                                                                                                                                                                                            |
| 2. Scaffold and design system     | Implemented.                                                                                                                                                                                                                                                                                                                                                                      |
| 3. Authentication and app shell   | Implemented.                                                                                                                                                                                                                                                                                                                                                                      |
| 4. Dashboard and projects         | Implemented.                                                                                                                                                                                                                                                                                                                                                                      |
| 5. Document library and upload    | Implemented.                                                                                                                                                                                                                                                                                                                                                                      |
| 6. Requirements management        | Implemented.                                                                                                                                                                                                                                                                                                                                                                      |
| 7. AI workflow workbench          | Implemented for all seven backend workflows.                                                                                                                                                                                                                                                                                                                                      |
| 8. Artifacts and version history  | Implemented.                                                                                                                                                                                                                                                                                                                                                                      |
| 9. Approval UX                    | Implemented: draft requirements and artifacts can be submitted for review; reviewers/admins can list and inspect project approvals and approve, reject, or request changes. The backend enforces reviewer role, project access, pending-only transitions, and no self-review.                                                                                                     |
| 10. Exports and release readiness | Partially implemented: JSON, Markdown, and CSV downloads are live; routes are code-split; and query caches are cleared when the signed-in token changes. Playwright covers the key authenticated flows with mocked API responses, while axe checks key routes at desktop and mobile widths. Full app-wide accessibility/security review and production hosting validation remain. |

The frontend uses lazy route loading with a shared loading state. In-memory
query data is cleared when the access token changes or the user signs out.

## AI workflow workbench

The project workbench supports requirement analysis and extraction, story and
acceptance-criteria generation, requirements validation, risk analysis, and
roadmap generation. Each workflow describes its required inputs and expected
draft output. It reuses project documents, requirements, and artifacts from the
verified API endpoints; it does not fabricate a previous-run history list.

Document-based workflows require one to ten explicitly selected documents and
a separate confirmation that the user is authorized to share their content.
The confirmation explains that the selected document text and project context
are sent to the AI provider configured by the service. Provider readiness is
not exposed by the backend. Other workflows still send project requirements
and artifact context; existing artifacts are included automatically and cannot
be individually deselected. The service supports at most 100 requirements and
100 artifacts in context and enforces a 40,000-character input limit.

Execution status is polled every two seconds for at most five minutes and
honors `Retry-After`. Polling stops on a terminal state, page unmount, or the
timeout. Leaving the workbench does not cancel a run accepted by the backend.
Runs started during the current page visit are shown in the workbench; the
backend does not currently expose an execution-history list endpoint. Workflow
submissions are never retried automatically because the API has no idempotency
key, and a repeated request may start a duplicate run. Completed output is
validated before display and remains a draft for human review.

## Deliverables workspace

The project deliverables workspace lists the seven supported artifact types
with server pagination and current-page search and filters. It opens details
from records on the loaded page because there is no single-artifact read
endpoint. A workflow-result artifact link searches the paginated project list
backward from the newest page (up to 2,000 recent artifacts) for that specific
ID and opens its record. Very old records beyond that bounded lookup may need
to be located through pagination; the workbench does not invent an artifact
detail route on the backend.

Create and edit forms preserve generic type-specific JSON data and link only
requirements from the current project. Artifact type is fixed after creation.
Edits create a version and return the artifact to draft. If the backend reports
a pending-approval `409`, the form keeps its values and explains that editing
must wait for the review to resolve. Version history and snapshots are
validated before display; unknown snapshot fields remain available in the
generic inspector. AI-generated artifacts opened from workflow results are
explicitly labeled as drafts.

## Project exports

The project export page downloads JSON, Markdown, or CSV generated by the
backend. Downloads use the authenticated API client, do not persist export
data in browser storage, and exclude uploaded document contents. The backend
sets the download filename and remains responsible for formatting and
CSV-safety rules.

## Approval review

The reviewer workspace loads a paginated queue from
`GET /api/v1/projects/{projectId}/approvals` and reads the selected approval
with its current requirement or artifact through `GET /api/v1/approvals/{id}`.
The queue supports pending, approved, rejected, and changes-requested filters.
Review decisions use `PATCH /api/v1/approvals/{id}`. All three endpoints
require a reviewer or admin role and access to the project; the backend also
prevents submitters from deciding their own requests and rejects repeated
decisions. A decision invalidates the approval, requirement, and artifact
queries so the queue and resource status refresh.

## Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Start the backend API at `http://localhost:3000` before signing in. The default
`VITE_API_BASE_URL=/api/v1` sends requests through Vite's same-origin
development proxy; set `VITE_API_PROXY_TARGET` if the backend listens elsewhere.
For production, route `/api/v1` through a same-origin reverse proxy or set
`VITE_API_BASE_URL` to an absolute HTTP(S) API URL. These are public frontend
URLs, not places for backend secrets. The app shows a configuration message if
the API base URL is missing or invalid.

## Production frontend deployment

Build the static frontend with `npm run build` and serve `dist/` from a static
host configured with SPA history fallback. Set `VITE_API_BASE_URL` at build
time; Vite embeds it into the client bundle. Prefer a same-origin HTTPS reverse
proxy for `/api/v1`, or use the HTTPS URL of the API directly. The Vite
`VITE_API_PROXY_TARGET` setting is for local development only. Never put
backend secrets or provider keys in frontend environment variables. These
instructions cover the frontend only and make no production-readiness claim
about backend hosting or storage.

Authentication uses short-lived bearer tokens held in memory only. Reloading or
closing the page clears the session and requires signing in again. New accounts
receive the standard user role; elevated roles must be assigned separately.
Document uploads are stored by the backend but are not sent to an AI provider
by uploading. Any later AI workflow that shares selected document content must
show a separate confirmation. The frontend does not persist document bytes in
browser storage.

## Quality checks

The Phase 10 browser suite builds the production frontend and tests it through
Vite's local preview with isolated, mocked API responses; it creates no backend
records. It covers login, project navigation, document and requirement routes,
AI workflows, deliverables, export download/auth headers, reviewer approval
inspection and decisions, profile, keyboard interactions, mobile reflow, and
nested-route fallback.
Axe checks WCAG 2 A/AA, WCAG 2.1 A/AA, and WCAG 2.2 AA rules on key screens at
desktop and 320px widths. The suite uses the installed Google Chrome browser
channel and serves the preview on port 4174. It does not replace testing against
a live backend or a full app-wide security/accessibility audit. The test suite
still emits React `act(...)` warnings. Route splitting reduced the largest
initial JavaScript entry chunk from about 620 kB to about 360 kB.

```powershell
npm run build
npm run lint
npm test
npm run format:check
npm run test:e2e
```
