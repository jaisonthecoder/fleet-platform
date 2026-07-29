# DEDICATED-04 Critique Round 1 - Contract, Security and Data

| Date | Decision |
|---|---|
| 2026-07-26 | `CLOSED_NO_BLOCKING_OR_HIGH` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D04-R1-01 | High | No immutable Entitlement chronology or renewal lineage existed. | Closed by migration `0050`, owner-safe events and explicit predecessor FK. |
| D04-R1-02 | High | UI status branching could become business authority. | Closed with server-derived capabilities on every DTO. |
| D04-R1-03 | Medium | Event projection could leak actor identities. | Closed: owner event DTO exposes event/reason/detail/time, not actor Person. |