# CORE-0 Reconciliation - Fleet Operations Baseline

## Decision

CORE-0 source reconciliation identifies two implementation sequences that may proceed without UI mockups, plus one Vehicle read slice blocked on policy:

1. `FIX-FIXTURES-01A` then `FIX-FIXTURES-01B` - provision hierarchy fixtures independently of `seed-dev.sql`, make teardown safe and migrate all eleven affected integration suites;
2. `BOOK-AUTH-01` - restore Booking compilation and enforce the self-service authorization floor;
3. `BOOK-AUTH-HTTP-01` - after 01A, own Booking HTTP/database negative evidence without colliding with the fixture repair;
4. `VEH-READ-AUTH-01` - remains `BLOCKED` until D-VEH-READ approves a separate read/masking policy.

The authorized slices do not share implementation files. Shared contracts and orchestration records remain orchestrator-owned.

## Reconciled Evidence

| Area | Verified current state | Disposition |
|---|---|---|
| Integration fixture baseline | Nine suites reference parent `a0000000-0000-4000-8000-000000000003`, created only by `scripts/seed-dev.sql`; CI migrates then tests without seeding. Failed setup leaves empty UUID variables and causes teardown errors. | Repair fixtures; do not weaken hierarchy constraints. |
| Booking compile | `BookingService.create()` calls absent `assertCreateAuthority`; constructor gained `ScopeAuthorizationService` while unit setup still passes seven dependencies. | Repair in BOOK-AUTH-01. |
| Booking HTTP authority | Availability drops Principal; create passes only an audit string; reads/events/consent/submit/modify/extend/cancel do not carry a Principal authorization context. | BOOK-AUTH-01 limits initial scope to self-service. Persisted requested/resolved scope remains in append-only booking decision evidence; direct booking-scope/beneficiary expansion is G-0006 and blocks on-behalf completion. |
| Booking re-consent | `modify()` exists and persists re-consent decision provenance. | Preserve; do not redesign in first slice. |
| Booking overlap | PostgreSQL GiST exclusion exists and migration through `0028` passed. | Preserve; do not duplicate or weaken. |
| Vehicle writes | Create/update/transition/document/transfer already apply role and partial scope checks; `SystemAdmin` is included in write roles. | Do not rewrite in read slice; SystemAdmin operational policy remains a later explicit decision. |
| Vehicle reads | List filters by organization only; detail/history drop Principal entirely. Existing write-role admission is not an acceptable general read policy. | Block VEH-READ-AUTH-01 until D-VEH-READ freezes reader roles, masking and opaque cross-org behavior. |
| Vehicle frontend | No live Vehicle route; mockups not approved. | No UI edits. |
| Entitlement allocation | No DB exclusivity or safe Vehicle qualification contract. | Record for CORE-5; not part of first parallel repairs. |
| Handover atomicity | Handover and Booking transitions occur in separate transactions. | Record for CORE-4; not part of first parallel repairs. |

## Stable Contracts Frozen for Initial Repairs

- Authenticated `Principal` is the only authority source.
- Actor IDs in request payloads are data to validate, never authority.
- Vehicle/Booking organization comes from persisted resources.
- For the self-service-only interim Booking path, immutable policy-decision evidence records requested/resolved event-time scope. Direct booking scope and beneficiary fields are required before on-behalf mode.
- Employee Booking first slice is self-service only; on-behalf remains denied until D-SCOPE-PROVISIONAL closes.
- Existing Booking policy decisions, consent atomicity, overlap range and re-consent provenance are unchanged.
- Existing hierarchy constraints are valid and remain enabled.
- UI routes and visual behavior remain untouched until phase mockup approval.

## Deferred Product Gaps

The following are valid but do not belong to the first repairs: beneficiary/direct-scope expansion for on-behalf Booking, idempotency ledgers, workflow start races, approval delegation, Vehicle activation/draft model, leased vehicle authority, maintenance, key custody state, entitlement allocation exclusion, comprehensive same-org composite FKs, evidence immutability and handover/booking transaction unification.

Each returns in its owning CORE phase after the baseline gates are green.

## Required Gate

FIX-FIXTURES-01A/01B, BOOK-AUTH-01 and BOOK-AUTH-HTTP-01 must pass staged validation in dependency order. They then enter independent critique before integration status changes. VEH-READ-AUTH-01 remains blocked. CORE-0 remains `ACTIVE` until evidence and critique disposition are recorded.
