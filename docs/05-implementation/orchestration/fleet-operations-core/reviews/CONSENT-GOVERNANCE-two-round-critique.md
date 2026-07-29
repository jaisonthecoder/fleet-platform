# Governed Consent Registry - Two-Round Critique

| Date | Decision |
|---|---|
| 2026-07-29 | `VERIFIED_LOCAL_ACTIVE_TARGET_ENVIRONMENT_ACTIVATION_REQUIRED` |

## Round 1 - Contract, Security and Data

- One organization/domain/version identity and one Active version are database-enforced.
- EN/AR wording, version, hash, effective time, organization and creator are immutable through trigger `0055`.
- Direct tampering is rejected with PostgreSQL `23514`.
- Maker-checker is enforced: the author cannot activate the same version.
- Activation/retirement are SystemAdmin-only and audited; authoring is DataSteward/SystemAdmin.
- Providers resolve only the Principal organization's effective Active version.
- Test mode uses explicit fixtures and never reads/mutates local registry configuration.
- Integration tests use a disposable organization and cannot retire real local versions.

## Round 2 - Behavior, UX and Operations

- Consent management provides visible EN/AR authoring, version/hash/history, activation warning and retirement.
- Active wording is server-authoritative for Booking and Dedicated Vehicle; retirement returns both domains to fail closed.
- Prior Active wording retires atomically when a replacement activates.
- Future-effective Drafts cannot activate early, preventing an availability gap.
- UTF-8 setup script corrected and safely removed four unreferenced encoding-error setup versions after usage audit returned zero references.
- Live Arabic admin page is RTL with no overflow at 320 or 1440.

Evidence:

- Migrations `0054`/`0055` forward and second-run no-op idempotency pass.
- Provider units 6/6; registry/Booking/Dedicated integration 26/26; broader backend final 68/68 units and 29/29 integration.
- Frontend focused 23/23; full 25 files/132 tests; typecheck/build pass.
- Live contexts: Booking `AVAILABLE` version `booking-operational-ack-v3`; Dedicated `available=true` version `dedicated-operational-ack-v3`.
- No unresolved automated Blocking/High finding.

Residual governance is human acceptance of target-environment wording and sign-off, not missing application functionality or integration.
