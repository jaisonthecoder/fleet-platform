# DEDICATED-05 Critique Round 1 - Contract, Security and Data

| Date | Decision |
|---|---|
| 2026-07-26 | `CLOSED_NO_BLOCKING_OR_HIGH_FOR_MANUAL_SOURCE` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D05-R1-01 | Blocking | Existing BSD row had no organization/confirmer/state evidence or structural overlap rule. | Closed by migration `0051`. |
| D05-R1-02 | High | Window could fall outside active allocation. | Closed by database trigger requiring matching active allocation/Vehicle and containment. |
| D05-R1-03 | High | Requester could theoretically expose a Vehicle under legacy actor string. | Closed with Fleet Principal/scope binding and separate confirmation. |
| D05-R1-04 | Privacy | HR leave details could leak into Booking. | Closed: manual command stores operational reason; Booking checks only Vehicle/window and exposes no person/reason. |