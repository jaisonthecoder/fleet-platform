# DEDICATED-00 - Contract, Security and Data Baseline

> **Status:** `VERIFIED_DRAFT_BASELINE`
> **Verified:** 2026-07-25

## Verified slice

- Migration `0046_entitlement_request_baseline` adds principal/requester/driver separation, organization-safe scope/preference references, revision, provenance and the durable command ledger.
- Public Draft creation is Principal-bound, scope-authorized and retry-safe. Owner list/detail and server-owned context are live.
- Optional preference note is persisted as non-binding plain text. `preferredVehicleId` remains rejected until D3/D8 can project eligible options.
- WithDriver, submit, approval, consent, allocation, BSD and cancel remain fail-closed with stable reason codes.
- A separate EN/AR `/dedicated-vehicle` route replaces Coming Soon with Request/My Requests and truthful policy gates.
- Three independent critique rounds are recorded under `reviews/DEDICATED-00-round-*.md`; no Blocking/High finding remains.

## Objective

Freeze the principal-bound entitlement, scope, lifecycle, preference, decision-provenance, command-idempotency and exclusive-allocation contracts before any production UI mutation is enabled.

## Entry Criteria

- PRD C3 and D1/D2 business boundaries accepted.
- Dedicated mockup disposition reconciled with `D-UI-D`.
- D3, D8, D16, consent, renewal and utilization decisions are recorded as gates with safe behavior.

## Scope

### Domain and persistence

1. Separate authenticated actor, requester/beneficiary, assigned driver, approver and allocator.
2. Persist organization plus direct effective scope using same-organization composite references.
3. Add optimistic `revision` and legal lifecycle: `Draft`, `PendingApproval`, `ModificationRequested`, `Approved`, `AwaitingConsent`, `Allocated`, `Returned`, `Expired`, `Declined`, `Cancelled`.
4. Persist separate duration and driver axes; WithDriver requires an approved professional driver contract or remains disabled.
5. Add immutable eligibility and approval-route provenance, pinned workflow deployment references and resubmission-cycle lineage.
6. Add nullable `preferred_vehicle_id` and `preference_note` (max 500). Preference never represents allocation; API/DTO naming uses `preferredVehicleId`, while only the Fleet allocation command/result uses final `vehicleId`.
7. Add append-only preference/allocation variance evidence preserving original preference.
8. Design effective-range exclusive allocation with database enforcement; close `G-0010` before DEDICATED-03.
9. Add durable entitlement command ledger keyed by organization, actor, command, idempotency key and payload hash.
10. Freeze stable reason codes and server-derived action capabilities.

### API baseline

- `GET /v1/entitlements/request-context`.
- `GET /v1/entitlements/people` with bounded scoped search.
- Principal/owner/scope protection for list/get.
- Create/update/cancel commands bind actor and organization server-side.
- Static collection routes precede `/:id`.

## Authorization Matrix

| Action | Employee | Fleet roles | Approver | SystemAdmin |
|---|---|---|---|---|
| Self context/Draft | Own | Own if Employee | Own if Employee | Denied |
| On-behalf Draft | Denied | Managed closure after explicit authority | Denied | Denied |
| Read | Own | Managed closure | Assigned decision evidence | Audited config only |
| Consent | Persisted assigned driver | Only if assigned driver | Only if assigned driver | Denied |
| Allocate | Denied | Authorized Fleet allocator | Denied | Denied |

## Tests and Evidence

- Fresh/idempotent migration, constraints, backfill and rollback rehearsal.
- Unlinked/inactive/foreign-org/sibling-scope/spoofed actor negative HTTP tests.
- Same-key replay and different-payload conflict for every retryable command.
- Unauthorized list/get return opaque behavior and no mutation side effects.
- Contract drift and route-precedence tests.
- Allocation-exclusion design tested before enabling allocation.

## Three Critique Rounds

### Round 1 - Contract, Security and Data

Review tenant/scope FKs, identity separation, lifecycle completeness, preference semantics, provenance immutability, privacy, migration safety and SystemAdmin denial. Repair every Blocking/High finding and rerun migration/HTTP guards.

### Round 2 - Behavior and Concurrency

Review command ledger races, stale revision, duplicate submit/consent/allocation, workflow resubmission lineage and exclusion-constraint behavior. Use real PostgreSQL and injected failures; repair and rerun.

### Round 3 - UX and Operations

Review server capability/reason projections, masking, EN/AR reason catalog, degraded dependency states and operational rollback. No production write UI is permitted yet. Repair and re-review.

## Exit Gate

Contracts and migrations are frozen; all public operations are Principal-aware; G-0010 has an approved executable design; D3/D8/D16 remain explicit gates rather than guessed logic; three critique rounds have no unresolved Blocking/High findings.
