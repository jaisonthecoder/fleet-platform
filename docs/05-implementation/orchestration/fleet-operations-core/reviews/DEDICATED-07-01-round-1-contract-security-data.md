# DEDICATED-07-01 Critique Round 1 - Contract, Security and Data

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_NO_BLOCKING_OR_HIGH` |

| Finding | Disposition |
|---|---|
| External reviewer reported the Fleet persisted schedule UI missing. | Rejected as stale: current page calls `GET /entitlements/:id/bsd-windows`, restores open status after reload, suppresses duplicate proposal, and passes focused tests/build. |
| Cancellation authority must remain Fleet/scope bound. | Verified: `@Roles` plus Principal organization and hierarchy scope checks; no client actor field. |
| Schedule projection must not disclose leave/Booking-person data. | Verified: bounded window DTO contains request/Vehicle IDs, bounds, status, operational reason and lifecycle timestamps only. Conflict UI explicitly avoids employee/Booking details. |

No database migration was required; migration `0051` remains the structural authority for overlap and active-allocation containment.