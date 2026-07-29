# DEDICATED-07-01 Critique Round 2 - Behavior and Concurrency

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_NO_BLOCKING_OR_HIGH` |

| Finding | Disposition |
|---|---|
| Cancel can race worker activation. | Closed by the same BSD row lock: cancellation wins while Proposed/Confirmed and future, or worker wins and cancellation fails once Active. No reopening path exists. |
| Repeated cancellation must be stable. | Closed: an already Cancelled row returns its terminal projection without another event/state change. |
| Reload could allow duplicate proposal. | Closed: persisted open Proposed/Confirmed/Active/Conflict state restores into page state and suppresses proposal action. Database exclusion remains final authority. |
| Conflict refresh/privacy was unclear. | Closed with explicit refresh action and privacy-safe operational copy. |

Evidence: Entitlement controller/service 30/30; PostgreSQL 5/5 including future cancellation and persisted Completed/Cancelled schedule; Fleet workbench 4/4 and build.