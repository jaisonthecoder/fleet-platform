# DEDICATED-01 Critique Round 2 - Behavior, Policy and Concurrency

| Field | Value |
|---|---|
| Date | 2026-07-25 |
| Scope | Manual D3/D8 policy, preview expiry/fingerprint, safe options, replay and stale conflict |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D01-R2-01 | Medium | Revision conflicts used a generic save error. | Closed: EN/AR conflict guidance, refresh action and edit preservation are tested. |
| D01-R2-02 | Medium | Users were not told that edits invalidate eligibility. | Closed: successful updates state that eligibility must run again after policy approval. |
| D01-R2-03 | Medium | Parallel PATCH behavior needed executable proof. | Closed: PostgreSQL exactly-one revision/ledger test and stale-command rollback pass. |
| D01-R2-04 | High | D3/D8 were treated as external blockers instead of application configuration. | Closed: existing Reference Data and Policy Studio provide manual alternatives; external HCM/policy adapters are optional. |
| D01-R2-05 | High | Vehicle documents were checked only against today, allowing options whose registration or insurance expired during the requested period. | Closed: safe-option SQL requires both documents through the request end; PostgreSQL 5/5 passes. |
| D01-R2-06 | Residual | Preview availability creates no hold and may change after evaluation. | Accepted by contract: preference remains non-binding; DEDICATED-03 must requalify and atomically enforce exclusivity at allocation. |

Independent closure review found no remaining Blocking/High behavior or concurrency finding.