# DEDICATED-07-02 Critique Round 1 - Contract, Security and Data

| Date | Decision |
|---|---|
| 2026-07-28 | `CLOSED_FOR_ALLOCATION_ONLY_PROOF` |

The test uses three independent `postgres()` clients, same-organization Person/Vehicle/Entitlement fixtures, FK-safe reverse cleanup, the production `entitlement_allocation` table and exact `entitlement_allocation_no_overlap` constraint. It asserts one active allocation after contention. No public API or sensitive projection is involved.

External reviewer claims that execution evidence was absent are stale: the named suite passed after the lock-order repair.