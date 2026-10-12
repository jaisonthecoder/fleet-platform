# ADR-006 - Portal-managed authentication for the pilot

| Control | Value |
| --- | --- |
| Date | 15.09.2026 |
| Status | Pilot direction accepted by user; implementation design and release assurance pending |
| Decision source | User requests portal API/database authentication without Entra External ID or Keycloak for pilot launch |
| Supersedes | ADR-004 decision 4 for pilot external customers and the explicitly provisioned local bootstrap administrator only |
| Implementation plan | [Pilot authentication phased plan](../plans/implementation-plans/Pilot-Portal-Authentication-Implementation-Plan.md) |

## Decision

The pilot will support invitation-only external-customer authentication managed by the portal API and PostgreSQL. The same maintained authentication integration will support the explicitly provisioned first internal Portal Admin without corporate SSO. This is a real pilot authentication path, not a development bypass. Staff Microsoft SSO remains supported independently; no employee receives local credentials automatically.

The browser uses portal activation/login/account-security pages. The API handles password verification, MFA, opaque server-side sessions, recovery and revocation through maintained libraries. Authorization remains exclusively in portal user/role/customer/branch records and Postgres RLS. No public self-signup, Entra group role mapping, custom role designer, hard-coded password or first-login-wins administrator is introduced.

Use Argon2id password hashes and random opaque session tokens. Store session/token digests, not reusable bearer tokens. Use HttpOnly/Secure cookies and CSRF protection. Prefer a maintained NestJS-compatible authentication/session integration; exact library, adapter and licensing are an LA-01 selection gate, not a claimed installed dependency. Do not hand-roll cryptography or invent a JWT/refresh-token protocol. No external identity server or Redis is required by this decision; library selection must demonstrate PostgreSQL compatibility without forcing a second broker/runtime.

## Scope and precedence

### Library and separation checkpoint - 15.09.2026

The selected implementation direction is a focused stack: express-session for cookie/session lifecycle, argon2 for Argon2id password verification, otplib for TOTP, csrf-sync for session-bound CSRF protection, and rate-limiter-flexible with PostgreSQL for abuse controls. The [implementation plan](../plans/implementation-plans/Pilot-Portal-Authentication-Implementation-Plan.md#21-library-selection-and-removable-module-boundary---15092026) records observed versions/licenses, alternatives, and remaining adapter/runtime acceptance. These libraries are not yet installed or verified in this application.

Keep local authentication in one API module and one UI feature folder. Preserve the existing staff bearer verifier and MSAL flow, sharing only trusted principal resolution and existing portal authorization. A small express-session Store adapter must enforce digest-only persistence and existing RLS constraints; this is not out-of-the-box behavior. Better Auth was considered but its documented token persistence/revocation contract does not meet that requirement without further adaptation.

Disabling the module must not require local secrets or disrupt staff SSO. Cookie-authenticated business mutations retain CSRF protection; bearer and cookie identities must not be merged. Clean removal preserves users/customer links/roles/audit and first migrates local-only users to a verified replacement. No provider framework, database reset, separate runtime or changes to staff sign-in configuration are authorized by this selection checkpoint.

This scoped pilot exception replaces the blanket no-portal-owned-credentials assumption in earlier working identity documents, PRD-derived FR-IAM-001/008 and ADR-004 item 4. It does not erase historical PRD/intake/meeting evidence or change unrelated simplifications. The working FR baseline and onboarding guide point to this decision; older examples must not be copied as the executable pilot design.

The first local administrator is an internal portal identity, not a customer identity. It receives only approved administration permissions, not unrestricted financial/customer content or database privileges. Its bootstrap must be explicit, audited and repeat-safe; ordinary local customer invitations cannot create staff or administrators. Authentication-mode selection cannot be supplied as a trusted privilege claim by the browser.

External ID can be added after the pilot as a separately configured authentication method. Preserve existing issuer/subject bindings. Do not merge accounts by email or synthesize Microsoft claims for local accounts. A local credential/session references the existing immutable portal user ID. Linking a future external identity requires proof of both identities or an approved audited recovery procedure.

## Responsibilities accepted

The portal team now owns secure enrollment, password hashing/policy, credential compromise response, MFA/recovery, token/session lifetime, revocation, rate controls, email verification/change, audit redaction, dependency updates and incident support. Using an authentication library does not remove these application obligations.

Transactional email is still required for activation, reset and notifications. Email service choice may be Azure Communication Services or another approved provider behind the existing integration boundary. Keep email delivery asynchronous and reliable; preserve the hashed-invitation-token rule without writing raw links into plaintext durable job payloads. The phased plan requires an encrypted short-lived delivery representation or another reviewed replay-safe delivery contract.

MFA is a pilot security requirement for local accounts, with the bootstrap administrator enrolled before obtaining administrative access. The exact factors, support process and numerical security parameters need Security/Operations approval. Proposed TOTP through a maintained library requires encrypted factor secrets, independent encryption-key storage and single-use hashed recovery codes. Email ownership verification is not described as a second authentication factor by itself.

## Release conditions

No public pilot rollout until the phases' implemented behavior is verified in a user-authorized window and accepted by the responsible business/security/operations owners. The documentation approval is not production certification, a test waiver, cloud provisioning authority or permission to silently implement all slices in one change.

Rollback is not removal of credential tables while customer accounts depend on them. Disable local enrollment/sign-in safely, revoke sessions when necessary, retain customer/audit history, and use a compatible application rollback or forward fix. Do not silently fall back to unconfigured SSO or development authentication.

No application code, credentials, migrations, dependency installation or cloud changes are delivered by this ADR.
