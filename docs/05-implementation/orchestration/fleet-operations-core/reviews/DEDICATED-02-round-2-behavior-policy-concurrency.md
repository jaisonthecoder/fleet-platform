# DEDICATED-02 Critique Round 2 - Behavior, Policy and Concurrency

| Field | Value |
|---|---|
| Date | 2026-07-26 |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D02-R2-01 | High | Approval fallback checked legacy `requestType=permanent`, unreachable by `LongTerm|Temporary`. | Closed with current vocabulary and PostgreSQL route proof. |
| D02-R2-02 | High | Submit lacked stable replay and row/revision locking. | Closed with command claim, row lock, expected revision, matching eligibility evidence and stable result replay. |
| D02-R2-03 | High | Decisions lacked atomic workflow/domain version checks. | Closed through shared `decideInTransaction`, expected step version, Entitlement revision and one transaction. |
| D02-R2-04 | High | Modification could erase route history or leave no valid resubmission cycle. | Closed with `ModificationRequested`, immutable history/current provenance and owner-edit transition to fresh Draft/eligibility/workflow cycle. |
| D02-R2-05 | Residual | Entitlement-specific failure injection after audit/outbox is not yet explicit. | Carried to DEDICATED-06; shared transaction behavior and Booking failure injection reduce but do not remove residual risk. |