# AI Business Analyst Agent - Role-Based Test Cases

Version 1.1 addendum to [AI-Business-Analyst-Agent-Test-Cases.pdf](./AI-Business-Analyst-Agent-Test-Cases.pdf)

This addendum defines 13 role-based and recently added administration test cases. It supplements, rather than replaces, the 80-case system test catalogue. These are test definitions; they have not been executed or marked pass/fail.

## Test setup

- Use isolated JSON storage and synthetic projects, users, and audit events.
- Use reserved email addresses such as `owner.one@example.test` and `admin.one@example.test`. Generate temporary passwords and do not record them.
- Configure a JWT secret of at least 32 characters and accessible JSON storage.
- Use a fake AI provider for deterministic workflow cases. Do not send sensitive documents or real user data to an AI provider.
- Record each result as Pass, Fail, Blocked, or Not run, with tester and date.

## Roles and authorization model

| Role or persona | Meaning and expected access |
| --- | --- |
| Visitor / anonymous | Not an application role. Can use public registration, sign-in, and health endpoints; cannot access protected data. |
| `user` | Standard authenticated application role. Project access still requires project ownership or membership. |
| `project_owner` | An application role, but the role alone does not grant access to a project. Ownership is determined by the project's `ownerUserId`; membership also grants project-scoped access. |
| Project owner | A project relationship: the account whose ID is recorded as `ownerUserId`. Can access that project and manage its membership. This relationship does not require the `project_owner` role. |
| Project member | A project relationship, not an application role. Can use the project-scoped features allowed by the application. |
| `reviewer` | Can use approval functions only for projects the reviewer can access. Cannot review their own submission. |
| `admin` | Can manage users, templates, and audit history. Admin status does not automatically grant access to every project. Admins may also perform reviewer actions when they have project access. |
| System / operator | Operational persona, not an application role. Configures startup environment and JSON storage and performs the first-admin bootstrap. |

## Test cases

### ACL-008: Project-owner role does not replace project access

- **Priority:** P1
- **Actor:** `project_owner` user without project ownership or membership; standard `user` who owns a project
- **Level:** API
- **Preconditions:** Create one project whose owner is a standard user. Give another account the `project_owner` role but no relationship to that project.
- **Steps:** Request the project and its project-scoped resources as each account.
- **Expected result:** The account with only the `project_owner` role is denied without receiving project data. The account recorded as `ownerUserId` can access its project even without the `project_owner` role.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### ADM-001: Restrict administration endpoints to administrators

- **Priority:** P1
- **Actor:** `user`, `reviewer`, and `admin`
- **Level:** API + UI
- **Preconditions:** Sign in with each role.
- **Steps:** Attempt to list users, create a template, and export audit history from each account.
- **Expected result:** `user` and `reviewer` are denied administration operations; the `admin` can use them. Reviewer access to approvals does not grant administration access.
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
- **Preconditions:** Sign in as a reviewer and retain the token. Sign in separately as an administrator.
- **Steps:** Remove the reviewer's reviewer role using administration controls. Use the retained token to request an approval queue and then sign in again.
- **Expected result:** The retained token cannot use reviewer-only access after the role change. A new session reflects the current stored roles; no stale token grants the removed role.
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
- **Actor:** `user` and `reviewer`
- **Level:** API + UI
- **Preconditions:** Sign in with each non-admin role.
- **Steps:** Attempt to list the administrative template collection and to create, edit, or deactivate a template.
- **Expected result:** Administrative template operations are denied. No template is created or changed.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### TMP-003: Return only active templates for authenticated discovery

- **Priority:** P1
- **Actor:** Anonymous visitor and authenticated `user`
- **Level:** API + UI
- **Preconditions:** Create active and inactive templates in at least two categories.
- **Steps:** Request active templates with and without a category filter; repeat without authentication and with an invalid category.
- **Expected result:** An authenticated user receives only active templates, and a valid category filter returns only that category. Anonymous access and invalid categories are rejected.
- **Execution result:** Pass / Fail / Blocked / Not run; tester: __________; date: __________

### TMP-004: Validate template selection by status and category

- **Priority:** P1
- **Actor:** Project owner or project member
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
