# Phase 5 (V1) — Vehicle Onboarding, Acquisition and Bulk Import

## Objective

Deliver a live Fleet Manager/Data Steward onboarding journey for one or many vehicles, with scenario-dependent fields, validation, hierarchy assignment, evidence, review and activation.

## Dependencies

- Phase 2 Vendor Master for vendor selection.
- Phase 3 active Lease Contract for leased/replacement scenarios.
- Owned onboarding may proceed without a vendor; leased activation may not.

## Mandatory mockup gate — ask before implementation

Request: onboarding wizard overview; all five steps; Owned/Leased/Transfer-in/Lease-replacement variants; validation/error states; review/activate; import upload/mapping/validation/dedup/sign-off screens; desktop/tablet/mobile where relevant; EN/AR.

Do not implement UI until mockup decisions are logged against FR-INV-01/05/07/08/10/11, vendor/lease requirements and the approved design system.

## Actors and scope

- Fleet Manager: onboard within managed scope where permitted.
- Cluster/Group Fleet Lead: cross-pool/transfer scenarios.
- Data Steward: import, dedup, completeness and sign-off.
- Procurement: vendor/lease/commercial evidence where assigned.
- System Admin configures references only; cannot perform operational approvals.

## Scenarios

1. Owned — new purchase.
2. Leased — new vendor lease.
3. Transfer-in — existing vehicle/history imported from another node/entity.
4. Lease replacement — old vehicle off-hire plus replacement continuity.
5. Bulk import/migration with row validation and steward sign-off.

## UI flow

1. Acquisition scenario.
2. Identity/classification: plate, VIN/chassis, make/model/trim/year/colour, body/use category, seating, fuel/transmission/efficiency.
3. Hierarchy/operational: cluster/pool/location, assignment model, booking-pool inclusion, assigned/professional driver.
4. Ownership/lease, documents, compliance and telematics.
5. Review differences, completeness, policy-derived restrictions and activate.

Scenario cards explain required records. A step rail shows status. Fields are server-driven from approved lookup/contract metadata where practical.

## Database

Extend/verify vehicle identity, ownership, lease/vendor, hierarchy assignment, lifecycle history, documents, device pairing, commercial references, onboarding draft/revision, evidence and import batch/row/dedup tables. Preserve immutable history and organization consistency.

Replace the current loose commercial seams before leased activation:

- `vehicle.vendor_id` becomes an organization-consistent FK to an Active vendor.
- Replace/free-text `lease_contract_ref` as the authority with `lease_contract_id` FK; keep source reference as a display/audit projection only.
- Leased vehicle requires one effective `lease_contract_vehicle` link; owned vehicle cannot accidentally carry leased-only contract fields.
- Lease replacement links old/new vehicles, source contract version and off-hire case without rewriting original history.
- Bulk import rows with unresolved vendor/contract are quarantined for Data Steward resolution; never auto-create placeholder Active vendors/contracts.

## Backend/API

Draft/create/update/validate/review/activate APIs; scenario rules; VIN/plate duplicate checks; reference-data validation; organization/scope authorization; vendor/lease validation; booking-pool structural restrictions; document preconditions; import upload, mapping, validate, deduplicate, resolve and sign-off; audit/outbox.

Vendor/contract validation loads Phase 2/3 records server-side and checks organization, category=LESSOR where required, Active status, effective dates, contract capacity/coverage and source freshness/manual exception. Client-provided names/references are never accepted as authority.

## Frontend

New explicit Vehicle Management routes/components, typed hooks, resumable wizard, conditional fields, validation summary, completeness, import table, duplicate compare/merge and role capability states. Do not modify supplied mockup artifacts.

## Tests

Every scenario; duplicate VIN/plate; invalid references; cross-scope denial; incomplete activation; buses/equipment excluded from booking; import 2,000+ rows; dedup; concurrent activation; audit/outbox; EN/AR/RTL; keyboard; responsive.

## Rollback

Deactivate onboarding write capability; retain drafts/import evidence. Activated vehicles remain governed records and are corrected through lifecycle/amendment, never deleted.

## Mandatory critique

Inspect conditional-field omissions, commercial evidence, duplicate races, scope leakage, incomplete activation, history loss, bulk-import memory/latency and accessibility.

## Exit gate

All four single-vehicle scenarios and bulk import are live, audited, scoped and browser-tested; vehicles are not bookable merely because onboarding began.
