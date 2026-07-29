# Agent Context Pack - CORE0-VEHICLE

| Field | Value |
|---|---|
| Program/phase | Fleet Operations Core / CORE-0 |
| Workstream | `CORE0-VEHICLE` - Vehicle operational baseline |
| Task type | Exploration/documented reconciliation |
| Status | `READY` |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Worktree/branch | Main workspace, read-only |
| Implementer | Generic isolated subagent |
| Independent reviewer | Assigned after reconciliation |

## Business Outcome

Determine exactly what Vehicle Management already delivers and what remains for V1-V4, so the operational core reuses working code and assigns the smallest non-overlapping implementation slices.

## Scope

- Inspect Vehicle onboarding/import, registry/detail, lifecycle, hierarchy transfer, pool controls, documents/compliance integration, device/telematics association and key custody.
- Trace controller -> service -> repository -> schema/migration -> tests and existing frontend routes/hooks.
- Reconcile actual behavior against phases 5-8 and Phase 19 Vehicle matrix.
- Identify stable contracts required by Booking, Handover and Entitlement.
- Produce a per-capability status: `VERIFIED_EXISTING`, `PARTIAL`, `MISSING`, `REGRESSED`, or `BLOCKED_BY_MOCKUP`.

## Explicit Exclusions

- Do not edit any file.
- Do not design or implement frontend screens.
- Do not start Vendor/Lease automation, full O4/O6, or Phase 8 migration.
- Do not trust plan status without source/test evidence.

## Controlling Sources

- `docs/implementation-plan/booking_and_vehiclemanagement/01-shared-domain-contracts-and-data-foundation.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/05-vehicle-onboarding-and-import.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/06-vehicle-registry-and-detail.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/07-vehicle-lifecycle-transfer-and-maintenance.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/08-vehicle-documents-compliance-telematics-and-custody.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/19-traceability-and-completion-matrix.md`
- `docs/05-implementation/orchestration/fleet-operations-core/DECISION-REGISTER.md`

## Current Implementation Anchors

- `app-api/src/modules/vehicles/**`
- `app-api/src/modules/migration/**`
- Vehicle, hierarchy, compliance and telematics schemas under `app-api/src/common/database/schema/**`
- Related migrations under `app-api/drizzle/migrations/**`
- Vehicle/import integration tests under `app-api/test/**`
- Related UI routes/features/hooks under `app-ui/src/**`

## Contracts and Boundaries

- Preserve D-SEQ-001 minimum authorization floor and domain ownership.
- Vehicle is authoritative for lifecycle, effective scope assignment, pool eligibility, compliance/device/custody references.
- Full O4/O6 is deferred; identify required ports without claiming full scope readiness.
- Frontend is mockup-gated and current screens are evidence only, not design authority.

## File Ownership

### May inspect

- Entire repository as needed, prioritizing the anchors above.

### Must not edit

- All files.

## Required Output

1. Capability matrix with source/test evidence.
2. Stable API/data/event contracts consumed by Booking/Handover/Entitlement.
3. Defects versus missing features versus stale documentation.
4. Proposed implementation slices with exclusive file ownership and dependency order.
5. Cheapest focused validation for each proposed slice.
6. Risks or decisions that require the user before implementation.

## Readiness Instruction

Begin by restating the outcome, boundaries and inspection strategy. Then perform the read-only investigation. Do not propose UI appearance or make edits.
