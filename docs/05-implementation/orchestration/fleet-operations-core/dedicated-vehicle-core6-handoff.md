# Dedicated Vehicle CORE-6 Handoff

## Stable Read Models

| Consumer | Endpoint | Contract and constraints |
|---|---|---|
| Fleet/Executive/Audit/Admin | `GET /api/v1/dashboards/entitlement-inventory?scopeId=` | Scope-authorized aggregate lifecycle counts, Active/Conflict BSD counts and allocated justification categories. No Person labels, notes, consent or Vehicle details. |
| SystemAdmin/InternalAudit | `GET /api/v1/entitlements/reconciliation?limit=` | Organization-bound metrics and up to 500 opaque inconsistency findings. Read-only; stable reason codes and recommended owner; no automated repair. |
| Fleet | `GET /api/v1/entitlements/allocation-worklist` | Scoped consented requests and qualified Vehicles for operational allocation. Not a reporting API. |
| Employee/Fleet | `GET /api/v1/entitlements/:id/bsd-windows` | Persisted privacy-safe schedule for an authorized request. No HR leave source or medical/private reason model. |

Dashboard/report modules must consume these projections and must not update Entitlement, Workflow, allocation, Vehicle or BSD state.

## Role and Privacy Matrix

| Role | Inventory | Reconciliation | Operational mutation | Privacy boundary |
|---|---|---|---|---|
| FleetManager/ClusterFleetLead/GroupFleetLead | Scoped | No | Scoped Fleet commands | May see operational request/Vehicle details only where the owning endpoint authorizes scope. |
| Executive | Scoped aggregate | No | No | Aggregate only; no Person, note, consent, preference or Vehicle-level finding details. |
| InternalAudit | Scoped aggregate | Organization findings | No | Opaque references/reason codes; evidence accessed through governed audit tools. |
| SystemAdmin | Scoped aggregate | Organization findings | No Dedicated operational actions | Support/configuration only; cannot approve, allocate, return or expire. |
| Employee/Approver/Delegate | No dashboard inventory | No | Only their owner/assigned workflow actions | No cross-request operational reporting. |

## Transactional Event Inputs

| Event | Meaning | Safe routing input |
|---|---|---|
| `EntitlementSubmitted` | Immutable approval route started | Request/workflow references |
| `EntitlementDecided` | Approval, decline or modification decision | Request, decision and resulting status |
| `EntitlementConsentRequired` | Final approval completed; assigned driver action required | Request reference only |
| `ConsentSigned` | Governed consent version accepted | Request and version; never content/signature |
| `EntitlementAllocated` | Fleet final allocation committed | Request and Vehicle references |
| `BsdReturnDue` | Fleet-confirmed Pool return window exists | Request and window timestamps |
| `EntitlementBsdActivated` | Vehicle entered Pool for an Active BSD window | Request/window references |
| `EntitlementBsdConflict` | Activation/restoration blocked | Request/window and stable reason code |
| `EntitlementBsdRestored` | Window completed and Vehicle restored to Dedicated | Request/window references |
| `EntitlementReturned` / `EntitlementExpired` | Allocation and lifecycle closed | Request/Vehicle references |

Notification delivery must be idempotent by outbox event ID, resolve recipients at the delivery boundary, avoid Person labels in telemetry, and retain dead-letter/retry evidence. No external notification adapter is claimed by this handoff.

## Support Diagnostics

1. Capture UTC time, deployment/migration version, organization, opaque request reference and correlation ID.
2. Read Entitlement chronology, Workflow state, command ledger result, allocation/BSD state and outbox delivery state through governed support access.
3. Run reconciliation. Do not mutate records directly or replay commands with a new key until the owning service state is understood.
4. Route Fleet-owned state findings to FleetOperations and lineage/preview findings to PlatformSupport.
5. Use [Dedicated Vehicle UAT, Pilot and Rollback](../../../06-verification/dedicated-vehicle-uat-pilot-rollback.md) for pilot and rollback evidence.

## Residual Gates

- Production Legal/Privacy EN/AR consent source is not approved/provisioned.
- UAT, pilot, support, release and rollback owners remain unassigned.
- Human UAT/pilot/go-no-go evidence is not signed.
- `WithDriver` remains disabled pending D16.