# Sub-Phase 1A — Platform Completion (Block A)

**Extends the Phase 0 foundation into the complete decision + orchestration + delivery substrate that every feature block depends on.** No feature is built until 1A is green, because bookings, compliance, entitlements and fines all *enforce* answers this sub-phase produces (they never contain rule logic).

- **Entry dep:** Phase 0 gate green (real PDP with 2 rule types, workflow skeleton + escalation, hierarchy tree, audit, SoD, Redis cache, outbox/inbox).
- **Unlocks:** 1B, 1C (parallel), then the core loop.
- **New tables:** none — 1A uses the Phase 0 core schema. It *populates* `policy_rule`/`policy_version` (seed decision tables) and exercises `workflow_*`, `scheduled_work`, `outbox_event`.

---

## 1. PDP → full 12 rule types

Phase 0 registered **2** rule types end-to-end as the pattern (`booking-buffer`, `driver-eligibility`). Block A registers the remaining **10**. Each rule type ships as a unit:

- a **Zod input schema** (`contracts/policy/<rule-type>.contract.ts`) validating the evaluation context;
- **stable reason codes** (EN + AR) for every outcome;
- a **mandatory safe default** (fail-safe = DENY / most-restrictive VALUE);
- a **decision-table test** proving every row + the default + first-match ordering;
- **immutable JSONB** activation via `PolicyAdminService.activate()` (persist-then-invalidate cache).

| # | Rule type | Decision kind | Safe default | Consumed by | Value decision |
|---|---|---|---|---|---|
| 1 | `booking-buffer` ✅ | VALUE (minutes) | 15 min | bookings (1D) | config |
| 2 | `driver-eligibility` ✅ | ALLOW/DENY | DENY | compliance/bookings (1D) | config |
| 3 | `max-booking-duration` | VALUE (hours) | most-restrictive | bookings (1D) | **D3** |
| 4 | `booking-approval-chain` | ROUTE_TO (chain) | escalate to fleet manager | bookings→workflow (1D) | **D6** |
| 5 | `entitlement-approval-chain` | ROUTE_TO (chain to Cluster CEO) | escalate | entitlements→workflow (1E) | config |
| 6 | `dedicated-vehicle-eligibility` | ALLOW/DENY | DENY | entitlements (1E) | **D8** |
| 7 | `driver-eligibility-gate` | ALLOW/DENY (composite) | DENY | compliance (1D) | config |
| 8 | `compliance-alert-ladders` | VALUE (offset schedule) | most-aggressive ladder | compliance engine (1D) | **D9** |
| 9 | `hard-block-conditions` | DENY (no override) | DENY | compliance (1D) | config (structural) |
| 10 | `fines-hr-threshold` | VALUE (count/window) | ≥3 / 12 mo | fines (1E) | **D12** |
| 11 | `black-point-timeframe` | VALUE (transfer deadline) | most-aggressive | fines (1E) | **D14** |
| 12 | `consent-re-consent-tolerance` | VALUE (tolerance) | 0 (any change ⇒ re-consent) | bookings/consent (1D) | config |
| — | `fuel-deviation-threshold` | VALUE (%) advisory | flag on any deviation | handover (1D) | config |

> **Engine complete ≠ tables populated (P1B-R1-2).** 1A delivers the *engine* for all 12; six value tables (**D3, D6, D8, D9, D12, D14**) run on **Legal/ops-reviewed fixtures with dated risk** until the decision is signed off and the table is second-approved. Track **per rule type**: `engine-registered` → `fixture-seeded` → `production-value-signed-off` → `second-approved`.

- **Latency:** every rule type stays within the PDP budget (p95 < 200 ms) served from the Redis compiled-rule cache with Postgres read-through (Phase 0 mechanism).
- **Logging:** every evaluation appends a minimized `decision_log` fingerprint (never raw context — P0-R2-5).

## 2. Workflow engine (full)

Extends the Phase 0 skeleton (`advanceChain` state machine + `scheduled_work` escalation) to the complete approval engine used by bookings (1D) and entitlements (1E):

- **Multi-step chains** resolved from the PDP `*-approval-chain` `ROUTE_TO` output (data-driven, never hard-coded).
- **One-hop delegation** — a step assigned to a delegator is decidable by an active `delegation` delegate; the decision is recorded **"on behalf of"** (`workflow_step.on_behalf_of_person_id`), and SoD-06 forbids a delegate approving requests raised by themselves or the delegator.
- **Timeout escalation** — SLA per workflow type: **24 h** (booking) / **48 h** (entitlement); overdue steps enqueue `scheduled_work` (`escalation:workflow-sla-timeout`) picked up by a BullMQ worker + reconciler.
- **"Request modification" outcome** — a first-class step decision that returns the request to the raiser (distinct from reject), voiding consent beyond tolerance (bookings) and requiring resubmission.
- **No-orphan reroute** — if an assignee has no valid approver on scope (vacancy/restructure), the step reroutes up the hierarchy to the next valid scope holder rather than stalling.
- **Cycle scoping** — submit → reject/modify → resubmit restarts the chain cleanly using a per-cycle marker (avoids stale-assignment bugs).

## 3. Hierarchy engine (full)

Extends the Phase 0 `ltree` tree to the full N-level engine:

- **N-level configuration** — level labels (Cluster→Pool→Location for AD Ports) are data; another org configures Company→Region→Branch.
- **Roll-up / drill-down** — scope queries over `ltree path` (GIST) answer "all vehicles/persons/costs under this node" and "which node answered".
- **Restructure-with-history** — moving/renaming a node is **effective-dated** (`valid_from/valid_to`), never destructive; historical queries resolve against the tree as it was at a point in time (closes B-07).

## 4. Notification dispatcher (P9)

The delivery port consumed by compliance ladders (1D) and booking reminders (1D):

- **Port + adapter** — `NotificationPort` interface; Email/M365 adapter (Graph) behind config; a **stub delivery** adapter for local/dev and tests (mirrors the outbox transport pattern).
- **Policy floors** — **compliance alerts are unmutable** (cannot be disabled by user preference); operational reminders are mutable.
- **Triggered from events** — consumes `outbox_event` (e.g. `ComplianceExpiryApproaching`, `BookingReminderDue`) via the dispatcher/inbox path; never in the `api` request thread.
- **Audit** — every send is recorded; delivery failures retry with DLQ (reuses the Phase 0 outbox/DLQ mechanics).

## 5. HCM (person) sync + freshness SLA

Eligibility (1D) depends on HCM-synced person data, so the sync contract is defined **here** (P1B-R1-6 / P1B-R2-2):

- **Sync** — scheduled pull from Oracle Fusion HCM into `person` (employment status, grade, licence number/expiry, line manager, sponsor). Idempotent, resumable; corrective-entry pattern, never in-place destructive edits.
- **Freshness SLA** — each `person` row carries a "data as of" timestamp; the eligibility gate surfaces it.
- **Fail direction = block + escalate** — a stale/failed sync **blocks** (never silently allows an ineligible driver) and escalates; an outage does not fail-open.

## 6. Contracts

`contracts/policy/*.contract.ts` (one per new rule type: input schema + reason-code enum), `contracts/workflow.contract.ts` (extend: modification outcome, on-behalf-of, SLA), `contracts/notification.contract.ts` (message + channel + mutability), `contracts/hcm-sync.contract.ts` (person sync payload + freshness).

## 7. PDP rule types

All **12** registered + `fuel-deviation-threshold` (13 tables total). See §1.

## 8. Events

`outbox_event`: workflow `StepAssigned`, `StepDecided`, `RequestModificationRequested`, `WorkflowEscalated`; notification `NotificationQueued`/`NotificationSent`/`NotificationFailed`; hcm `PersonSynced`. Consumers: notification dispatcher, escalation worker.

## 9. Endpoints

No new public feature endpoints beyond Phase 0's `platform`/`policy`. Internal: workflow decision surface consumed by 1D/1E; PDP `POST /api/v1/decisions/evaluate` now answers all 12 rule types. Admin activation of rule tables stays a **service method** (no unauthenticated mutation endpoint until auth lands).

## 10. Tests

- **Decision-table test per rule type** (12 + fuel): every row, the default, first-match ordering, EN/AR reason codes.
- **PDP fail-safe both halves (P0-R2-2 completes here):** outage/no-rule ⇒ DENY **and** a human escalation `scheduled_work` row is created and picked up.
- **Workflow:** two-step chain runs; one-hop delegated decision logged "on behalf of"; SLA timer fires and escalates; "request modification" returns to raiser; no-orphan reroute on a vacant scope.
- **Hierarchy:** 3/4/5-level roll-up/drill-down; restructure-with-history point-in-time query.
- **HCM sync:** stale sync ⇒ eligibility blocks + escalates; freshness surfaced.
- **Notifications:** compliance alert cannot be muted; failed send goes to DLQ and replays.

## 11. Exit gate

- All **12 PDP rule types** (+fuel) pass decision-table tests and are logged; per-rule-type status tracked (`engine-registered`/`fixture-seeded`/`signed-off`/`second-approved`).
- Workflow: chains, one-hop delegation on-behalf-of, 24 h/48 h escalation timers, "request modification", no-orphan reroute — all tested.
- Hierarchy full (N-level, roll-up/drill-down, restructure-with-history) tested.
- Notification dispatcher live with unmutable compliance floors; DLQ replay proven.
- HCM sync + freshness SLA defined; fail-direction = block + escalate, tested.
- **PDP fail-safe "+ escalate" human half complete and tested** (closes P0-R2-2).

## 12. Traceability

- **FRs:** FR-POL-01..05 (policy engine), FR-WF-01..06 (workflow), FR-ARC-02 (hierarchy), P9 (notifications), eligibility HCM dependency.
- **Critique resolved/advanced:** P0-R2-2 (escalate half) ✅; P1B-R1-2 (engine vs populated split) ✅ mechanism; P1B-R1-5 (dispatcher) ✅; P1B-R1-6 + P1B-R2-2 (HCM sync + freshness fail-safe) ✅.
- **Gate items advanced:** "all 12 rule types pass"; "SoD-06"; escalation timers; notification floors.
- **Migration catalog:** none (uses `0001_platform` + `0002_platform_core`).
- **D-list:** D3, D6, D8, D9, D12, D14 (fixture-gated values); D7 (consent wording, consumed in 1D).

**Next:** [Sub-Phase 1A₂ — Lookup & User/Access Management](01b_sub-phase-1a2_lookup-and-user-management.md).
