# DEDICATED-04 Critique Round 2 - Behavior and Concurrency

| Date | Decision |
|---|---|
| 2026-07-26 | `CLOSED_NO_BLOCKING_OR_HIGH` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D04-R2-01 | High | Cancelling PendingApproval could leave a pending Workflow eligible for SLA escalation. | Closed with transaction-bound Workflow expiry under instance lock. |
| D04-R2-02 | Critical | Return/expiry could orphan active allocation or Vehicle state. | Closed: Entitlement/allocation/Vehicle lock and transition share one transaction. |
| D04-R2-03 | High | Pool restoration could ignore current compliance. | Closed: restore only Active, Vendor-healthy, currently registered/insured Vehicle; otherwise remain non-Pool. |
| D04-R2-04 | Residual | Draft renewal periods are not person-level resource holds. | Accepted: no allocation is carried; eligibility/approval/allocation re-run. Future person-entitlement overlap policy remains explicit. |