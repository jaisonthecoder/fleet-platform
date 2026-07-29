# DEDICATED-00 Critique Round 2 - Behavior, Policy and Concurrency

| Field | Value |
|---|---|
| Date | 2026-07-25 |
| Reviewer | Independent read-only workspace review |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D00-R2-01 | High | Migration partial recovery needed confirmation. | Closed: additive objects are resumable, backfills use `WHERE IS NULL`, and forward plus second no-op migration pass. |
| D00-R2-02 | High | Draft replay concurrency was questioned. | Closed as false positive: command claim, aggregate create, audit, outbox and result completion share one transaction; replay loads the current aggregate. Unit replay and database uniqueness evidence pass. |
| D00-R2-03 | High | Legacy grade-proxy submit and unapproved consent remained executable. | Closed: submit and consent reject before policy or side effects using stable pending reason codes. |
| D00-R2-04 | High | Legacy approval, BSD and cancel paths could contradict the Draft-only phase. | Closed: all reject before side effects; allocation remains blocked by G-0010. |
| D00-R2-05 | Medium | Old integration tests asserted the unsafe complete lifecycle. | Closed: PostgreSQL tests now prove Draft persistence and fail-closed commands. |

## Closure evidence

- Entitlement unit tests: 14/14.
- PostgreSQL entitlement integration: 2/2.
- Migration harness: forward, object assertions and idempotent rerun pass.
- Contract drift, organization guard, backend typecheck and lint pass.
- Final independent behavior re-review found no unresolved Blocking/High finding.