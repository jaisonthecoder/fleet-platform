# DEDICATED-03 Critique Round 1 - Contract, Security and Data

| Field | Value |
|---|---|
| Date | 2026-07-26 |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH_FOR_LOCAL_FLOW` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D03-R1-01 | Blocking | `entitlement_request.vehicle_id` alone could not prevent overlapping effective allocations. | Closed by migration `0049` effective-range allocation table, active-request unique index and organization/Vehicle GIST exclusion. |
| D03-R1-02 | High | Browser could choose consent signer/allocator under legacy signatures. | Closed: both actors come only from authenticated Principal; revisions and idempotency are required. |
| D03-R1-03 | High | Production could accidentally use developer consent text. | Closed: provider returns content only for explicit test/local flags and otherwise returns null/fail closed. |
| D03-R1-04 | Medium | Consent content hash is audit payload but not a dedicated persisted column. | Carried to DEDICATED-06 hardening. |