# Phase 17 (X1) — Integrations, Notifications, Operations and Reporting

## Objective

Connect the completed Vehicle/Booking/Entitlement/Handover journeys to reliable integrations, operations views, notifications and auditable reporting.

## Mandatory mockup gate — ask before implementation

Request: operations dashboard/table/map; Fleet Manager queues; notifications centre/preferences; compliance alerts; vehicle/booking/entitlement reports; export states; integration health/degraded states; executive drill-down where in approved scope.

## Integrations

- I3 Procurement Vendor/Contract source adapter: signed schema, source authority, inbound/outbound ownership, replay, freshness and manual fallback.
- I2 Finance AP: immutable supplier invoice references/lines, contract reconciliation and variance ownership.
- Vendor Portal: vendor-scoped acknowledgement, document upload and dispute only; no cross-vendor access.
- OCR worker: vendor/lease/compliance documents parsed asynchronously as proposals with confidence and human confirmation.

Entra identity, Oracle/HCM people/manager/grade/leave, email/push/SMS, Blob evidence, maps/routes, telematics SimulatorSource then real adapters, finance/vendor where approved. Adapter ownership, retry/idempotency, timeout, DLQ, replay, freshness and runbooks.

## Notifications

Transactional outbox-driven notifications for booking consent/submission/decision/change/cancel/waitlist, handover/return, dedicated workflow/allocation/BSD, compliance, maintenance and transfer. User preferences cannot suppress mandatory safety/legal notifications.

## Operations

Scoped preparation/handover/return queues; attention items; vehicle state/map with freshness; pool load/utilization; waitlist; overdue returns; compliance/maintenance; entitlement inventory. Same vehicle inspector contract as V2.

## Reporting

- Vendor scorecard completeness and version.
- Lease expiry pipeline and action-before-expiry KPI.
- Off-hire duration/penalties/disputes.
- Contract-vs-invoice variance aging and resolution.

Booking utilization/reserved-wasted, approval SLA, no-shows/late, vehicle downtime/compliance, dedicated allocation/utilization/BSD, transfers, consent coverage, actor/on-behalf activity, audit exceptions and data completeness. Cost visibility role-masked.

## Audit/support

Tamper-evident checks, correlation search, decision/workflow provenance, export limits, retention/deletion evidence, support KB and operational dashboards/alerts.

## Tests

Adapter contract/replay, duplicate events, stale sources, notification once, mandatory alerts, dashboard scope, report definitions, masking, load/export, failure injection and runbooks.

## Rollback

Disable adapters/notifications independently; retain outbox for replay. Operations degrade to DB state with explicit freshness. Reports remain read-only.

## Mandatory critique

Check duplicate/missing notifications, stale map, cross-scope reports, PII/cost leakage, unbounded exports, source freshness, DLQ ownership and alert fatigue.

## Exit gate

Completed journeys are operationally visible, notified, reportable and supportable under normal and degraded integration conditions.
