# DEDICATED-07-03 Critique - Metrics and Reconciliation

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_NO_BLOCKING_OR_HIGH` |

## Round 1 - Contract, Security and Data

- The endpoint is restricted to `SystemAdmin` and `InternalAudit`, requires a linked Principal, and binds every query to the Principal organization.
- Findings expose opaque Entitlement, Vehicle and record references only. Person names, notes, consent content and preference text are absent.
- The response is read-only and bounded to 500 findings. It has no repair command.

## Round 2 - Behavior, Concurrency and Operations

- Six stable reason codes detect allocation, Vehicle/BSD, renewal and preview-reference inconsistencies.
- Metric counters use independent organization-scoped aggregates to avoid multi-join multiplication.
- Counters without durable evidence (`eligibility-error`, `no-qualified-vehicle`, `command-conflict`, `worker-failure`) are declared unavailable instead of reported as zero.

## Round 3 - UX, Accessibility and UAT

- Stable reason codes, opaque references, one detection timestamp and recommended owner make findings support-ready without exposing employee data.
- This slice is API-first. CORE-6 may render the projection for authorized roles without duplicating detection logic.

Evidence: Entitlement PostgreSQL 6/6 and backend typecheck pass. The test proves Employee denial, one seeded inconsistency, stable references, persisted metrics and no mutation.