# DEDICATED-02 Critique Round 1 - Contract, Security and Data

| Field | Value |
|---|---|
| Date | 2026-07-26 |
| Decision | `CLOSED_NO_BLOCKING_OR_HIGH` |

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| D02-R1-01 | Blocking | Legacy Entitlement submit created Workflow outside the domain transaction. | Closed: Workflow deployment/instance/steps, Entitlement state, provenance, audit, outbox and command completion now share the Entitlement transaction. |
| D02-R1-02 | High | Approval browser input lacked revision, step-version and durable-key binding. | Closed in strict contracts, controller Principal binding, command ledger and UI clients. |
| D02-R1-03 | High | Worklist could expose broad request/HR/policy evidence. | Closed with a minimized current-step projection; no grade, consent signature, VIN, compliance or other-person facts. |
| D02-R1-04 | High | Partial route resolution could silently omit required approval authorities. | Closed: every distinct policy route role must resolve to a distinct non-requester Person or submit fails atomically. |

Independent subagents lacked current workspace access; stale/blocking reports were not accepted as evidence. Direct source review and executable tests control this closure.