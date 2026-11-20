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
document IDs cannot be changed through the current edit endpoint. Deliverable,
approval, and export features do not display mock business data. The
deliverables workspace is live; approval and export pages remain placeholders
until their backend-backed phases are approved.

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

Authentication uses short-lived bearer tokens held in memory only. Reloading or
closing the page clears the session and requires signing in again. New accounts
receive the standard user role; elevated roles must be assigned separately.
Document uploads are stored by the backend but are not sent to an AI provider
by uploading. Any later AI workflow that shares selected document content must
show a separate confirmation. The frontend does not persist document bytes in
browser storage.

## Quality checks

```powershell
npm run build
npm run lint
npm test
npm run format:check
```
