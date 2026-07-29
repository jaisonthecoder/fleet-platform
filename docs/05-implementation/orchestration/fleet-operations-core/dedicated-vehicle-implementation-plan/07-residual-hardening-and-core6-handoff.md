# DEDICATED-07 - Residual Hardening and CORE-6 Handoff

> **Status:** `ACTIVE`
> **Created:** 2026-07-28
> **Predecessor:** DEDICATED-06 technically verified local/manual flow
> **Production claim:** None until target-environment consent activation and human UAT/pilot approval

## 1. Objective

Close the remaining autonomous engineering risks after DEDICATED-06, produce an executable UAT/operations package, restore the full frontend regression signal, and hand stable Dedicated operational contracts into CORE-6 reporting, audit, notification, and reconciliation work.

This plan does not enable `WithDriver`, select pilot owners, or claim production approval. Governed consent authoring/activation is now implemented separately.

## 2. Ordered Implementation Slices

### D07-01 - Persisted BSD Schedule and Conflict Workbench - `VERIFIED`

**Outcome:** Fleet can reload an allocated request and see its persisted Proposed, Confirmed, Active, Conflict, Completed, and Cancelled BSD windows rather than losing schedule state after navigation.

Backend/API:

- Retain `GET /v1/entitlements/:id/bsd-windows` as the authoritative privacy-safe schedule.
- Add Fleet commands only where operationally required: cancel a Proposed/Confirmed future window and retry/resolve a Conflict after Booking/custody remediation.
- Keep worker activation/restoration authoritative; UI commands cannot directly toggle Pool/Dedicated Vehicle state.
- Return window ID, bounds, status and operational reason only. Do not expose HR leave source, Person facts, Booking owner, or unrelated Booking details.

Frontend:

- Load persisted windows for the selected `Allocated` request.
- Render status, exact Pool start, return deadline, and operational remediation.
- Disable a second proposal while a Proposed/Confirmed/Active/Conflict window exists.
- Permit confirmation only for Proposed windows and cancellation only for Proposed/Confirmed future windows.
- Show Conflict as an operational alert with refresh/retry guidance, without other-person Booking data.

Evidence:

- Contract parsing and API route-order tests.
- Reload persistence, status matrix, EN/AR, RTL, keyboard and mobile component tests.
- PostgreSQL cancel/worker-retry tests and Booking privacy assertions.

### D07-02 - Independent-Connection Allocation and Lifecycle Stress - `VERIFIED`

**Outcome:** Real PostgreSQL contention proves one winner and deterministic, retryable loser behavior.

- Use independent database connections and a synchronization barrier.
- Two requests compete for the same Vehicle and effective range.
- One request competes for two Vehicles with the same expected revision.
- Booking consent/reservation competes with Dedicated allocation for one Vehicle.
- Return competes with BSD activation/restoration.
- Assert one allocation, one active request allocation, no orphan command, stable replay, no deadlock leak, and mapped `409` reasons.
- Capture latency percentiles and lock-wait observations without Person labels.

Progress: the same-Vehicle/two-request independent-session proof passes with production Vehicle-first lock order. Booking-versus-Dedicated and return-versus-BSD barrier tests remain.

### D07-03 - Dedicated Metrics and Reconciliation - `VERIFIED`

**Outcome:** Operators can detect inconsistent state and understand aggregate health without sensitive labels.

Metrics:

- Eligibility ALLOW/DENY/error counts.
- Approval SLA age and escalation count.
- Consent delay and allocation delay.
- Preference honoured/variance and no-qualified-Vehicle rate.
- BSD activation, conflict, missed-window and restoration counts.
- Command replay/conflict and worker failure counts.

Reconciliation checks:

- Terminal Entitlement with active allocation.
- Allocated Entitlement without active allocation.
- Dedicated Vehicle marked Pool outside an Active BSD window.
- Active/Conflict BSD window without active allocation.
- Renewal without predecessor or predecessor in another organization.
- Referenced preview evidence unexpectedly removed.

Implementation:

- Add a read-only reconciliation service and SystemAdmin/InternalAudit endpoint.
- Never auto-repair in the first slice. Return stable reason codes, references, detection time and recommended owner.
- Add a scheduled summary/audit event only after query and privacy review.

### D07-04 - UAT, Pilot and Rollback Package - `TECHNICALLY_READY_HUMAN_GATES_PENDING`

**Outcome:** Human approvers receive executable scripts and evidence templates rather than prose-only gates.

- Personas: Employee, Line Manager, Delegate, Fleet Manager, Cluster Fleet Lead, Cluster CEO, assigned driver, SystemAdmin negative actor, support/audit reader.
- Journeys: no preference, honoured preference, variance, deny, modification/resubmission, wrong driver, concurrent allocation, renewal, BSD activation/Booking/restoration, cross-org denial, WithDriver disabled.
- For each step record prerequisites, role, route, action, expected API/state/audit result, screenshot/evidence ID, actual result, defect and sign-off.
- Add pilot entry checklist, rollback command sequence, preserved-evidence checks and named-owner placeholders.
- Owner fields remain explicitly `UNASSIGNED_HUMAN_GATE` until supplied.

### D07-05 - Full Frontend MSW Regression Repair - `VERIFIED`

**Outcome:** `pnpm --filter app-ui test` becomes a trustworthy whole-application gate.

- Standardize MSW handlers against the configured absolute API base instead of mixing relative `/api/...` and `*/api/...` patterns.
- Keep `onUnhandledRequest: error`.
- Repair stale route assertions such as Dedicated Vehicle being Coming Soon.
- Fix only contract/handler/timing defects proven by isolated tests; do not increase global timeout to hide unhandled requests.
- Run isolated failing files first, then full suite, typecheck and production build.

### D07-06 - CORE-6 Handoff - `VERIFIED`

**Outcome:** Dedicated read models, metrics, reconciliation and alerts are stable inputs to operational dashboards and support workflows. See [Dedicated Vehicle CORE-6 Handoff](../dedicated-vehicle-core6-handoff.md).

- Update operations overview and Entitlement inventory contracts.
- Add role/privacy matrix for Fleet, Executive, InternalAudit and SystemAdmin.
- Wire notification events for modification required, approval result, consent required, allocation result, BSD conflict and restoration.
- Publish support diagnostics and runbook links.
- Do not duplicate domain mutation logic in dashboard/report modules.

## 3. Three Critique Rounds Per Slice

Every D07 slice runs and records:

1. **Contract, security and data:** Principal/organization/scope, privacy, schema/indexes, strict contracts, transaction/evidence boundaries.
2. **Behavior, concurrency and operations:** replay, stale state, races, worker failures, degraded dependencies, reconciliation and support response.
3. **UX, accessibility and UAT:** role clarity, EN/AR/RTL, keyboard/focus, mobile/reflow, empty/error/conflict states and actionable copy.

Blocking/High findings are repaired and the discriminating test rerun before the next slice starts.

## 4. Validation Matrix

| Slice | Narrow gate | Integration gate | UI/operations gate |
|---|---|---|---|
| D07-01 | BSD contract/service/component tests | Entitlement + Booking PostgreSQL | EN/AR persisted reload/conflict workbench |
| D07-02 | Concurrency test compile | Independent-connection race suite | Conflict reason/readability check |
| D07-03 | Reconciliation unit/query tests | Seeded inconsistency detection | Audit/Admin response masking |
| D07-04 | Markdown/link/schema validation | Dry-run evidence package | Human sign-off remains pending |
| D07-05 | Isolated MSW failing tests | Full frontend suite | Typecheck/build |
| D07-06 | Contract/static guards | Dashboard/notification integration | Role/privacy browser checks |

## 5. Exit Gates

### Autonomous technical exit

- D07-01 through D07-06 executable engineering work passes.
- Full frontend regression suite is green or remaining unrelated failures are individually evidenced and owned.
- No unresolved automated Blocking/High critique finding.
- CORE-6 contracts and operational ownership boundaries are documented.

### Production exit

The following remain mandatory human/external gates:

- Active organization-accepted EN/AR Dedicated consent version in the target environment.
- Named UAT, pilot, support, release and rollback owners.
- Signed UAT/pilot and go/no-go evidence.
- D16 approval before `WithDriver` is enabled.

## 6. Immediate Action

Start D07-01. The first falsifiable check is that an allocated request with a persisted Proposed/Confirmed/Active/Conflict BSD window can reload the Fleet page and render the authoritative status without creating a second proposal or exposing leave/Booking-person data.