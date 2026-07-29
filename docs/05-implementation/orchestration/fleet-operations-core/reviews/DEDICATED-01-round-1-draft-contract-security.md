# DEDICATED-01 Critique Round 1 - Contract, Security and Data

| Field | Value |
|---|---|
| Date | 2026-07-25 |
| Scope | Configured eligibility preview, opaque evidence and revision-safe owner Draft |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D01-R1-01 | High | Dormant unscoped Entitlement list could become an authorization hazard. | Closed: unscoped repository/service list methods removed; only owner-scoped list remains. |
| D01-R1-02 | Medium | Concurrent same-key PATCH lacked PostgreSQL evidence. | Closed: concurrent test proves one revision, one command-ledger row and one rejected contender. |
| D01-R1-03 | Medium | Material edits must invalidate stale eligibility/preference evidence. | Closed: PATCH clears `preferredVehicleId`, eligibility result, policy version and route provenance while preserving/updating preference note. |
| D01-R1-04 | High | Browser-supplied eligibility and preferred Vehicle could be forged without server evidence. | Closed: short-lived evidence is organization/requester scoped and binds request fingerprint, policy IDs, permitted classes and eligible Vehicle IDs; Draft writes require matching `ALLOW` evidence. |
| D01-R1-05 | Medium | Reviewer reported a duplicate `0047` migration filename. | Not reproduced: repository contains one registered `0047` and one registered `0048`; migration forward/idempotent verification passes. |

Principal, organization, owner, scope, revision and idempotency checks were independently re-reviewed with no remaining Blocking/High finding.