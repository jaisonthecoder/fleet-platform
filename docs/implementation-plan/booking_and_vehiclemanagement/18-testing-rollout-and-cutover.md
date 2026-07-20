# Phase 18 (Q1) — Testing, Migration, Rollout and Cutover

## Objective

Prove the complete program under realistic data, roles, scopes, concurrency, load, failures and accessibility before replacing mock/manual/legacy journeys.

## Mockup/evidence gate

All phase mockups approved and implementation screenshots captured at required desktop/tablet/mobile, light/dark, EN/AR states. Visual differences have decision records.

## Test pyramid

### Unit/property/model

Vehicle and booking state machines; hierarchy/scope; policy typed values; consent materiality; recurring/waitlist fairness; lifecycle transitions; entitlement allocation/BSD; handover reconciliation; reason codes.

### Integration

- I2/I3 adapter contract, replay/idempotency, stale source, source outage and conflict precedence.
- Vendor Portal tenant/vendor isolation and expiry/revocation.
- OCR proposal/human confirmation; raw document retention and redaction.

Fresh DB and real Postgres/Redis/Blob emulator as applicable; every API transaction; compound organization FKs; effective constraints; audit/outbox; adapter modes; integration retries.

### Contract

Backend/frontend Zod/OpenAPI drift; events; external adapters; reason catalog; lookup dependencies.

### E2E/browser

Every actor’s happy/blocked/error journey using real backend: Vehicle onboarding/list/detail/transfer; Employee self-book; Fleet Manager on-behalf; consent/approval; My Bookings; waitlist; dedicated request/approval/allocation/BSD; handover/return; operations.

### Security

- Procurement/Finance/Fleet masking and SoD; creator cannot approve own vendor/contract.
- Cross-org vendor/contract/vehicle rejection; portal cannot access another vendor.
- Bank/tax/contact/document privacy and audit-log redaction.

Cross-org/scope; IDOR; actor/requester/driver spoofing; self-approval; SystemAdmin operational prohibition; file upload; consent integrity; cost/PII masking; rate/abuse; audit.

### Accessibility/i18n

WCAG AA, keyboard, screen reader, focus restoration, status not color-only, 44px targets, EN/AR/RTL, long labels, print/export.

### Performance/resilience

Booking/PDP latency, 30+ concurrent booking no-double-book, registry paging, hierarchy/metrics scale, bulk import, notification storms, Redis/DB/adapter degradation, event-loop lag, recovery and load floor.

## Data migration

- Vendor deduplication/merge and source-key reconciliation before leased vehicle migration.
- Lease contract version/vehicle coverage import with overlap and currency/date validation.
- Unresolved vendor/contract references quarantine affected vehicle rows; never create placeholder active vendors silently.

Approved fleet source mapping, validation/dedup/steward sign-off, legacy booking/pool data, entitlement evidence, documents/leases, drivers/scopes, reconciliation reports and rollback snapshots. Mock/sample data cannot leak into production.

## Rollout sequence

1. Manual Vendor Master and approval behind capability flag.
2. Read-only I3 comparison/reconciliation.
3. Lease contract import and renewal alerts.
4. I2 invoice discrepancy shadow/read-only.
5. Off-hire canary on approved vendor/contract.
6. Vendor portal after security acceptance.

1. Read-only Vehicle registry against reconciled data.
2. Controlled onboarding/import.
3. Vehicle lifecycle/compliance/telematics/custody.
4. Booking employee pilot in one pool.
5. Fleet Manager on-behalf and approval/operations.
6. My Bookings and handover/return.
7. Dedicated entitlement pilot.
8. Advanced booking features independently.
9. Group rollout by scope.

Use shadow/canary selectors for policy decisions, feature flags for UI/commands and deterministic cohorts. In-flight workflows stay pinned.

## Rollback

Per-feature rollback matrix: disable writes, selector legacy-only, stop schedulers, preserve evidence, replay outbox, restore read paths, never rewrite committed booking/allocation ranges. Rehearse before go-live.

## Go-live gates

Data ≥ approved completeness target; no Sev1/2; security acceptance; UAT by each actor; load/failure gates; audit chain; runbooks/on-call; support training; privacy/Legal consent; business decisions closed; rollback rehearsal.

## Mandatory critique

Independent review of omissions, unsafe assumptions, blast radius, in-flight state, data repair, observability, accessibility and support. Fix critical/high before release.

## Exit gate

Production cutover is approved only when every row in Phase 99 is closed with evidence and named owner.
