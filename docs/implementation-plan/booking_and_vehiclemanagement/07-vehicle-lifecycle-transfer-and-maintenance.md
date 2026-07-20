# Phase 7 (V3) — Vehicle Lifecycle, Transfer, Maintenance and Pool Control

## Objective

Complete all operational state transitions and cross-node movements that determine whether and where a vehicle can be booked.

## Mandatory mockup gate — ask before implementation

Request: lifecycle transition dialogs; include/exclude booking pool; transfer impact/approval/history; maintenance scheduling/current work; off-hire/sold/decommissioned; lease replacement continuity; blocked/conflict states; responsive/RTL.

## Lifecycle

Active, In Use, Under Maintenance, Off-Hire Pending, Decommissioned, Sold, Transferred, plus approved operational sub-statuses. Define allowed transition graph, required evidence/reasons and role permissions. Historical records remain immutable.

## Booking-pool control

Explicit include/exclude command, independent of history. Structural exclusions for equipment/shuttle buses and non-active states. Compliance/maintenance hard blocks override inclusion. Re-inclusion revalidates all gates.

## Transfer

From/to organization scope, effective time, approver, reason and impact preview. Expire prior assignment and open new assignment atomically. Preserve booking/entitlement/history; block or coordinate active bookings, dedicated allocation, maintenance, keys, tracker and policy bindings. Cross-cluster transfers require appropriate Fleet Lead authority.

- Block transfer during Active/InUse booking/handover, conflicting maintenance/off-hire, active dedicated allocation or unresolved issued keys.
- Approved future and PendingApproval bookings require explicit migrate/cancel resolution; Completed history never blocks and never changes scope.
- Cross-cluster transfer requires source and destination Fleet Lead approval; no self-approval.
- Scope/organization attribution is pinned at event/handover time. Later transfer never rewrites historical booking/policy/cost evidence.
- Destination policies apply only to future decisions; existing provenance remains immutable.

## Maintenance/off-hire

Schedule maintenance, downtime, vendor/work reference, costs and status; physical workshop execution remains external. Maintenance excludes availability. Off-hire captures lease terms, documents, return condition and replacement linkage.

Maintenance effective windows cannot overlap illegally. Scheduling locks/checks booking, allocation and handover windows; conflicts identify the blocking record/window. Planned/corrective/force-majeure classification feeds versioned vendor scorecards.

## Database

Transition/history, effective assignments, transfer record, maintenance work/schedule/cost, booking-pool change evidence, replacement linkage and constraints/indexes.

## Backend/API

Impact-preview plus revision/idempotency commands; role/scope/SoD; atomic state/history/audit/outbox; current state read model; conflict reasons naming active dependencies; notification integration.

## Frontend

Role-gated actions from list/detail, impact summaries, confirmation, transfer target picker, maintenance timeline, lifecycle history/diff and clear recovery actions.

## Tests

Transition property/model tests; invalid transitions; concurrent transfer/booking; maintenance vs booking; cross-scope; active entitlement; replacement; rollback; effective-time boundaries; audit/outbox; UI states/RTL.

## Rollback

Rollback creates compensating lifecycle/transfer events where valid; never delete history. Feature flag disables commands while preserving reads.

## Mandatory critique

Check orphan bookings/assignments, transfer races, stale availability caches, lease evidence, unauthorized targets, backdated transitions and history rewriting.

## Exit gate

Vehicle availability and hierarchy ownership are always derived from valid current lifecycle/assignment state, with complete transfer/maintenance evidence.
