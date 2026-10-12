# P1.02 - Identity, tenancy and permissions

Status: planned, approval required. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md).

## Outcome and dependencies

Trusted identities resolve to portal-controlled access, with tenant isolation in repositories and Postgres. Eligible staff may register without business access; customers cannot self-register into a tenant.

Depends on P1.01. Gates: D-01 staff eligibility/bootstrap and trusted issuer claims; D-04 initial permission/preset catalogue. Reconcile older invitation-only staff wording before coding. Customer invitation acceptance is completed in P1.06, not replaced by email/domain matching here.

Trace: FR-IAM-001, FR-IAM-002, FR-IAM-004, FR-IAM-008, FR-IAM-009, FR-IAM-010; FR-ORG-001/004/009 foundation; FR-NAV-002/005; NFR-SEC-001 through NFR-SEC-009, NFR-REL-005, NFR-DAT-003.

## Vertical slices

### P1.02-A - Microsoft sign-in and access-pending staff

- DB: issuer/subject identity uniqueness, internal/customer distinction, status, optional customer ownership and internal branch representation; audit registration/bootstrap without logging tokens.
- Contracts/API: trusted issuer/audience/signature/lifetime validation; idempotent eligible-staff registration; minimum own-identity response for unassigned staff with an explicit access policy. No role grant from Azure groups or CW1 roles.
- UI: MSAL PKCE sign-in entry, signed-in identity, access-pending screen and Microsoft-managed sign-out. No password, reset, MFA, refresh-token or tenant login-slug implementation.
- Bootstrap: approved named identity/provisioning procedure, auditable and repeat-safe; never first-login-wins or an unauthenticated bootstrap endpoint.
- Tests: wrong issuer/audience/signature/expiry; simultaneous eligible first logins create one unprivileged record; ineligible identity denied; repeated bootstrap cannot widen access; same email/different subject cannot hijack identity.
- Demo: staff signs in and sees access pending, not business navigation. External identity without accepted invitation remains denied.

### P1.02-B - Tenant context and two-level access

- DB: CustomerGroup/CustomerAccount foundations, tenant-owned records with indexed group ownership, internal-only policies, future shared-visibility boundary. Do not copy a group ID onto shipment-family models.
- Service/repository: request-lifetime context and transaction-local DB settings; no tenant filtering in React; system worker context cannot be selected by an API caller.
- Rules: parent visibility is downward only within the approved two-level hierarchy; block cycles/third levels. Data visibility does not imply authority to administer child users.
- API: foreign entities use non-disclosing not-found behaviour; client ownership fields cannot widen context. Persisted source organisations remain separate from customer access links.
- Tests: A/B/parent/child/sibling/internal fixtures, missing context, raw runtime SQL, pooled-connection reuse, background tenant resolution, malicious group IDs and internal-context escalation.
- Demo: same query under two users returns only permitted rows; raw runtime SQL cannot bypass it.

### P1.02-C - Permission catalogue, grants and next-request revocation

- DB: reuse roles, permissions and assignments; global approved presets and allowed customer assignment relations; no role-designer UI.
- Catalogue: current administration/quotes/tooling plus future Tracking, Documents, Invoices, Bookings and Claims view/action definitions, report-assignment foundations, cost/restricted content, cross-branch pricing, impersonation and scoped settings grants.
- API: RequirePermission and feature checks on all protected routes; union of assigned permissions; no runtime role-name comparisons. Review explicitly declared own-identity/infrastructure exceptions.
- Rules: assignment does not grant an unreleased feature; Customer Admin is not automatic finance/pricing access; Platform Admin is not unrestricted customer/cost access.
- UI: server-derived effective access is available for the shell. Full assignment screens follow P1.05/P1.06.
- Tests: route-policy coverage, one 403 case per endpoint, role unions, rejected internal preset assignment to customers, revocation/deactivation with the same token, feature denial and missing-branch pricing denial.
- Demo: approved assignment changes effective access on the next request; removal immediately blocks it.

## Files and implementation order

Inspect and reuse `apps/noatum-customer-portal-api/prisma`, API common auth/guards/repositories, contracts/permission constants, user/role modules, portal auth and generated client. Exact files and migration repairs are listed for approval per slice. Schema/RLS -> contracts -> API/tests -> OpenAPI/client -> minimal auth UI.

Use scoped fixtures rather than granting broad internal access just to make a demo pass. Never implement a public role-assignment or self-selected tenant/branch path.

## Acceptance and handoff

### Implementation checkpoint - 11.09.2026

- Partial API/UI connection: login callbacks check `/api/me` using the generated OpenAPI types and MSAL access token. The UI distinguishes checking, pending (no permissions), confirmed, denied, unavailable and sign-in-required states. Retry, Microsoft sign-out and return to sign-in choices are present in EN/ES. Confirmed access does not expose unfinished workspaces.
- Evidence: 11 focused access-flow tests pass with simulated token/API responses, including failed refresh clearing confirmed state, denied responses, missing configuration, malformed permissions, logout failure and locale parity. This is not evidence of live Microsoft sign-in or completed staff registration.
- Production blockers: IdentityService still resolves by object ID with an invited-email fallback and queries identity tables before tenant context. Replace this with the approved issuer/subject binding and narrowly scoped pre-authentication lookup; do not bypass RLS globally. Eligible-staff registration, concurrency-safe bootstrap, invitation proof, branch representation and audit remain incomplete.
- Entry decisions still required for registration: D-01 trusted claims/eligible staff and named administrator bootstrap; D-04 approved permission presets. P1.02-A remains partial. Do not advance to business administration on the strength of the access panel alone.
- Working cadence: implement coherent API/UI slices, use focused behaviour checks for meaningful risks, and batch full typecheck/build at the end of the implementation slice. Broad lint/regression cleanup is not repeated after each edit.

Record identity claim contract, approved presets, runtime-DB isolation evidence and next-request denial results. RLS and permission tests run on subsequent schema/route changes, not only once here. Keep all unapproved grants blocked.

Full user administration is not complete at this stage: staff lifecycle is P1.05 and customer invitations/users/impersonation are P1.06. Next: [P1.03](03-Application-Shell-and-Access-Navigation.md).
