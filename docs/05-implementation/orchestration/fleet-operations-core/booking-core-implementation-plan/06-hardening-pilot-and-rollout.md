# BOOKING-06 - Hardening, Pilot and Rollout

> **Current status (2026-07-29):** `TECHNICALLY_VERIFIED_HUMAN_PRODUCTION_GATES_PENDING`. Automated security/concurrency/replay/load-floor/localization/build and governed consent evidence pass. Target-environment activation, named owners, manual NVDA, 300-user soak, 10k query-plan review and signed UAT remain mandatory.

## Objective

Prove the complete Booking journey under realistic roles, data volumes, concurrency, failures, accessibility and operational support before enabling a production pool.

## Entry Criteria

- BOOKING-01 through BOOKING-05 are functionally complete.
- No open Blocking/High finding exists without explicit risk acceptance and owner.
- Pilot pool, support owner, rollback owner and UAT actors are named in the release record.

## Verification Matrix

### Security and privacy

- Cross-organization/sibling-scope IDOR and query isolation.
- Actor/requester/beneficiary/driver spoofing and consent impersonation.
- Self-approval, invalid delegation and `SystemAdmin` operational denial.
- Employee/Fleet/Approver field masking and sensitive-read audit.
- Rate/abuse limits for availability, people search and command retries.

### Concurrency and correctness

- 1,000 overlapping consent/reservation attempts: exactly one commits; all others receive stable conflict.
- Duplicate create/consent/submit/decision/modify/extend/cancel/handover/return requests replay one result.
- Modify versus decision, cancel versus decision, and Handover versus cancel races have one legal winner.
- Injected audit/outbox/workflow/storage failures leave no orphan domain state.

### Performance

- Availability/create p95 below 2 seconds and p99 below 4 seconds at the approved 300-user reference load, excluding declared external outage.
- Booking list/inbox p95 target and data volume are recorded before execution; use at least 10k Bookings in the reference dataset.
- Query plans confirm organization/person/status/window/cursor and worklist indexes.
- API event loop remains responsive during outbox/notification bursts.

### Accessibility and localization

- Zero serious/critical axe findings.
- Keyboard flow, focus movement/restoration and live-region announcements.
- Manual NVDA + Chrome on Windows for search, consent, approval, My Bookings and Return.
- EN/AR/RTL at 320, 768, 1024 and 1440 with long text and no overlap/page overflow.

### Resilience and operations

- Redis, PDP, DB saturation, outbox worker, notification and storage failure injection.
- Fail-safe behavior and retry/reconciliation runbooks.
- Metrics for availability, Draft, consent, conflict, submission, approval SLA, cancellation, extension, handover and completion.
- Alerts avoid person/Vehicle identifiers as metric labels.
- One correlation ID links HTTP request, command ledger, decision provenance, Booking event, audit and outbox evidence without exposing it as a high-cardinality metric label.
- Audit-chain verification, DLQ/replay and reconciliation procedures pass.

## Pilot Sequence

1. Read-only availability observation in one approved pool.
2. Employee self-booking pilot with support monitoring.
3. Approval and Fleet preparation for the same pool.
4. My Bookings and change actions.
5. Handover/return and completion.
6. On-behalf Booking only after `G-0006`/`G-0007` and scope UAT pass.
7. Scope-by-scope rollout; advanced B5 features remain separate.

## UAT Scripts

- Employee: search, no availability, consent, conflict, confirmation, My Bookings, modify/re-consent, cancel and extension.
- Fleet Manager: on-behalf where enabled, preparation, Handover and Return.
- Approver/delegate: approve, request changes, decline, expired delegation and self-approval denial.
- Support/Audit: correlation lookup, event/audit trail, reconciliation, retry and rollback.

## Rollback

Disable new writes by capability, keep read/history available, preserve committed reservations and pinned workflows, stop only affected schedulers/consumers, and replay idempotent outbox events after recovery. Production rollback never restores mock success.

## Exit Gate

UAT, security, load, failure, accessibility, audit, observability, support and rollback evidence are linked in `EVIDENCE-REGISTER.md`; independent critique has no unresolved Blocking/High findings; pilot owner approves expansion.
