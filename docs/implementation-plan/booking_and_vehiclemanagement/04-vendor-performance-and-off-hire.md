# Phase 4 (S3) — Vendor Performance, Off-Hire and Discrepancy Operations

## Objective

Deliver the mockup's vendor scorecards, active-contract detail, off-hire workflow progress and Finance/Procurement discrepancy operations using platform evidence rather than self-reported vendor data.

## Dependencies

- Phase 2 Vendor Master and Phase 3 Lease Contracts.
- Vehicle lifecycle, condition/damage and maintenance facts are enriched by later Vehicle/Handover phases; scorecards expose completeness until those sources are live.
- Off-hire completion integrates with Phase 7 vehicle lifecycle and Phase 16 handover/return.

Phase 4 may implement contracts/read models early, but production off-hire completion is gated by Phase 7 lifecycle transitions, Phase 8 documents/device/key custody and Phase 16 condition/handover evidence. This avoids circular delivery claims while keeping continuous numbering.

## Mandatory mockup gate — supplied and missing

Supplied: selected vendor scorecard/active contracts, off-hire progress cards, contract/invoice discrepancy list.

Request before implementation: off-hire initiate, condition report, penalty evidence/calculation, vendor acknowledgement/portal, dispute, final return, scorecard drill-down/exclusions, discrepancy resolution, permission/error/mobile/RTL states.

## Scorecard semantics

Computed, versioned metrics:

- Repair turnaround versus SLA.
- Off-road days per vehicle and contract.
- Repeat failures in rolling period.
- SLA breaches.
- Cost versus market/contract benchmark.
- Optional telematics/device uptime for telematics vendors.

Store metric definitions/version, source completeness and calculation window. Grade thresholds are configuration/policy; do not hardcode B+/A-/C. Exclude/adjust only through audited evidence.

Required scorecard semantics are versioned per metric:

- Window: trailing months/calendar period/contract period.
- Minimum data points and insufficient-data behavior.
- Planned-maintenance inclusion/exclusion.
- Vendor-attributable vs customer/force-majeure categories.
- Per-vehicle, per-contract and vendor rollup denominator.
- Audited exclusion categories, requester/approver and reason.
- Grade threshold policy/version and effective date.

No grade is shown when evidence is insufficient; UI shows completeness and degraded periods.

## Off-hire workflow

`Initiated -> ConditionReportPending -> PenaltyComputed -> VendorAcknowledgementPending -> ReturnScheduled -> Returned -> Closed`

Alternative states: `Disputed`, `Cancelled`, `ChangesRequired`.

Rules:

- Initiation by Procurement or authorized Fleet lead.
- Vehicle becomes `OffHirePending` only through guarded domain transaction.
- Condition report and photos are immutable/versioned.
- Penalty uses the exact approved contract version effective at initiation.
- Vendor acknowledgement via portal/integration or Procurement-recorded evidence.
- Tracker/key/document/custody return checklist before completion.
- Completion closes contract-vehicle link and transitions vehicle according to approved outcome.

Completion dispositions map explicitly to the existing vehicle lifecycle:

| Off-hire disposition | Vehicle/domain action |
| --- | --- |
| Returned to lessor | `OffHirePending -> Transferred`; close contract-vehicle link |
| Off-hire cancelled / retained | `OffHirePending -> Active`; case closed with reason |
| Decommission after return/damage | `OffHirePending -> Decommissioned`; evidence/approval required |
| Sold/disposed under separate authority | Use approved Vehicle Lifecycle command; do not infer from off-hire |

`OffHirePending` already exists in the current vehicle lifecycle. No new duplicate lifecycle state is introduced.

## Database

- `off_hire_case`: immutable `lease_contract_version_id` captured at initiation, vehicle/contract/vendor, status, disposition, revision and workflow deployment/version.
- `off_hire_event`, `off_hire_condition_report`, `off_hire_penalty`, `vendor_acknowledgement`, `off_hire_return_checklist`.
- `off_hire_penalty`: same contract-version FK plus clause/formula basis, inputs, currency and approved override evidence.
- `vendor_scorecard_definition`: metric code, formula version, window, minimum samples, attribution/exclusion policy and effective range.
- `vendor_scorecard_run`: definition set/version, window start/end, completeness state and data-gap evidence.
- `vendor_scorecard_metric`: run/vendor/contract/vehicle grain, numerator/denominator/value/grade and source fingerprints.
- discrepancy resolution/evidence references from Phase 3.

Append-only lifecycle; optimistic locking; organization/vendor/contract/vehicle consistency; one active off-hire case per contract vehicle.

Evidence links:

- Condition report references immutable Phase 16 handover/condition and damage-pin evidence or a dedicated append-only junction; do not copy mutable photos.
- Return checklist references key custody logs, critical document returns and telematics-device unpair/return records from Phase 8.
- Contract vehicle link receives `lease_ended_at_utc`, closure reason and off-hire case ID.
- Platform-owned trackers are unpaired/returned to platform inventory; lessor-owned devices follow signed D1 terms.

## Backend/API and workflow

Off-hire commands and read models; pure penalty decision adapter; bounded workflow definition with Procurement/Fleet/Finance/vendor tasks; reminders/escalations; vendor scorecard scheduled computation; discrepancy queues. State, history, audit and outbox atomically committed.

## Frontend

- Vendor Master detail scorecard and active contracts exactly follows approved mockup information hierarchy.
- Off-Hire & Discrepancies tab shows progress, urgency, monetary variance and owner.
- Dedicated off-hire wizard/detail and dispute evidence screens after mockup approval.
- Role-specific controls and cost masking; status never color-only.

## Integrations

I3 off-hire record sync in/out after contract; I2 invoice discrepancies; vendor portal acknowledgement/document/dispute. Outages queue commands or allow Procurement evidence fallback according to signed policy; no fabricated acknowledgement.

## Tests

State-machine/property tests, exact contract-version penalty, concurrency/idempotency, condition report immutability, source completeness, vendor portal isolation, Finance/Procurement SoD, vehicle lifecycle/custody integration, dispute/rollback, notification escalation, scorecard recalculation/versioning, EN/AR/a11y/browser.

Include insufficient/seasonal scorecard data, planned vs corrective maintenance, audited force-majeure exclusions, immutable contract version during later amendment, every disposition mapping, missing key/device/document checklist, cross-vendor dispute, concurrent acknowledgement and contract-link closure.

## Rollback

Stop new off-hire initiation and scorecard publication; active cases continue on pinned workflow/contract versions. Reverting a state requires an audited compensating command; never delete evidence.

## Mandatory critique

Inspect penalty correctness, self-approval, mutable condition evidence, vendor portal leakage, incomplete tracker/key return, scorecard gaming/bias, missing source completeness, duplicate off-hire cases and invoice dispute ownership.

## Exit gate

Vendor scorecards are evidence-based and explainable; off-hire and discrepancy workflows are durable, dual-controlled and integrated with vehicle lifecycle; supplied and follow-up mockups are live and verified.