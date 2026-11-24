# AI Business Analyst Agent - Role-Based Test Cases

Version 1.2 addendum to [AI-Business-Analyst-Agent-Test-Cases.pdf](./AI-Business-Analyst-Agent-Test-Cases.pdf)

This addendum defines 19 role-based and administration test cases. It supplements, rather than replaces, the 80-case system test catalogue. These are manual test definitions; they have not been executed or marked pass/fail.

## Test setup

- Use isolated JSON storage and synthetic projects, users, and audit events.
- Use reserved email addresses such as `owner.one@example.test` and `admin.one@example.test`. Generate temporary passwords and do not record them.
- Configure a JWT secret of at least 32 characters and accessible JSON storage.
- Use a fake AI provider for deterministic workflow cases. Do not send sensitive documents or real user data to an AI provider.
- Record each result as Pass, Fail, Blocked, or Not run, with tester and date.

## Roles and authorization model

| Role or persona        | Meaning and expected access                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor / anonymous    | Not an application role. Can use public registration, sign-in, and health endpoints; cannot access protected data.                                                                                   |
| `business_analyst`     | Can create and prepare projects, read business and delivery resources, submit drafts for review, and export project data. Project content requires project ownership or membership.                  |
| `product_owner`        | Can read business resources and make approval decisions for accessible projects. Cannot prepare or edit requirements, and cannot decide a submission they made.                                      |
| `delivery_lead`        | Can read delivery artifacts and add delivery feedback for accessible projects. Feedback does not decide the approval.                                                                                |
| `admin`                | Can manage users, mutually exclusive role assignments, invitations, project membership metadata, templates, and audit history. Admin does not grant access to project content or approval decisions. |
| Project owner / member | Project relationships used with a project role's read permission. Ownership or membership alone is not an application role or approval permission.                                                   |
| System / operator      | Operational persona, not an application role. Configures startup environment and JSON storage and performs the first-admin bootstrap.                                                                |

## Test cases

### ACL-008: Project role does not replace project membership

- **Priority:** P1
- **Actor:** `business_analyst` with and without project membership
- **Level:** API
- **Preconditions:** Create a project and assign the `business_analyst` role to two users; add only one user as a project member.
- **Steps:** Request the project and its project-scoped resources as each account.
- **Expected result:** The unassigned user is denied without receiving project data. The assigned user can access only resources allowed by their role.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-001: Restrict administration endpoints to administrators

- **Priority:** P1
- **Actor:** `business_analyst`, `product_owner`, `delivery_lead`, and `admin`
- **Level:** API + UI
- **Preconditions:** Sign in with each role.
- **Steps:** Attempt to list users, create a template, and export audit history from each account.
- **Expected result:** The three project roles are denied administration operations; the `admin` can use them. Project-role access does not grant administration access.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### RBAC-001: Enforce role-specific navigation and actions

- **Priority:** P1
- **Actor:** All four human roles
- **Level:** UI
- **Preconditions:** Assign each role to an active user and provide project membership where required.
- **Steps:** Sign in as each role and inspect the dashboard, project navigation, project overview actions, and direct URLs for restricted sections.
- **Expected result:** Business Analysts receive preparation, document upload, and export actions; Product Owners receive business review and approval actions; Delivery Leads receive delivery review/feedback actions only; Administrators receive administration controls without project-content navigation. Restricted direct routes show an access-denied state.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### APR-001: Keep approval decisions human and Product Owner-only

- **Priority:** P1
- **Actor:** `business_analyst`, `product_owner`, and `delivery_lead`
- **Level:** API + UI
- **Preconditions:** Create a draft requirement or artifact, submit it for review, and assign the submitter and reviewers to the project.
- **Steps:** Attempt to decide the pending approval as each role. Inspect generated workflow results before and after submission.
- **Expected result:** Only a Product Owner may approve, reject, or request changes, and the submitter cannot decide their own request. AI workflow results remain drafts and never create or perform an approval decision.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### DLV-001: Delivery feedback cannot decide an approval

- **Priority:** P1
- **Actor:** `delivery_lead` and `product_owner`
- **Level:** API + UI
- **Preconditions:** Create a pending risk, dependency, or implementation-plan approval in a project both roles can access.
- **Steps:** Add delivery feedback as the Delivery Lead, then inspect the approval status and decision actions. Make a separate decision as the Product Owner.
- **Expected result:** Delivery feedback is recorded with its actor and timestamp, leaves the approval pending, and exposes no decision action to the Delivery Lead. The Product Owner can make the decision separately.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-002: Deactivation revokes access and reactivation restores sign-in

- **Priority:** P1
- **Actor:** `admin` and the target account
- **Level:** API + UI
- **Preconditions:** Create an active non-admin account and retain a valid access token for it.
- **Steps:** Deactivate the target account; attempt sign-in and a protected request using its existing token; reactivate the account and sign in again.
- **Expected result:** Deactivation succeeds. Sign-in is rejected and the existing token can no longer access protected endpoints. Reactivation succeeds and a new sign-in works. User lifecycle events are recorded.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-003: Protect administrator accounts from unsafe deactivation

- **Priority:** P1
- **Actor:** `admin`
- **Level:** API + UI
- **Preconditions:** Sign in as an administrator. Prepare a single-active-admin state and, separately, a state with multiple active administrators.
- **Steps:** Attempt to deactivate the signed-in administrator. Then attempt to deactivate the only active administrator in the single-admin state.
- **Expected result:** Self-deactivation is rejected with a validation response. Deactivating the last active administrator is rejected with a conflict response. Other eligible accounts can be deactivated.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-004: Apply current roles to existing sessions

- **Priority:** P1
- **Actor:** `admin` and a user whose role changes
- **Level:** API
- **Preconditions:** Sign in as a Product Owner and retain the token. Sign in separately as an administrator.
- **Steps:** Change the user's role from Product Owner to Delivery Lead using administration controls. Use the retained token to request an approval queue and then sign in again.
- **Expected result:** The retained token cannot use Product Owner-only access after the role change. A new session reflects the current stored roles; no stale token grants the removed role.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-005: Keep Administrator access separate from project content

- **Priority:** P1
- **Actor:** `admin` and project-role users
- **Level:** API + UI
- **Preconditions:** Create projects with business and delivery resources, then sign in as an administrator with no project role.
- **Steps:** Request project lists, project details, documents, requirements, artifacts, approvals, and exports as the administrator. Open the Administration membership panel and inspect its project records.
- **Expected result:** The administrator is denied project content and approval access. The membership panel exposes only project ID, name, status, owner ID, and member IDs.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-006: Create and resend a one-time user invitation

- **Priority:** P1
- **Actor:** `admin` and invitee
- **Level:** API + UI
- **Preconditions:** Sign in as an administrator and configure an invitation expiry.
- **Steps:** Invite a new user, open the returned setup link, set a password, and try the link again. Separately resend an invitation for an account that has not accepted it.
- **Expected result:** The account remains inactive until password setup, the link is copyable and single-use, and the token expires. Resending invalidates the earlier link and returns a fresh link. Only a token hash is stored.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-007: Manage project membership without reading project content

- **Priority:** P1
- **Actor:** `admin`
- **Level:** API + UI
- **Preconditions:** Create a project with an owner and members who have active project roles.
- **Steps:** List metadata-only project access, add and remove eligible members, and try to assign an inactive user or another administrator.
- **Expected result:** Membership changes are audited; only active non-administrator project-role users are accepted. Project content remains unavailable to the administrator.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### TMP-001: Manage templates across all supported categories

- **Priority:** P1
- **Actor:** `admin`
- **Level:** API + UI
- **Preconditions:** Sign in as an administrator.
- **Steps:** Create, edit, and deactivate a template in each category: `project_intake`, `requirements`, `epics_stories`, `acceptance_criteria`, and `risks_roadmaps`.
- **Expected result:** Each category is accepted. Changes persist, deactivation changes the template to inactive, and the template remains in administration history rather than being hard-deleted.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### TMP-002: Deny non-admin template management

- **Priority:** P1
- **Actor:** `business_analyst`, `product_owner`, and `delivery_lead`
- **Level:** API + UI
- **Preconditions:** Sign in with each project role.
- **Steps:** Attempt to list the administrative template collection and to create, edit, or deactivate a template.
- **Expected result:** Administrative template operations are denied. No template is created or changed.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### TMP-003: Return only active templates for authenticated discovery

- **Priority:** P1
- **Actor:** Anonymous visitor and authenticated project-role user
- **Level:** API + UI
- **Preconditions:** Create active and inactive templates in at least two categories.
- **Steps:** Request active templates with and without a category filter; repeat without authentication and with an invalid category.
- **Expected result:** An authenticated user receives only active templates, and a valid category filter returns only that category. Anonymous access and invalid categories are rejected.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### TMP-004: Validate template selection by status and category

- **Priority:** P1
- **Actor:** `business_analyst` with project access
- **Level:** API + UI
- **Preconditions:** Prepare an active intake template, active workflow templates, an inactive template, and a template of the wrong workflow category.
- **Steps:** Create a project using the active intake template. Start a workflow using a matching active template, then try the inactive and wrong-category templates.
- **Expected result:** Matching active templates are accepted. Inactive and wrong-category selections are rejected. Template guidance does not bypass the workflow's structured-output validation.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### AUD-001: Record and retain administrative audit events

- **Priority:** P1
- **Actor:** `admin`
- **Level:** API
- **Preconditions:** Use isolated JSON storage with audit history available.
- **Steps:** Deactivate and reactivate a user, create and deactivate a template, and export a project. Inspect paginated audit history and later exports.
- **Expected result:** The corresponding lifecycle, template, and project-export events identify the actor and affected resource. Existing events remain available after later operations; no purge action is exposed.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### AUD-002: Export complete audit history as JSON and CSV

- **Priority:** P1
- **Actor:** `admin`
- **Level:** API + UI
- **Preconditions:** Generate multiple audit events across users, templates, and projects.
- **Steps:** Download the default JSON export and the CSV export. Try an unsupported format and repeat the export as a non-admin.
- **Expected result:** JSON and CSV downloads contain the audit history and the export action is itself recorded. An unsupported format is rejected; a non-admin cannot export audit history.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### AUD-003: Neutralize spreadsheet formula values in CSV exports

- **Priority:** P1
- **Actor:** `admin`
- **Level:** API
- **Preconditions:** In isolated test data, create an audit field whose value begins with a spreadsheet formula character such as `=`, `+`, `-`, or `@`, and include quotes in another value.
- **Steps:** Download the CSV export and inspect the affected cells.
- **Expected result:** Cells are quoted and formula-leading values are neutralized so opening the CSV does not execute them as formulas. Embedded quotes are escaped correctly.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### SYS-010: Load legacy JSON data with lifecycle defaults

- **Priority:** P1
- **Actor:** System / operator
- **Level:** Storage + API
- **Preconditions:** Prepare a valid prior-version JSON storage file with users but without the newer user `active` fields and without a template collection.
- **Steps:** Start the backend against the file, authenticate an existing user, and read the administrative template collection as an administrator.
- **Expected result:** Startup succeeds without destructive migration. Existing users default to active and the missing template collection defaults to empty; other existing records remain available.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________
