# Phase 3 (S2) — Lease Contracts, Renewals and Invoice Reconciliation

## Objective

Deliver the Lease Contracts tab and contract lifecycle shown in the mockups: contract master, covered vehicles, monthly spend, renewal ladder, expiry alerts, commercial terms and contract-vs-invoice discrepancy evidence.

## Dependencies

- Phase 2 Active Vendor Master.
- D6/I3 and I2 integration contracts approved or explicit manual-adapter mode.
- Vehicle references may be linked after Phase 5 onboarding; contract drafts may exist first.

## Mandatory mockup gate — supplied and missing

Supplied: Lease Contracts tab with KPI cards, contract table, expiry/renewal ladder and off-hire/penalty summary.

Request before implementation: contract create/edit/detail wizard, vehicle coverage management, renewal decision, contract version/diff, discrepancy detail/resolution, I2/I3 stale/error states, currency/date edge cases, approval states, EN/AR/mobile.

## Source of truth

| Data | Source |
| --- | --- |
| Contract reference, vendor, PO/reference, contracted vehicle count, dates and commercial terms | Oracle Procurement I3 where authoritative; otherwise Procurement-entered with evidence |
| Monthly cost/currency, off-hire notice, early penalty, escalation/replacement/renewal clauses | Approved contract version in platform/I3 |
| Covered vehicle links | Platform assignments validated against contract/vendor/organization |
| Invoice amount/lines/payment status | Finance AP I2 inbound, immutable source line references |
| Contract-vs-invoice variance | Platform-computed from normalized contract schedule and I2 lines |
| Renewal ladder/status | Platform scheduler using versioned configured ladder, default 90/60/30 |

## Lifecycle

Contract: `Draft -> PendingApproval -> Active -> RenewalReview -> Renewed | OffHireInProgress | Expired -> Closed`.

Every amendment creates a new immutable contract version; never overwrite terms used by past invoices/off-hire cases.

## Database

- `lease_contract`: organization, vendor, stable ref, source/PO refs, status, active version, revision.
- `lease_contract_version`: effective dates, currency, monthly cost, notice days, penalty structure, renewal/escalation/replacement clauses, vehicle count, approved by/at.
- `lease_contract_vehicle`: effective-dated contract-to-vehicle link with status and `lease_ended_at_utc`; one active lease contract per leased vehicle. Closure preserves history and names the off-hire/expiry/amendment event.
- `lease_renewal_action`: ladder event, owner, due/status/decision/evidence.
- `supplier_invoice_header/line_ref`: source IDs and normalized amounts only as required; source remains I2.
- `contract_invoice_variance`: contract/version/invoice refs, expected/actual/variance, category, ownership and resolution status; store contract/invoice currency, variance currency, exchange rate used, FX source/date, creator, resolver, resolution rationale and evidence.
- append-only contract/variance events.

Constraints: organization/vendor/vehicle consistency; no overlapping active vehicle contract; date/currency/amount validity; active contract must use Active lessor; immutable approved versions.

## Backend/API

Lease module APIs for list/KPIs/detail/version creation/submit/approve/activate, vehicle link/unlink, renewal action/decision, AP invoice ingest/replay and variance list/detail/resolve. Scheduler creates 90/60/30 work idempotently; Procurement + scoped Fleet Manager receive alerts.

Variance resolution uses a bounded workflow/PDP SoD rule:

- Resolver cannot be variance creator, invoice importer or sole contract approver.
- Procurement validates contracted terms; Finance validates invoice/payment treatment.
- High-value/material variances require both roles or an approved threshold-based route.
- Rationale and evidence are mandatory; accept/write-off/credit/rebill outcomes are stable codes.
- FX conversion uses a recorded rate/source/date; never compare unlike currencies directly.
- Every transition is append-only, audited and idempotent.

## Frontend

- Lease Contracts tab matches mockup KPIs/table and provides filters/expiry states.
- Contract inspector with terms, covered vehicles, immutable versions/diff and renewal actions.
- Contract wizard (after mockups) reuses vendor selection from Phase 2.
- Discrepancy queue/detail shows contract vs invoice evidence; no raw bank/payment information.

## Security and masking

Procurement sees vendor/lease commercial data; Finance sees AP details; Executive sees aggregate only; Fleet Manager sees contracts covering managed vehicles and operational terms; Employee/Driver no access. Internal Audit read-only.

## Tests

Contract version immutability, overlapping vehicle links, multi-currency arithmetic/rounding, expiry boundaries/timezone, scheduler idempotency, source replay, variance matching/partial invoices/credits, cross-org and role masking, concurrent renewal, audit/outbox, load/query plans, EN/AR/browser.

Include resolver-vs-creator SoD, Procurement/Finance dual decision, FX source/date replay, contract/invoice currency mismatch, vehicle-link closure via off-hire and amendment after an in-flight off-hire version lock.

## Rollback

Disable I2/I3 ingest and contract writes; retain last-known-good contracts and pending renewal work. Never remove contract versions or recalculate already-resolved variances.

## Mandatory critique

Look for silent renewals, mutable terms, vehicle double-contracting, wrong currency/period arithmetic, duplicate invoice ingest, alert storms, source staleness, Finance/Procurement leakage and untraceable overrides.

## Exit gate

All leased vehicles can reference one valid active contract; renewal and discrepancy evidence is complete; no silent renewal; mockup list/KPIs and approved detail workflows are live and tested.