# DEDICATED-07-02 Critique Round 2 - Behavior and Concurrency

| Date | Decision |
|---|---|
| 2026-07-28 | `VERIFIED` |

| Finding | Disposition |
|---|---|
| Raw simultaneous exclusion inserts produced PostgreSQL `40P01`. | Confirmed and repaired in the production-fidelity test by acquiring the shared Vehicle row first, matching `EntitlementService.allocate`. |
| One Vehicle/range, two independent sessions. | Verified: one commit, one `23P01 entitlement_allocation_no_overlap`, one active allocation. |
| Booking reservation versus Dedicated allocation. | Independent sessions prove the waiting allocation rechecks after the Booking transaction commits and rejects the now-unqualified Vehicle. |
| Return versus BSD activation/restoration. | Independent sessions exposed and repaired an orphan-window/deadlock risk. Worker and lifecycle now lock Entitlement then BSD then Vehicle; return/expiry terminalizes open BSD windows before allocation closure. |
| Replay/orphan/failure injection. | Existing command and transaction tests reduce risk; explicit allocation failure injection remains D07-03/reconciliation scope. |