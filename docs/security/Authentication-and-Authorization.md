# Authentication and Authorization Assessment

**Status:** Incremental implementation complete for password reset and Google account/session foundations. End-to-end Google verification with real credentials and SMTP delivery require deployment configuration.

This document describes the current implementation and identifies the files and changes needed for role-tailored frontend behavior, secure password recovery, and Google sign-in/sign-up.

## 1. Current authentication

### Email/password registration and login

- [auth.routes.ts](../../backend/src/modules/auth/auth.routes.ts) exposes:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- [auth.service.ts](../../backend/src/modules/auth/auth.service.ts) performs normalized-email lookup, bcrypt password comparison, and JWT creation.
- Passwords are hashed with bcrypt at cost 12.
- Email/password credentials must be 12–128 characters.
- New accounts receive `business_analyst`.
- Deactivated accounts are rejected during login.

### JWT sessions

- [auth.service.ts](../../backend/src/modules/auth/auth.service.ts) signs short-lived JWT access tokens.
- [authentication.ts](../../backend/src/common/middleware/authentication.ts) validates the bearer token and loads the current account from storage.
- Each protected request rejects a token if the account is inactive or if the email or complete role set differs from the stored account.
- This reload strategy invalidates existing JWTs after account deactivation or role changes.
- The frontend stores the access token and user in memory through [AuthProvider.tsx](../../frontend/src/features/auth/AuthProvider.tsx), [auth-store.ts](../../frontend/src/lib/auth-store.ts), and [auth-api.ts](../../frontend/src/features/auth/auth-api.ts).
- A page refresh requires login again.

### Environment configuration

- [env.ts](../../backend/src/config/env.ts) currently validates JWT, JSON storage, LLM, and first-admin bootstrap settings.
- [backend/.env.example](../../backend/.env.example) does not contain password-reset or Google OAuth configuration.
- No email provider or OAuth dependency is currently present.

## 2. Current role model

The canonical role union is in [user.repository.ts](../../backend/src/modules/auth/user.repository.ts):

- `business_analyst`
- `product_owner`
- `delivery_lead`
- `admin`

The backend permission map is in [permissions.ts](../../backend/src/common/authorization/permissions.ts):

| Role | Permissions |
| --- | --- |
| `business_analyst` | `project.create`, `analysis.prepare`, `analysis.submit` |
| `product_owner` | `approval.decide_business` |
| `delivery_lead` | `delivery.review` |
| `admin` | `admin.users`, `admin.templates`, `admin.audit` |

The frontend mirrors this in [frontend permissions.ts](../../frontend/src/features/auth/permissions.ts).

Roles and permissions are both present:

- Permission checks determine role capabilities.
- Project ownership and membership remain a separate authorization relationship.
- Role and permission names are authoritative only after backend authentication and storage lookup.

## 3. Existing backend authorization

Protected routes use [authentication.ts](../../backend/src/common/middleware/authentication.ts), [authorization.ts](../../backend/src/common/middleware/authorization.ts), and [project-access.ts](../../backend/src/common/middleware/project-access.ts).

The route layer currently applies:

| Capability | Implementation |
| --- | --- |
| Project creation | `project.create` |
| Requirement/artifact/workflow preparation | `analysis.prepare` |
| Approval submission | `analysis.submit` |
| Product Owner approval decisions | `approval.decide_business` |
| Delivery Lead feedback | `delivery.review` |
| User, role, template, and audit administration | Admin role/administration middleware |

Relevant route files:

- [project.routes.ts](../../backend/src/modules/projects/project.routes.ts)
- [requirement.routes.ts](../../backend/src/modules/requirements/requirement.routes.ts)
- [artifact.routes.ts](../../backend/src/modules/artifacts/artifact.routes.ts)
- [workflow.routes.ts](../../backend/src/modules/workflows/workflow.routes.ts)
- [approval.routes.ts](../../backend/src/modules/approvals/approval.routes.ts)
- [user.routes.ts](../../backend/src/modules/users/user.routes.ts)
- [admin.routes.ts](../../backend/src/modules/users/admin.routes.ts)
- [template.routes.ts](../../backend/src/modules/users/template.routes.ts)

Backend approval rules include project access and self-review rejection. The backend remains the authoritative security boundary.

## 4. Existing frontend authorization

The frontend has a centralized permission utility and guards:

- [permissions.ts](../../frontend/src/features/auth/permissions.ts)
- [AuthGuards.tsx](../../frontend/src/app/AuthGuards.tsx)
- [router.tsx](../../frontend/src/app/router.tsx)

However, role-tailored rendering is incomplete:

- [AppShell.tsx](../../frontend/src/components/layout/AppShell.tsx) filters only approvals and administration. It still displays project documents, requirements, workflows, deliverables, and exports generically.
- [router.tsx](../../frontend/src/app/router.tsx) protects project creation, requirement creation, workflows, approvals, and administration. Documents, project overviews, requirements lists, artifacts, and exports are not permission-aware in routing.
- [ApprovalWorkspacePage.tsx](../../frontend/src/pages/ApprovalWorkspacePage.tsx) contains direct role-name checks with `includes("product_owner")` and `includes("admin")`.
- [AdminPage.tsx](../../frontend/src/pages/AdminPage.tsx) contains direct `roles.includes("admin")` behavior.
- [AuthGuards.tsx](../../frontend/src/app/AuthGuards.tsx) still exports `RequireRole` for role-name guards, although permission guards are also available.
- The project navigation is role-filtered but not project-membership-aware.
- Project-specific editing actions are not driven by a backend authorization response or centralized project permission model.
- Unauthorized routes often display a guarded access-denied screen instead of absent navigation and return-to-workspace UX.
- Protected navigation can be associated with project context before project-specific authorization is known.
- The dashboard does not yet have a complete centralized role/permission rendering model.

This is why unauthorized features can still appear or can reach access-denied states in the current frontend. Frontend role visibility is not yet fully derived from one permission/navigation configuration.

## 5. Password recovery assessment

Password recovery does not exist.

Needed implementation areas:

- Add request, validation, and reset endpoints to [auth.routes.ts](../../backend/src/modules/auth/auth.routes.ts).
- Add secure reset methods to [auth.service.ts](../../backend/src/modules/auth/auth.service.ts).
- Extend [UserRepository and Storage](../../backend/src/modules/auth/user.repository.ts) with reset-token lookup/consumption/password-update operations.
- Add reset token records to the JSON storage schema and startup validation in [storage.ts](../../backend/src/config/storage.ts).
- Store only a SHA-256 or stronger cryptographic digest of each reset token.
- Add an email provider adapter and configuration. No email provider exists.
- Add reset request and reset completion frontend pages and routes.
- Add a “Forgot password?” login action in [AuthPage.tsx](../../frontend/src/pages/AuthPage.tsx).
- Extend authentication API utilities and schemas.
- Invalidate existing JWTs after password reset. Because JWTs contain no server-side token version currently, use a password-reset/token-session invalidation mechanism or add a session/version claim checked by authentication middleware.
- Record reset-request, reset-success, and reset-failure events in audit history without secrets or tokens.

The current JSON state has password hashes but no provider identity or reset-token fields. Google-only account treatment will require an explicit authentication-provider identity model.

## 6. Google authentication assessment

Google authentication does not exist.

Required components:

- OAuth/OIDC configuration in [env.ts](../../backend/src/config/env.ts).
- Google client ID, client secret, callback URL, frontend redirect URL, and provider switch settings in [backend/.env.example](../../backend/.env.example).
- Authorization initiation and callback routes in [auth.routes.ts](../../backend/src/modules/auth/auth.routes.ts).
- State and nonce generation/validation, authorization-code exchange, ID-token verification, issuer/audience/signature/exp validation, and verified-email claim handling.
- Recommended dependencies: a Google OIDC client library or Google's official OAuth/OIDC package. Do not implement custom ID-token verification without a maintained library.
- Storage of provider identity and provider subject. Do not link accounts solely by matching email.
- Google-only accounts need a passwordless or provider-only marker.
- Existing password accounts must not be silently linked through matching email alone.
- Google and password users must use the same JWT session mechanism.
- Add login and registration buttons in [AuthPage.tsx](../../frontend/src/pages/AuthPage.tsx).
- Add a callback/loading/cancellation route and secure frontend redirect handling.

No Google OAuth dependency or provider configuration is present.

## 7. Required role-tailored frontend changes

1. Add a complete permission map for all user-facing capabilities, including documents, requirements, project editing, exports, and delivery review.
2. Replace direct role-name checks in [ApprovalWorkspacePage.tsx](../../frontend/src/pages/ApprovalWorkspacePage.tsx) and [AdminPage.tsx](../../frontend/src/pages/AdminPage.tsx) with `hasPermission` or reusable project-aware helpers.
3. Add centralized navigation configuration for workspace and project navigation.
4. Attach required permissions to navigation and route entries.
5. Filter unauthorized project links and actions rather than rendering access-denied states for normal navigation.
6. Add a backend authorization summary for project access and permitted capabilities, or derive project capabilities from existing project owner/member responses and guarded API calls.
7. Keep a secure loading state until authentication and effective permissions are validated.
8. Preserve route guards as a secondary UX control; backend enforcement remains mandatory.

## 8. Security decisions required before implementation

The following decisions should be confirmed before irreversible architectural choices:

1. New password accounts receive `business_analyst`; is this the confirmed default?
2. Google-only accounts receive `business_analyst` by default and use the same JWT strategy.
3. Existing matching-email accounts are not linked by email alone. A secure sign-in reauthentication strategy or explicit verified provider linking flow is required.
4. JWT invalidation after password reset uses server-side account/session versioning or another existing mechanism.
5. Email delivery is local-only in development, while production uses SMTP or a provider adapter.
6. Password-reset and OAuth callbacks are same-origin or use an explicitly allowlisted frontend URL.
7. Delivery Lead review feedback is visible only while the account is granted project access.

## 9. Required tests

Frontend:

- One test per canonical role for visible and hidden features.
- Direct navigation tests for unauthorized routes.
- Loading-state tests showing no protected features while authorization is unresolved.
- Project ownership/membership filtering tests.
- No direct role-name checks in role-tailored feature components.

Password reset:

- Generic unknown-email response.
- Invalid, expired, used, and valid token cases.
- Password hash update and old/new credential behavior.
- Token digest-only storage.
- Session invalidation/version behavior.
- Rate limiting.
- Google-only account rejection.

Google:

- Mocked authorization initiation and callback.
- Invalid state, nonce, audience, issuer, signature, expiration, and unverified-email rejection.
- New default-role assignment.
- Deactivated-account rejection.
- Secure existing-account linking behavior.
- Application JWT session output.

## 10. Implemented authentication features

- Password-reset request and confirmation routes.
- Cryptographically random reset tokens stored only as SHA-256 digests.
- Single-use, configurable-expiry reset lifecycle.
- Generic reset request response.
- SMTP adapter and local/no-email provider mode.
- Password reset session invalidation using `sessionVersion`.
- Google authorization initiation, callback, ID-token verification, state, nonce, issuer/audience/expiration verification, verified-email enforcement, and default `business_analyst` registration.
- Existing matching-email accounts are not silently linked.
- Google callback produces the application's normal JWT session.
- Role-tailored project navigation and permission-aware route guards.

## 11. Remaining deployment and verification work

- Configure real Google OAuth credentials and approved callback URLs.
- Configure an SMTP provider or replace no-email local mode.
- Run real OAuth/OIDC callback verification with a test Google project.
- Run full Playwright coverage for the new login/reset flows.
