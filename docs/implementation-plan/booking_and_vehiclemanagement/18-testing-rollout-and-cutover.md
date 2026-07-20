# Phase 18 (Q1) — Testing, Migration, Rollout and Cutover

## Objective

Prove the complete program under realistic data, roles, scopes, concurrency, load, failures and accessibility before replacing mock/manual/legacy journeys.

## Mockup/evidence gate

All phase mockups approved and implementation screenshots captured at required desktop/tablet/mobile, light/dark, EN/AR states. Visual differences have decision records.

## Tests and evidence — pyramid

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

Automated axe-core/Playwright accessibility checks on every production route. Manual NVDA+Chrome on Windows for primary booking, approval, vendor/vehicle wizard, dedicated and handover journeys; VoiceOver where a supported macOS device exists. Test Tab/Shift+Tab, Escape, Enter/Space, component arrow/Home/End behavior, overlays, focus restore, live regions and 320/768/1024/1440 viewports. Exit requires zero serious/critical axe findings and signed manual checklist.

### Performance/resilience

Booking/PDP latency, 30+ concurrent booking no-double-book, registry paging, hierarchy/metrics scale, bulk import, notification storms, Redis/DB/adapter degradation, event-loop lag, recovery and load floor.

Initial measurable targets (confirmed against NFR/hardware before execution):

- Booking availability/create p95 <2s, p99 <4s at 300 concurrent users excluding external outage; selector/PDP within approved budget.
- 1,000 overlapping booking attempts: exactly one commits; all others stable conflict; no orphan consent/audit/outbox.
- Vehicle/vendor registry with 10k records: filtered page p95 <500ms on reference data set.
- 2,000-row import parse/validation within 30s in worker path; API event-loop unaffected.
- Notification 100-event burst accepted to outbox immediately and processed within defined channel SLA; duplicates suppressed.
- Redis unavailable degrades to DB/last-known-safe according to policy; DB unavailable fails commands safely; adapter/OCR/telematics outages do not block unrelated API threads.

SRE owns load harness, performance dashboard and regression threshold (>10% p95 increase requires review). QA owns workload correctness. Failure injection covers Redis, DB connection saturation, I2/I3 timeout, OCR lag, Blob failure, outbox worker and stale telemetry.

## Data migration

- Vendor deduplication/merge and source-key reconciliation before leased vehicle migration.
- Lease contract version/vehicle coverage import with overlap and currency/date validation.
- Unresolved vendor/contract references quarantine affected vehicle rows; never create placeholder active vendors silently.

Approved fleet source mapping, validation/dedup/steward sign-off, legacy booking/pool data, entitlement evidence, documents/leases, drivers/scopes, reconciliation reports and rollback snapshots. Mock/sample data cannot leak into production.

Vendor dedup playbook: candidate by exact TRN/external ID and reviewed fuzzy legal-name/emirate match; quarantine; Data Steward approval; migrate contract/portal/vehicle references to survivor; archive duplicate with `mergedIntoVendorId`; reconcile source keys; append immutable merge evidence. Never auto-merge on fuzzy match alone.

Seed scripts refuse production (`NODE_ENV`/database allowlist), CI permits them only on disposable/test databases, and deployment separates seed credentials. Pre-cutover scan rejects known test prefixes/domains/UUIDs and produces signed report.

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

Rollback rehearsal includes in-flight workflows and additive schema compatibility: old code can read new rows or enters read-only compatibility mode; pinned approvals finish under their definition; writes unsupported by old version are disabled; outbox consumers remain idempotent; active bookings/allocations remain valid and recoverable. Evidence records exact feature flags/selectors/deployment commands and recovery owner.

## UAT and evidence registry

One signed script per actor/phase with requirement, mockup version, test data, steps, expected reasons/states, screenshots, defects and approval:

- Employee: self booking, consent, My Bookings, dedicated request, handover/return.
- Fleet Manager: on-behalf booking, prep/mediation, vehicle lifecycle, allocation, handover.
- Approver/Delegate/Fleet Lead/CEO: every route, delegation and SoD denial.
- Procurement/Finance/Data Steward: vendor/contract/import/discrepancy/off-hire.
- Driver/Professional Driver (where phase-enabled), HR, Insurance, HSE, Audit, Executive and Support.

UAT entry: environment/data/integrations/mockups stable; no open Sev1/2; scripts linked. Exit: all critical journeys pass, accepted defects/risk owners recorded and business actor signs off.

## Go-live gates

Data ≥ approved completeness target; no Sev1/2; security acceptance; UAT by each actor; load/failure gates; audit chain; runbooks/on-call; support training; privacy/Legal consent; business decisions closed; rollback rehearsal.

## Mandatory critique

Independent review of omissions, unsafe assumptions, blast radius, in-flight state, data repair, observability, accessibility and support. Fix critical/high before release.

## Exit gate

Production cutover is approved only when every row in Phase 19 is closed with evidence and named owner.
