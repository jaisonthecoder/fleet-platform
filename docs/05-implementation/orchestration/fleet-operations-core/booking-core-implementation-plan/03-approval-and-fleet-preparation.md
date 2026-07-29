# BOOKING-03 - Approval and Fleet Preparation

> **Status:** `VERIFIED`
> **Updated:** 2026-07-29
> **Production gate:** Target-environment governed consent activation and human UAT/pilot. G-0008 is technically closed.

## Objective

Deliver a scoped, assignee-authorized Booking approval inbox and Fleet preparation queue with immutable workflow lineage and exactly-once decisions.

## Entry Criteria

- BOOKING-02 submit is exactly once.
- `G-0008` workflow definition, delegation and race design is approved.
- Approval screen `25` is the content baseline; unimplemented pool-peak forecasting remains omitted/unavailable.

## Mandatory Visual Source

Follow [25-booking-approvals-inbox.png](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/25-booking-approvals-inbox.png).

Preserve the desktop master-detail composition and responsive equivalent:

1. Left pending queue with Vehicle/window, time-to-pickup/SLA and safe status chips.
2. Right selected-request header with requester summary and Booking number.
3. Vehicle, window, purpose/passengers and approved cost/evidence fact strip.
4. Stacked system verdicts for eligibility, consent and conflicts; pool-peak appears only with a verified forecast source.
5. Justification evidence block.
6. Sticky/bottom action area for Approve, Request change and Decline plus the SoD explanation.

Use API evidence rather than the sample `Amina Khoury`, `BK-1211`, Vehicle, cost, consent version or forecast values.

## Workflow and Database Work

1. Add immutable workflow definition/deployment versions and pin every instance at start.
2. Persist one immutable Booking approval-route record containing the ordered role/assignee route, decision/version, requested/resolved scope, effective time and workflow definition/deployment version. Retries reuse this record rather than re-evaluating a changed route.
3. Validate active delegation server-side, including delegator, delegate, validity window, scope and one-hop rule.
4. Add task/effect idempotency and optimistic revision or row/advisory locking for decisions.
5. Define cancellation-versus-decision behavior. One command wins; the loser receives stable conflict without orphan state.
6. SLA expiry creates an escalation task and never auto-approves.
7. Index pending work by organization, assignee/delegate, scope, status and SLA.

## API Work

1. Add a cursor-paged approval worklist for the current assignee/delegate only.
2. Return safe evidence: Booking number, requester/beneficiary/driver display summary, Vehicle summary, window, purpose, consent status/version, eligibility verdict reason codes, scope, current step and SLA.
3. Omit raw private HR/licence facts, consent IP/device/signature and unrelated Booking data.
4. Preserve approve/decline/request-changes commands but require task assignment, scope, workflow revision and idempotency.
5. Enforce requester/creator self-approval denial. `SystemAdmin` alone cannot approve.
6. Add a separate scoped Fleet preparation queue for Approved/upcoming handovers with compliance/custody readiness.
7. Do not implement silent Vehicle substitution.

## Frontend Work

1. Build the approved screen `25` master-detail approval inbox at the role route.
2. Render queue loading, empty, stale task, delegated, SLA, denied and error states.
3. Display safe policy/eligibility/consent/conflict evidence and prior decisions.
4. Require a reason for decline/request changes according to the contract.
5. Refresh on 409 and explain the new state; optimistic display never fabricates success.
6. Build the scoped preparation list only after its API is verified.

## Tests

- Route variants and pinned definition after policy/workflow updates.
- Requester/creator/SystemAdmin denial and assigned approver success.
- Foreign organization, sibling scope, stale delegation and expired delegation denial.
- Duplicate and concurrent decisions, submit/decision, modify/decision and cancel/decision races.
- SLA escalation creates one task and no automatic approval.
- Request changes clears/voids the approval cycle exactly once and requires re-consent as applicable.
- Frontend queue/action states, masking, EN/AR/RTL, keyboard and browser E2E.

## Exit Gate

Submitted Bookings route and decide exactly once with immutable workflow and policy evidence. Assigned actors see only authorized tasks; Fleet roles see an actionable scoped preparation queue. `G-0008` is closed.

## Pre-Entry Critique and Safe Foundation

One rigorous pre-entry critique was completed before implementation. It found that full BOOKING-03 cannot start safely because:

1. BOOKING-02 remains externally blocked on approved EN/AR legal consent content/source.
2. Workflow definition/deployment version pinning and immutable approval-route lineage are not approved.
3. Decision idempotency/revision and cancellation-versus-decision winner rules are not frozen.
4. SLA escalation assignment/ownership and Fleet preparation contracts are not frozen.

The critique also found one independent security defect that could be repaired without choosing those designs: delegated decisions trusted `onBehalfOfPersonId` without validating a real delegation.

Delivered foundation:

- Delegated workflow decisions now require an active, one-hop delegation matching workflow type, delegator, delegate, validity window and workflow-instance organization.
- Organization seam enforcement is owned by the approved Platform repository boundary, preserving ADR-008 and keeping Workflow tenant-agnostic.
- Unit tests prove active delegation success plus expired and cross-organization denial.
- Real PostgreSQL Booking approval proves an active delegate can decide and an expired delegate receives `workflow-delegation-not-active`.
- Evidence: focused Workflow/Booking/controller `72/72`; Booking HTTP/PostgreSQL/concurrency/Handover `23/23`; typecheck/lint/contracts/organization/dependency guards pass.

## Completed Implementation

- Migration `0045_workflow_approval_lineage` adds immutable workflow definitions/deployments, pinned instances, immutable Booking route/step evidence, step/instance versions and durable decision commands. Existing workflows backfill to explicit legacy deployments without invented approvers or SLA.
- Re-consent/re-submission preserves multiple immutable historical routes. Definition snapshots are deterministic SHA-256 deployments and route/deployment/decision evidence is database-protected from mutation.
- Approve/decline/request-change require Booking and step versions plus `Idempotency-Key`. Booking, workflow instance and current step lock in fixed order; same-key replay is stable, payload mismatch and stale versions return `409`.
- Cancel and decision both lock Booking first. PostgreSQL concurrency evidence proves exactly one wins.
- Requester and SystemAdmin-only approvals are denied. Direct assignee or active organization/type/window/one-hop delegation is revalidated inside the transaction.
- Hourly SLA worker uses a PostgreSQL advisory transaction lock across replicas and never auto-approves. Missing SLA remains null/disabled.
- Assigned/delegated safe approval worklist and scoped read-only Fleet preparation APIs are live. Raw HR/licence/consent transport/signature/policy internals are excluded.
- Approved screen `25` and Fleet preparation routes use live APIs with EN/AR, RTL, reason-gated negative decisions, versioned commands, SLA display, reason-specific `409` recovery, and honest unavailable forecast.

## Critique and Verification

- Two rigorous critique rounds completed. Round-one genuine findings repaired: SystemAdmin SoD, immutable decisions, Booking-first cancel locking, conflict explanations, SLA display and preparation UI. Stale claims that route/ledger/worklists were unused were disproved from current source and PostgreSQL tests.
- Round-two found no Blocking/Critical issue. Remaining High hardening was completed: backend-required decline/request-change reasons, explicit safe-projection boundary and replica-safe SLA scheduler.
- Evidence: migration fresh/idempotent; backend focused `75/75`; Booking HTTP/PostgreSQL/concurrency/Handover `25/25`; frontend `20` files / `89` tests and build; typecheck/lint/contracts/organization/dependency guards pass; EN/AR screen `25` at `320/768/1024/1440` has no horizontal overflow.

G-0008 is closed and BOOKING-03 is verified. BOOKING-02 now has an immutable governed source and active local v3 content; production readiness depends on target-environment activation and human UAT/pilot, not missing code or integration.
