# DEDICATED-06 Critique Round 2 - Resilience, Concurrency and Operations

| Date | Decision |
|---|---|
| 2026-07-26 | `CLOSED_NO_AUTOMATED_BLOCKING_OR_HIGH` |

Repaired findings: workflow/domain transaction split, partial approver route resolution, allocation qualification outside transaction, Booking reservation race, orphan workflow on cancellation, unconditional Pool restoration, BSD deadline crossing, allocated-worklist reachability, and Confirmed BSD windows missed during worker downtime.

Evidence: 84/84 focused backend; Dedicated PostgreSQL 5/5; Booking PostgreSQL 17/17; GIST allocation/BSD constraints; row/advisory locks; command replay; clock-controlled BSD activation/restoration. Residual Medium: explicit independent-connection allocation contention/load/SLO alert evidence remains for pilot operations.