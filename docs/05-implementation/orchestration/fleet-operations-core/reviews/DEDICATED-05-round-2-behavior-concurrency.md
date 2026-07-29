# DEDICATED-05 Critique Round 2 - Behavior and Concurrency

| Date | Decision |
|---|---|
| 2026-07-26 | `CLOSED_NO_BLOCKING_OR_HIGH_FOR_MANUAL_SOURCE` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D05-R2-01 | Critical | Pool Booking could extend beyond BSD return deadline. | Closed: Booking create and consent require the full range inside one Active BSD window. |
| D05-R2-02 | High | Multiple worker replicas could double-activate/restore. | Closed with advisory transaction lock, row locks and idempotent statuses. |
| D05-R2-03 | High | Restoration could override active Booking custody. | Closed: active crossing Booking moves window to Conflict and defers restoration. |
| D05-R2-04 | High | Allocated requests were absent from Fleet worklist, making BSD controls unreachable. | Closed: worklist includes AwaitingConsent and Allocated requests. |