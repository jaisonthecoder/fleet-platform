# Pilot portal-managed authentication - phased implementation plan

| Control | Value |
| --- | --- |
| Version / date | 1.0 / 15.09.2026 |
| Direction | User-approved portal API/PostgreSQL authentication for the pilot |
| Architecture | [ADR-006](../../adr/ADR-006-pilot-portal-managed-authentication.md) |
| Delivery status | Planned; no authentication implementation or verification claimed by this plan |
| Applies to | External customers and explicitly provisioned local bootstrap Portal Admin; retain staff SSO |
| Excludes | Entra External ID/Keycloak as pilot customer dependencies; public signup; custom cryptography; custom role designer; automatic local credentials for employees |

## 1. Outcome and boundaries

An operator provisions the first internal administrator. That administrator signs in without corporate SSO, enrolls MFA and onboards a customer. An authorized employee invites the first Customer Admin. The customer follows the email link, sets a password, enrolls MFA, signs in, and can invite colleagues according to existing portal permissions. All identities retain the same application-owned user, customer, role and branch boundaries.

Credentials and sessions are managed through maintained libraries integrated in the existing NestJS API, not a separate identity runtime. React owns screens, not authentication decisions. PostgreSQL persists credentials, sessions, invitation/recovery state and security audit. External email remains an asynchronous integration job. No browser-provided role, tenant, internal flag or token payload becomes authoritative.

Development uses the same local-account architecture with fictional fixtures and controlled email capture; never confuse X-Dev-User-Subject with working authentication. Pilot hosting requires HTTPS and actual email delivery. Local HTTP cookie exceptions, if needed, must be loopback-only and fail closed outside development.

## 2. Existing code to reuse and gaps to close

- Reuse `apps/noatum-customer-portal-api/prisma/schema.prisma`: User has issuer/subject identity bindings, customer/internal flags and roles; Invitation already has tokenHash, expiry and acceptedAt. Do not copy the earlier scaffold or assume these fields are missing.
- Inspect current identity/AuthGuard/token verifier, TenantContext/TenantRepository and pre-auth SQL functions before extending them. Preserve trusted staff SSO, deny unknown identities and retain fresh database permission evaluation.
- Reuse customers/users modules for invitations, lifecycle and role assignments, including customer activation conditions and last-admin protection. Inventory current invitation accept/revoke/resend routes; implement only missing behavior.
- Reuse integration email/jobs and transaction-bound enqueue, applying the current code's identity/idempotency API rather than assuming its older signature.
- Reuse UI auth pages, staff/admin layouts, generated API types/forms, i18next EN/ES and the Noatum design system. Existing customer pages must consume the same identity projection as staff/local-admin login.
- Expected missing capabilities: local credential storage and verifier, scoped pre-auth access, local sessions/CSRF, local activation/MFA, resets/recovery, bootstrap without SSO, and release operations. Confirm each locally before editing.

## 2.1 Library selection and removable module boundary - 15.09.2026

Selected implementation direction for PA-01: compose focused libraries inside one NestJS `local-auth` module, retaining the existing staff SSO verifier and MSAL flow. This is a code-fit recommendation, not a claim that the stack has passed runtime/security compatibility checks. No dependency is installed by this selection record.

| Responsibility | Selected library / registry version observed | License | Reason and remaining work |
| --- | --- | --- | --- |
| Server-side session lifecycle and cookies | express-session 1.19.0 | MIT | Fits the existing Nest Express adapter; maintained middleware owns session IDs, cookie signing, regenerate/destroy. Requires our narrow digest-backed PostgreSQL Store adapter; MemoryStore is prohibited |
| Password hashes | argon2 0.45.1 | MIT | Argon2id, PHC formatting/verification and rehash support. Native binary compatibility must be checked on Windows and the chosen Linux image before installation is accepted |
| Authenticator-app MFA | otplib 13.5.0 | MIT | TOTP primitives and replay-related APIs; use v13 documentation, not v12 authenticator examples. Enrollment, encrypted storage, recovery-code consumption and assurance gates remain portal responsibilities |
| Session-bound CSRF protection | csrf-sync 4.2.1 | ISC | Synchronizer token pattern with express-session; explicit request-header token plus server session state. Includes pre-login/activation/logout protection; SameSite alone is insufficient |
| Login/reset/MFA abuse counters | rate-limiter-flexible 11.2.0 | ISC | Existing PostgreSQL/Prisma store options, no Redis requirement. Review its adapter/grants under RLS, disable runtime table creation, migrate its table explicitly and fail closed if durable controls are unavailable |

Also add `@types/express-session` as a development dependency when the session integration is implemented. Reuse existing Prisma, Zod, OpenAPI, TanStack Query and email/jobs facilities. Do not add Passport solely to re-express the current SSO verifier; the local login service can call password verification directly. No frontend auth-vendor SDK is needed for local login: use generated portal HTTP contracts.

Registry metadata was read on 15.09.2026; none of these observed releases was marked deprecated. Published dates: express-session 22.01.2026, argon2 21.07.2026, otplib 21.08.2026, csrf-sync 10.05.2025 and rate-limiter-flexible 08.06.2026. This establishes published metadata, not absence of vulnerabilities or future maintenance. Pin reviewed exact versions on installation and record transitive dependencies in the lockfile. Argon2's registry engine range is broader than its current README support statement; confirm the actual package's supported runtime/native build rather than choosing the oldest allowed Node version. No package installation, build, dependency advisory scan or runtime compatibility check has run for this decision.

**Alternative evaluated:** Better Auth 1.7.5 offers Prisma 7 integration and built-in two-factor features. Its documented session table stores the session cookie token, and session revocation/list APIs use that token. Cookie caching can delay revocation. Meeting this pilot's digest-only/session-RLS contract would require nontrivial adapter/endpoint evaluation rather than a simple configuration claim. Do not adopt it by silently relaxing ADR-006. The selected smaller stack has more portal-owned lifecycle orchestration, but avoids replacing staff SSO or installing an additional auth server. It is not a turnkey identity product and does not make the full lifecycle automatic.

### Small ownership boundary

Planned paths, not directories created by this documentation change:

```text
API src/modules/local-auth/
	local-auth.module.ts
	local-auth.controller.ts
	local-auth.service.ts
	local-auth.repository.ts
	session-store.ts
	mfa.service.ts
	local-auth.spec.ts

UI src/features/local-auth/
	api/
	components/
	pages/
	i18n/
```

Auth DTOs remain under the existing API `contracts` directory, with one local-auth contract group; generated SPA code remains in its established generated folder. Library-specific types and cookie parsing stay inside local-auth, not customer/quote/booking modules. Authentication methods resolve a stable portal user ID and authentication assurance; existing identity resolution supplies fresh status, customer scope and permissions. Do not create a parallel user/role system or a generic provider/plugin registry.

The two necessary shared integration points are module registration/configuration and the global authentication boundary. Today AuthGuard always expects Entra claims. Add one optional local-session reader there; the existing bearer-token verifier and staff MSAL callbacks/configuration stay intact. Do not fabricate Entra claims from a local user ID, invoke staff auto-registration for local login, or make staff SSO depend on local-auth encryption keys.

Credential routing is explicit: local cookie requests use the local-session path; bearer-only requests use the existing verified SSO path. Conflicting local cookie and bearer credentials are rejected, not merged or silently switched. The staff frontend sends bearer requests without local cookies; the local frontend sends credentials with the CSRF header and no Microsoft token. Expired or invalid presented credentials fail instead of trying another identity. Development impersonation remains explicitly separate and is never an authentication fallback.

When `LOCAL_AUTH_ENABLED=false`, do not mount local login routes or initialize its libraries/store/key requirements. Return a disabled local-session adapter at the shared boundary; staff login and `/api/me` must still work through SSO. Do not require CSRF tokens from bearer-only staff requests, but do protect every state-changing business request authenticated by a local cookie, not only `/auth/local/*`. Scope middleware to relevant requests and keep `saveUninitialized:false`/`resave:false` with a correct store touch implementation; no session cookies should be emitted on normal SSO traffic.

### Persistence adapter acceptance

Implement only the published express-session Store API needed by the module (`get`, `set`, `destroy`, `touch` plus explicit revocation operations). Hash the library-generated session ID at the storage boundary for lookup/write/delete; never persist its raw form inside serialized session data. Store a narrow allow-listed payload, not a whole request/user object or cached role list. Separate absolute and idle expiry, pending-MFA state, authenticated user ID and security generation.

The important non-default behavior is revocation safety: `touch` or a late response `set` must not resurrect an expired/destroyed session after logout, reset or rotation. Use an atomic revoked/security-version/expiry predicate and retained revocation state as needed. Password/MFA completion regenerates the session; final grants and status are rechecked against current database state. Pre-auth CSRF/MFA sessions grant no business access. PA-02 must prove the SQL/store contract, including callback errors and unavailable database handling, before LA-01 is considered fully validated.

This adapter is application persistence glue, not a new cookie/signature/session-token protocol. Do not use a stock store that writes reusable IDs simply to reduce code size, and do not give it broad internal RLS context or owner credentials. Follow the narrow pre-authentication access design in PA-02.

### Clean disablement and removal

1. First enable and verify the replacement identity method for affected customers and the local administrator, using proof-based identity linking. Disabling the only working login method is not a migration plan.
2. Stop new local enrollment/login; revoke local sessions and outstanding local reset/MFA/bootstrap challenges. Clear only the local cookie and local frontend cache, not MSAL storage or staff sessions.
3. Disable module registration/routes and remove local UI entry points. Shared business modules, immutable users, customer links, roles, audit and staff SSO remain unchanged.
4. Remove the local provider integration, isolated source folders and dependencies in a later reviewed change. Remove the optional authentication-boundary hook if no replacement uses it. Preserve applied migration history.
5. Retire credential/session/factor tables and encryption material only through an approved forward migration and retention procedure after no users depend on them. Never drop the shared user table or erase audit just to uninstall a module.

Required deferred compatibility cases: SSO valid/invalid token parity with module enabled/disabled; no local cookie emitted for SSO; cookie+bearer rejection; local failure cannot break bearer-only routes; cookie CSRF enforced on business mutations; revoked-session late-write race; module disabled with local secrets absent; same-email users never auto-linked; replacement/removal preserves staff access and customer data. These checks are prepared/executed in the owning slices only under the user-scheduled verification policy.

Sources reviewed (live documentation may change; use pinned package APIs during implementation): [Express session](https://expressjs.com/en/resources/middleware/session.html), [node-argon2](https://github.com/ranisalt/node-argon2), [otplib](https://github.com/yeojz/otplib), [csrf-sync](https://github.com/Psifi-Solutions/csrf-sync), [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible), [Better Auth session storage](https://www.better-auth.com/docs/concepts/session-management), [Better Auth two-factor](https://www.better-auth.com/docs/plugins/2fa), [Better Auth Prisma](https://www.better-auth.com/docs/adapters/prisma). Registry versions/licenses were read from registry.npmjs.org metadata; no packages executed.

## 3. Decision gates before their dependent slice

These gates select implementation detail, not whether to adopt portal-managed pilot authentication; that direction is already confirmed.

| Gate | Decision and required evidence | Needed before | Accountable owner |
| --- | --- | --- | --- |
| LA-01 | Maintained auth/session/MFA library, NestJS/Node/Prisma/Postgres support, licensing, security maintenance, invite-only hooks, digest-only session persistence, RLS integration, no forced extra runtime | PA-01 | Engineering + Security |
| LA-02 | Password length/maximum/policy, breached-password approach, Argon2id memory/time/parallelism parameters and rehash strategy under expected load | PA-02 | Security + Engineering |
| LA-03 | Idle/absolute session lifetime, concurrent sessions, reauthentication interval, MFA-challenge lifetime, remember-device policy, cookie domain/SameSite and exact dev/pilot origins | PA-03 | Security + Engineering |
| LA-04 | MFA factor(s), enrollment/recovery proof, recovery-code count, encrypted factor-secret storage and key rotation/access | PA-04 | Security + Operations |
| LA-05 | Invitation/reset/bootstrap validity, resend bounds, dispatch retry lifetime and encrypted email-link delivery contract; preserve seven-day invitation baseline unless explicitly changed | PA-05 | Product + Security + Integration |
| LA-06 | Explicit first administrator identity, permitted grants, operator procedure, custody and replacement/recovery contacts; no shared default credentials | PA-06 | Product + Security + Operations |
| LA-07 | Cross-instance abuse controls, email/IP throttling, proxy trust, transient lockout/backoff, retention/legal hold, alerts and incident handling | PA-03/PA-07 | Security + Cloud + Operations |
| LA-08 | Pilot account migration, SSO/local coexistence, eligibility to hold both methods and who approves credential enablement | PA-02/PA-08 | Identity + Product + Engineering |

Do not adopt arbitrary timeout/hash/lockout numbers as approved policy. Proposed values must be recorded with rationale, configuration bounds and owner approval. Missing secrets or secure delivery is a gate, not permission to print credentials to chat or logs.

## 4. Planned data and trust model

Logical records below are not approved final physical tables. Review the selected library's schema and reuse current equivalents; avoid duplicate credential/session stores.

| Record | Minimum responsibility | Access and lifecycle |
| --- | --- | --- |
| Existing User | Stable portal ID, verified email state, internal/customer ownership, status, optional external bindings | No credential material in business DTOs; no automatic identity linking by email |
| Local credential | User reference, Argon2id hash with parameters, credential-change/security version metadata | One authorized local binding per user; hash never returned to UI or business queries |
| Session | Token digest, user reference, created/last-used/idle/absolute expiry, revocation and authentication assurance | Raw token only in protected cookie; hash storage must be supported by selected integration; session does not freeze permissions |
| Security challenge | Purpose-bound activation/reset/MFA/bootstrap digest, user/invitation reference, expiry, attempts/consumed status | Single-use, transactional consumption; separate purposes cannot substitute for one another |
| MFA enrollment | Factor state, encrypted TOTP secret if chosen, replay metadata; recovery-code hashes | Factor key is outside DB; pending enrollment grants no business access |
| Invitation | Reuse existing record and domain/customer/roles bindings | Hashed token, seven-day default, revoke/resend, no public role/customer selection |
| Auth abuse state | Bounded counters/windows by approved identity/network keys | Shared across API instances, privacy-aware; avoid memory-only production enforcement |
| Audit/analytics | Security event action/outcome, actors, correlation and safe metadata | Append-only where required; never passwords, hashes, raw tokens, MFA codes or full activation URLs |

Customer-owned rows follow indexed customer ownership/RLS. Internal credentials have explicit internal-only policy, not a fictitious customer ID. Pre-authentication cannot already rely on a logged-in tenant context: design narrow database functions/repository permissions exposing only the exact lookup/update needed by the auth integration. Credentials must not become readable by all internal staff or by customer administrators. Do not give the runtime superuser/BYPASSRLS or apply global internal context to solve login.

Migration design must include ownership consistency, indexes for digest lookup/expiry cleanup, foreign keys, unique constraints, least-privilege grants and RLS. Use additive forward migrations, explicit legacy binding/backfill rules and a tested recovery strategy. Existing users must never receive a known password or an automatic activation solely because their email matches a fixture.

## 5. Phase map

| Phase | Slice IDs | Business result | Dependency |
| --- | --- | --- | --- |
| PA-01 | A, B | Reviewed library/trust contract and aligned specifications | ADR-006; LA-01 |
| PA-02 | A, B | Credentials/challenges/sessions can be persisted with scoped access | PA-01; relevant policy gates |
| PA-03 | A, B, C | Local sign-in/out and protected browser session | PA-02; LA-02/03/07 |
| PA-04 | A, B | MFA-enforced local account access and controlled recovery | PA-03; LA-04 |
| PA-05 | A, B, C | Customer invitation becomes a usable activated account | PA-02-04; LA-05; email access |
| PA-06 | A, B | Usable first local Portal Admin and portal role-assignment walkthrough | PA-03-05 security/delivery primitives; LA-06 |
| PA-07 | A, B, C | Password/email/MFA lifecycle and immediate access removal | PA-03-06 |
| PA-08 | A, B | Staff SSO coexistence, existing-account migration and configuration | PA-07; LA-08 |
| PA-09 | A, B | Accepted pilot release and support/recovery readiness | PA-01-08; authorized verification window |

These are authentication work packages inside the existing Phase 1 delivery, not replacements for business stages. Implement coherent DB -> contracts/API -> generated client -> UI slices; do not build every database feature first and leave the UI unusable. Security-dependent screens may be previewed before their prerequisites, but must not expose real business sessions early.

### 5.1 Build status - 15.09.2026

Implemented; verification pending. No tests, lint, typecheck or e2e have been run, so
nothing below is release-accepted. The API compiles and boots, and all `auth/local`
routes are mapped.

| Phase | State | Where it lives |
| --- | --- | --- |
| PA-01 | Done | ADR-006; section 2.1 above |
| PA-02 | Done | Migration `20260922000000_local_auth_foundation`; `src/modules/local-auth/{local-auth.repository,password.service,session-store}.ts` |
| PA-03 | Done | `local-auth.{service,controller,module}.ts`; `local-session.resolver.ts`; one optional branch in `common/guards/auth.guard.ts`; SPA `features/local-auth` |
| PA-04 | Done | `mfa.service.ts`; MFA functions in `20260923000000_local_auth_flows`; SPA `MfaPanel` |
| PA-05 | Done | `app.local_password_set_from_challenge`; challenge issued by `customers.service.inviteAdministrator`; SPA `/invitation/:token` |
| PA-06 | Done | `app.local_bootstrap_admin`; `scripts/provision-portal-admin.cjs`; SPA `/portal-admin-setup/:token` |
| PA-07 | Partial | Password change, reset request/completion and sign-out-everywhere are built. Email-address change and administrative MFA reset exist in SQL (`app.local_mfa_reset`) but have no screen yet |
| PA-08 | Partial | `LOCAL_AUTH_ENABLED` / `VITE_LOCAL_AUTH_ENABLED` switch the module off cleanly. Migration of an existing Entra-linked customer to a password is not built |
| PA-09 | Not started | Requires an authorised verification window |

**Operator runbook for the first administrator**

```
cd apps/noatum-customer-portal-api
pnpm run portal-admin:provision -- --email someone@noatum.com --name "Some One"
```

It prints a single-use link valid for 24 hours, which is the only time it can be seen.
The command sets no password, grants `platform_admin`, is safe to repeat, and refuses
once that account has a working password.

**Known gaps carried forward**

- Rate limiting is in-process (`RateLimiterMemory`). Correct for one instance, wrong for
  two; swapping in `RateLimiterPostgres` is a constructor change.
- Argon2 cost parameters are the library defaults (LA-02 still open).
- Behind a proxy, production needs `trust proxy` set or the secure cookie will not be issued.
- Sessions are only created at sign-in, so there is no pre-login CSRF token. Unauthenticated
  posts rely on `SameSite=Lax` plus the rate limiter; authenticated ones carry `x-csrf-token`.

## 6. Detailed phased work

### PA-01 - Contract and integration selection

**PA-01-A:** Evaluate a small shortlist of actively maintained libraries. Check installed runtime compatibility, password/MFA/session capability, vulnerability maintenance and licenses, invite-only control, opaque session rotation/revocation, database transaction hooks and RLS. Document unsupported requirements and reject candidates requiring plaintext persisted bearer tokens, open signup or a second unapproved runtime. Do not name an unevaluated dependency as selected.

**PA-01-B:** Map current auth/identity paths and reconcile working FR/NFR, Simplification Register, identity design, onboarding LLD and P1.02/P1.06/P1.12 plans against ADR-006. Produce one auth principal contract shared conceptually across local session and SSO adapters; keep types API-local and generate the SPA client. Role lookup remains independent of method.

Deliverable: named library/version and integration contract, policy decision register, exact file/migration plan and prepared test list. Demonstration: sequence review for customer activation/local login/staff SSO; no runtime success claimed. No schema or deployment until dependencies are selected.

### PA-02 - Persistence and restricted pre-authentication

**PA-02-A:** Add only needed library-compatible credential/session/challenge/MFA records and ownership constraints. Reuse Invitation/User and audit facilities. Preserve current customer data and all external identity bindings. Make local authentication enrollment opt-in by the server's provisioning/invitation state.

**PA-02-B:** Implement narrow auth repository/SQL entry points for email lookup, credential verification inputs, challenge consumption and session resolution. An unauthenticated browser must never obtain these records through a generic query endpoint. Establish transaction locking/version checks across password change, invitation consumption, suspension and recovery. Add safe cleanup scheduling for expired security records without deleting retained audit or live invitations.

Files: API Prisma schema/new forward migrations/down documentation; common auth and owning repository modules; API-local contracts. Prepare raw runtime DB tests for A/B/internal/no-context, wrong-user challenge use, denied hash/table reads and upgrade/backfill. Exit: reviewed schema and repository invariants; execution evidence pending until requested.

### PA-03 - Login, sessions and logout

**PA-03-A:** Add credential login with generic invalid-account/password/status failure behavior and maintained Argon2id verification; perform dummy verification where necessary to avoid obvious user-existence timing differences. Bound input size and expensive operations; distributed abuse controls must cover known and unknown accounts. Success before required MFA yields only a restricted challenge, never a usable business session.

**PA-03-B:** Establish opaque digest-backed sessions after full authentication. Use Secure/HttpOnly host-scoped cookies with the approved SameSite policy, rotation after login/MFA/privilege elevation, idle/absolute expiry and CSRF/origin protection including login/logout. Do not put tokens in localStorage, URLs or analytics. Resolve current status/customer/permissions on each request; a credential session does not replace tenancy controls. Reject ambiguous conflicting cookie/bearer identities rather than merge them.

**PA-03-C:** Implement logout, logout-all and expiry handling; cancel protected requests and clear TanStack Query cache on identity loss/change. Sign-in UI has email/password, accessible errors, password visibility control, pending/repeat-click protection and EN/ES. Staff SSO remains a separate entry point, not a fallback triggered by guessed email domains.

Demo: local user signs in, reaches only granted content, logs out and cannot replay the cookie. Prepare expiry, CSRF, fixation, denied role and cross-tab/cache tests. Files: common auth/guards/controllers, generated contracts, UI auth/api/pages/layouts. No new public business endpoint exemptions.

### PA-04 - MFA and authentication assurance

**PA-04-A:** Implement approved factor enrollment and confirmation through library APIs. For proposed TOTP: bounded enrollment challenge, encrypted secret, no secret in logs or unrestricted profile DTOs, narrow clock tolerance and replay protection. Show the enrollment secret only in the authenticated pending-enrollment flow. Bootstrap admins cannot perform role assignments until MFA enrollment/challenge succeeds.

**PA-04-B:** Create single-use recovery codes, store hashes and show plaintext once for secure user storage. Factor replacement/disablement needs recent reauthentication plus the approved recovery proof. Forgotten password alone does not remove MFA. Customer admins may initiate an audited recovery workflow if permitted, not view passwords/secrets or silently disable another person's factor.

Demo: password alone cannot access protected data; valid factor completes the flow; reused code fails. Prepare code replay, concurrent recovery-code use, expired enrollment, factor reset/session invalidation and key-unavailable tests. Policy must specify safe support recovery without locking out every administrator or exposing a public emergency bypass.

### PA-05 - Invitation activation and email delivery

**PA-05-A:** Reuse invitation issue/list/revoke/resend behavior. Require approved customer state/domain and inviter permissions; internal bootstrap is not this endpoint. Resend invalidates old credentials according to an atomic version rule. Do not create credentials for arbitrary user/role/customer IDs posted by the browser.

**PA-05-B:** Deliver links through existing asynchronous email jobs. SHA-256 invitation/token hashes are retained for verification. A durable job must not contain a plaintext raw token/full activation URL. Agree an encrypted short-lived dispatch envelope (key outside DB) or equivalent reviewed reliable-delivery scheme; prevent logging/dead-letter output from revealing it; discard dispatch material after its permitted retry lifetime. Retry must not silently generate mismatched or multiple live links. Verify email failures remain observable and safely resendable.

**PA-05-C:** Build activation page: validate link with a minimal response, sanitize the URL/referrer, avoid third-party scripts on token-bearing screens, set password, enroll MFA, then atomically consume invitation and activate the correct identity. A GET from an email scanner must never consume the invitation. Recheck inviter/role/customer conditions at final acceptance; suspended/closed customers cannot activate access. Do not persist a partly enrolled active customer. Existing local users accepting an invitation must authenticate/re-authenticate; reject unsupported cross-customer account linking instead of merging by email.

Demo: invited customer can activate and log in; expired/revoked/used link fails; existing customer activation checklist recognizes the accepted admin but does not waive other conditions. Prepare simultaneous acceptance/resend/revoke, wrong-email/account, rollback and email-outage cases. UI uses existing customer invitation history and actual delivery state, not hard-coded success.

### PA-06 - First local administrator and business handover

**PA-06-A:** Add a controlled operator command for an explicit named internal identity and approved preset. No first-login-wins, open admin signup or committed credentials. Use a short-lived purpose-bound bootstrap setup link via approved secure delivery. Re-running setup must not regrant removed roles or overwrite an existing binding; serialize concurrent bootstrap attempts and audit the operator action. Clarify recovery when setup delivery fails or the first administrator is disabled.

**PA-06-B:** Reuse local login/MFA/session primitives with internal context and the existing staff role-management UI. Bootstrap customer membership stays null; session resolution must not grant unrestricted internal RLS/data access merely because an identity is internal. Demo: first admin logs in without corporate SSO, assigns a role to a registered staff user, then that user receives only the approved access next request. Customer login cannot reach staff administration even with a forged payload.

No plaintext demo password is displayed in documentation/chat. The operator supplies any sensitive setup value directly through a secure terminal/channel. Do not repurpose or activate current disabled demo records by matching their email alone. Restore normal last-admin/self-removal safeguards after the initial provisioning operation.

### PA-07 - Recovery, credential changes and lifecycle

**PA-07-A:** Implement forgotten password request/reset with uniform public responses and purpose-bound single-use digests; email possession alone cannot bypass required MFA. On completion, atomically change the password, consume token, invalidate other reset attempts and revoke affected sessions. Send an account-security notification without a password or session token. Reset token is not a login session.

**PA-07-B:** Add authenticated password/email/factor changes and session management. Require recent verification for sensitive changes, verify new email ownership and collision/domain constraints, notify previous/new addresses as approved, preserve immutable user ID and never auto-merge identities. Resolve behavior of existing sessions and invitations on each change in the policy contract.

**PA-07-C:** Wire user suspension, customer suspension, credential disablement, role removal and logout-all to immediate access denial. Include active sessions and queued sensitive notifications; restore no invalid prior grants automatically. Implement safe cleanup, bounded authentication counters and alerts with redacted metadata.

Demo: existing cookie loses access after suspension; password reset cannot recover a closed customer into access; removed role is unavailable next request. Prepare concurrent reset, session renewal versus revoke, lockout abuse, valid/invalid recovery and last-admin lifecycle cases.

### PA-08 - Coexistence and pilot configuration

**PA-08-A:** Integrate local sessions and existing Microsoft bearer-token authentication into one trusted principal pipeline. Preserve issuer/subject uniqueness for SSO and immutable user IDs for local accounts. Do not return invented Entra claims for local users or merge same-email users. No new local employee account without controlled enrollment; an existing SSO-only account cannot gain local password access through forgotten-password flow.

**PA-08-B:** Align dev/pilot cookie domain, HTTPS, CORS credentials, CSRF origin allow-list, proxy trust, email provider/sender, database roles, keys and auth-mode configuration. Avoid cross-site cookies when same-origin routing meets the design; choose before deployment. Disabling local auth must fail clearly, not enable dev headers. Migrate only designated pilot users; never copy developer hashes or sessions to pilot. Retain future External ID configuration boundary without requiring it for pilot customer login.

Demo: local customer and SSO staff remain isolated; local admin role assignment works without Entra groups; a deployed build rejects development identity headers. Prepare configuration-denial and separate-origin/browser integration cases. Key Vault remains an option for secure key storage even though Entra is not the customer sign-in provider.

### PA-09 - Pilot assurance and controlled release

**PA-09-A:** In the user-scheduled verification window, execute the authentication matrix, business onboarding paths, migration upgrade/restore, realistic login/Argon2 load, multi-instance session/rate-limit/revoke behavior, cookie/CSRF checks, dependency/security review and independent penetration assessment as approved. Review source and prepare tests beforehand, but do not run them merely because a slice finished.

**PA-09-B:** Provide operational runbooks for first-admin recovery, lost MFA, compromise, email outage, key rotation/loss, database restore, token cleanup and incident response. Restore must not resurrect revoked sessions/reset links: invalidate affected authentication state before reopening traffic. Release by explicit approval with canary/pilot customers, rollback triggers and named support ownership. Never revert to dev bypass under incident pressure.

Exit: approved evidence, real invitation delivery and activation, usable local admin, fresh/revoked customer sessions, role isolation and recovery rehearsal. Document all unresolved gaps; no assertion of production readiness from documentation, simulated email or unrun tests.

## 7. Candidate API and screen contract

Paths are proposed semantic responsibilities, not already implemented endpoints. Confirm actual library routing before committing OpenAPI; prefix with the current API convention rather than mixing /api and /v1.

| Responsibility | Candidate contract | Required protection |
| --- | --- | --- |
| Start local login | POST /api/auth/local/login | CSRF/origin + abuse controls; no role/tenant inputs |
| Complete MFA | POST /api/auth/local/mfa/verify | Restricted expiring challenge; bounded attempts |
| Read current principal | Existing /api/me | Fully authenticated session or approved bearer token |
| Logout / logout-all | POST /api/auth/logout; POST /api/auth/logout-all | Session + CSRF; revoke corresponding server state |
| Activation | Existing invite lookup/accept or /api/auth/invitations/* | Purpose-bound token and final transactional rechecks |
| Reset | POST /api/auth/password/reset-request; POST /api/auth/password/reset | Uniform public reply, abuse control, single-use purpose token |
| Security settings | /api/auth/security/* | Authenticated user + recent verification/MFA as required |
| First admin setup | Operator provisioning + restricted setup completion | No public admin creation; explicit target/preset and audit |

Public authentication exceptions must be individually declared and reviewed; feature endpoints still require permissions. Security endpoint responses use no-store. OpenAPI never contains real tokens, hashes, factor secrets or example passwords. Client validation derives from generated API schemas; the server remains authoritative.

Screens: customer login, invitation activation, MFA enrollment/challenge, recovery-code acknowledgment, forgotten/reset password, account security/session management, local admin login/setup, existing access-pending/denied states. Use EN/ES and existing design-system forms, loading/error/expired-link states and keyboard/focus behavior. Never label a seeded disabled identity as ready to sign in.

## 8. Traceability and required test matrix

| Test family | References | Required cases |
| --- | --- | --- |
| PA-T01 Credentials | FR-IAM-001, PA-02/03 | Correct/wrong password, hash-only storage, rehash, bounded input, disabled/unknown uniform errors |
| PA-T02 Sessions | FR-IAM-008/010, PA-03 | Digest lookup, expiry, cookie flags, fixation/rotation, logout/all, cross-instance revoke, no stale cache |
| PA-T03 CSRF/abuse | PA-03/07 | Login/logout/account-change CSRF, wrong origin, credentialed CORS, proxy spoofing, distributed throttling |
| PA-T04 MFA | PA-04 | No pre-MFA business session, enrollment expiry, wrong/replayed code, recovery-code race, factor/key recovery |
| PA-T05 Invitations | FR-IAM-005/006/007, PA-05 | Single use, email/domain binding, expiry/resend/revoke race, scanner GET, no injected role/customer |
| PA-T06 Lifecycle | FR-IAM-010/011, FR-ORG-006, PA-07 | Customer/user suspension, reset/revoke race, role removal, last-admin protection, no auto-restored grants |
| PA-T07 Bootstrap | FR-IAM-004/009, PA-06 | Named operator setup, concurrent/repeated runs, no public signup/default password, MFA before admin access |
| PA-T08 Isolation | FR-ORG-004, PA-02/08 | Raw runtime RLS, credential secrecy, A/B/internal contexts, narrow pre-auth function scope, mixed-auth collision |
| PA-T09 Delivery | FR-ORG-009, PA-05/07 | Email failure/retry/resend, no raw secret in durable job/log/audit/dead-letter, redaction and key rotation |
| PA-T10 Release | PA-08/09, existing P1.12 | API/UI browser flow, SSO coexistence, configuration denial, restore/recovery, accessibility/locale, approved load |

## 9. Documentation and existing-plan reconciliation

- ADR-006 is the pilot exception to ADR-004 identity delegation. Working FR-IAM-001/004/008/010 and the customer onboarding guide must reflect local credential/session identity without weakening invitation or portal authorization rules.
- Before PA-01 closes, annotate the older identity design, onboarding LLD, Simplification Register auth removals, NFR authentication assumptions, Azure prerequisites and existing P1.02/P1.06/P1.12 references. Preserve archived inputs/minutes; don't rewrite all history or change unrelated business scope.
- Entra External ID setup and customer federation are not pilot dependencies under this approach. Staff SSO stays available. SMTP/transactional-email service, HTTPS, database hosting, secret/key custody and monitoring are still dependencies.
- The pilot is not exempt from security controls because identity moved in-house. Formal Security/Operations acceptance remains outstanding even though the user has approved implementation direction.

## 10. Working cadence, delegation and handoff

Each slice starts from current code and supplies exact paths/schema changes and a prepared test list. Keep work in that slice. Main agent owns identity/session contracts and migrations; a UI delegate can work after contract generation; an independent reviewer checks requirements and trust boundaries. Do not concurrently edit shared auth, router or schema files.

Tests, lint, typechecks, formatters and verification-only builds are run only on explicit user instruction, not automatically at slice end or through delegates. Necessary implementation/startup/code-generation operations are separate and must be described accurately. Report `implemented; verification pending` where appropriate, with known blockers and next business outcome.

First implementation task: **PA-01-A/PA-01-B**, select the maintained integration and record exact auth/schema boundaries. First demonstrable business milestone after foundational slices: **local bootstrap admin login and invitation-to-customer activation**, with no provider redirect for local users. No development bypass or disabled fixture may substitute for that milestone.

No application files, dependency versions, migrations, accounts, credentials, Azure resources or existing database data are changed by this plan. No implementation or release timeline is asserted before LA-01 and the policy/operational owners' inputs are resolved.
