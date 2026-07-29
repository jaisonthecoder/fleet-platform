# DEDICATED-03 Critique Round 2 - Behavior and Concurrency

| Field | Value |
|---|---|
| Date | 2026-07-26 |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH_FOR_LOCAL_FLOW` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D03-R2-01 | Critical | Final qualification initially used the repository base connection after locking the Vehicle. | Closed: safe-option qualification now accepts and uses the open allocation transaction executor. |
| D03-R2-02 | Critical | Booking reservation commit checked Vehicle bookability before transaction and did not lock the Vehicle, allowing a race with Dedicated allocation. | Closed: Booking locks Booking then Vehicle and rechecks bookability/overlap inside transaction; Booking PostgreSQL 17/17 and Dedicated 5/5 pass. |
| D03-R2-03 | High | UI-only preference variance could be bypassed. | Closed with backend comparison against persisted preference and DB/service-required variance. |
| D03-R2-04 | Residual | Independent-connection same-Vehicle/two-request contention is not separately measured. | Carried to DEDICATED-06; structural exclusion and row lock are present. |