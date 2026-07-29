# DEDICATED-07 Final Closure Critique

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_NO_UNRESOLVED_BLOCKING_OR_HIGH` |

| Severity | Finding | Remediation and evidence |
|---|---|---|
| High | Whole-organization Entitlement inventory could omit an explicit organization predicate when no hierarchy scope resolved. | Repository now requires `organizationId` and applies it to status, category and BSD aggregates. Dashboard service binds it from the Principal. |
| High | Lifecycle return locked Vehicle before terminalizing BSD windows, while the worker locked BSD before Vehicle, leaving a possible deadlock order. | Both paths now use Entitlement then BSD then Vehicle. The independent return-vs-BSD barrier and normal lifecycle suite pass. |
| Medium | Reconciliation joins relied on request identifiers without explicit organization equality. | Allocation/BSD joins and anti-joins now require matching organization IDs. |
| Medium | A multi-join metrics query could multiply counts. | Replaced with independent organization-scoped scalar aggregates. |

Final evidence after remediation:

- PostgreSQL: 3 suites, 14/14 tests.
- Backend typecheck and lint pass.
- Frontend: 23 files, 107/107 tests; typecheck and production build pass.
- Documentation whitespace and link validation pass; only existing Windows line-ending warnings remain.