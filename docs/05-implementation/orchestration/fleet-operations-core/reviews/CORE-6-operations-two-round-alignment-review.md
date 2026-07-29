# CORE-6 Operations - Two-Round Backend/Frontend Alignment Review

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_NO_UNRESOLVED_BLOCKING_OR_HIGH` |

## Round 1 - Dedicated Workbench Contract and UX

| Severity | Finding | Remediation | Evidence |
|---|---|---|---|
| High | Local BSD date conversion could throw before the mutation error state, and end-before-start was not rejected client-side. | Added finite-date and end-after-start validation before ISO conversion. | Fleet workbench 6/6. |
| Medium | Propose/confirm success did not refresh the persisted BSD query; mutation errors had no consolidated recovery message. | All successful BSD mutations now invalidate the persisted schedule; failures render localized recovery guidance. | Focused page test/typecheck. |
| Medium | Arabic displayed raw English BSD status tokens. | Tightened the frontend status schema and localized all six statuses in EN/AR. | Arabic status test and live RTL inspection. |
| Not a gap | Allocation organization/scope and preview freshness were questioned by read-only review. | Current source already uses organization-bound reads, scope authorization, transaction-bound final qualification and 15-minute preview revalidation. No change made. | Entitlement/concurrency PostgreSQL suites. |

## Round 2 - Operations, Tenancy and Privacy

| Severity | Finding | Remediation | Evidence |
|---|---|---|---|
| High | Root-scoped dashboard queries interpreted `null` Vehicle IDs as every organization. | Root scope now resolves an explicit Principal-organization Vehicle ID list; access-block counts require organization. | Dashboard PostgreSQL 6/6 and static gates. |
| High | Operations overview was authenticated but not role-restricted and exposed Vehicle-level attention/upcoming rows to Executive/Audit/Admin/Approver/Delegate. | Added route roles. Only Fleet roles receive detail arrays; other authorized roles receive aggregates, Dedicated inventory and their narrower reconciliation view. | HTTP: unauthenticated 401, Employee 403, Fleet 200; Executive detail arrays empty. |
| Medium | Backend returned English attention/scope prose, leaking untranslated strings into Arabic. | Contract now returns stable attention facts; React localizes titles, severity, dates, scope and status. | Live Arabic has no `Scoped view` leak; `dir=rtl`. |
| Medium | `/operations` was a placeholder and D07 reconciliation/inventory had no frontend consumer. | Added typed live Operations page, role-gated inventory/reconciliation, complete summary/availability/attention/upcoming projections, and synchronized navigation. | Frontend 23 files/112 tests, typecheck/build. |
| Medium | SystemAdmin/InternalAudit operations capability was not discoverable in navigation. | Added read-only Operations navigation without exposing Fleet mutation modules. | Nav and App role tests. |

## Final Evidence

- Backend PostgreSQL/concurrency: 3 suites, 15/15 tests.
- Backend HTTP: 6/6; unauthenticated 401, Employee 403, Fleet 200.
- Backend typecheck, lint and build pass.
- Frontend: 23 files, 112/112 tests; typecheck and production build pass.
- Live API health: `ok` on port `3003`.
- Live Fleet operations: English and Arabic/RTL; no horizontal overflow at 320px (`320/320`) or desktop (`1334/1334`).
- Production Legal consent, named human owners, signed UAT/pilot and D16 remain external gates and were not claimed closed.