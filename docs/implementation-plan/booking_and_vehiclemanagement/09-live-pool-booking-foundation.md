# Phase 9 (B1) — Live Pool Booking Foundation and Actor Authority

## Objective

Replace the static `/booking` mock with a real backend-connected booking foundation while preserving the approved mockup’s content density and Wayfinder visual language.

## Mandatory mockup gate — ask before implementation

Request the detailed booking mockups before any UI edit: Employee self-booking; Fleet Manager booking on behalf; driver/beneficiary selector; 4-step wizard; time quick-picks/custom range; vehicle category/passengers/destination/purpose; mobile/tablet; all validation/loading/error/blocked states; EN/AR.

Mockups remain untouched reference artifacts. Build new source components only.

## Actors and authority

### Employee self-booking

`requestedBy = beneficiary = authenticated person`; driver defaults to that person unless a permitted professional/substitute scenario applies. Scope is authorized home pool; no arbitrary scope switch.

### Fleet Manager on behalf

FleetManager/ClusterFleetLead/GroupFleetLead (and explicitly approved operational admin roles, never SystemAdmin operational approval) may create for another active person only inside managed hierarchy closure. UI clearly shows “Booking for” and “Driver”; audit stores actor/on-behalf-of/beneficiary separately. The beneficiary/driver signs consent; Fleet Manager cannot consent for them unless a legal delegated-consent rule is approved.

### Other actors

Professional/non-employee and substitute drivers use governed records and time windows. Line Manager approval and Fleet Manager preparation are later phases.

Phase 1 treats Professional/Substitute drivers as data-model-only unless D16/release scope is approved. The normal picker includes active employees in the actor's authorized closure. Phase 2 driver selection filters approved professional/substitute records by effective availability and eligibility policy.

## UI architecture

New `features/booking/` route slice with genuine wizard state: WINDOW → VEHICLE → CONSENT → CONFIRMED. URL/route-state supports refresh-safe draft continuation where approved. No hard-coded vehicle arrays or occupancy bars.

## Backend contracts

- Booking context (`GET /booking/context`): actor, allowed booking modes, default beneficiary/driver/scope, scoped people options, policy/legal text metadata.
- Scoped people search for on-behalf use, server-filtered.
- Server validates requester/beneficiary/driver organization, active status, scope and role authority.
- Create Draft command ignores spoofed actor IDs and binds authenticated actor.
- Idempotency key protects duplicate draft creation.
- Persist `requestedByPersonId` (authenticated actor), `beneficiaryPersonId` (person receiving the booking) and `driverPersonId` separately. Self-booking may have all equal; on-behalf never collapses them in audit/evidence.
- SystemAdmin is read/audit/export only for operational booking and cannot create/approve solely by SystemAdmin role.
- On-behalf creation notifies beneficiary and driver with creator/window/purpose. Driver consent remains mandatory. If beneficiary acceptance is required, state is `PendingBeneficiaryAcceptance` until accept/decline.

## Database

Ensure distinct actor/requested-for/driver fields and append-only actor evidence; optional booking draft client token; organization/scope consistency; no number/reservation before consent gate.

## Frontend

Typed contracts/hooks, wizard reducer, accessible stepper, unsaved-change guard, scoped searchable person controls shown only to authorized Fleet Manager roles, no data from mock constants.

## Tests

Employee cannot book for another; scoped Fleet Manager can; sibling/out-of-org denied; inactive person denied; driver/beneficiary separation; refresh/idempotency; role changes; EN/AR/RTL; 320px/wide; mock constants absent from production route.

Add forged actor IDs, beneficiary notification/acceptance, outside-closure Fleet Manager, SystemAdmin operational denial and consent signed by a person other than current driver.

## Rollback

Feature flag returns route to an unavailable/read-only notice, not the old fake booking flow. Backend additions remain additive; no fake success.

## Mandatory critique

Check identity spoofing, consent impersonation, scope leakage, SystemAdmin operational access, stale people lists, duplicate submissions, hidden actor fields, mobile wizard and mock data remnants.

## Exit gate

`/booking` is live and role/scope-correct through draft creation, with self and Fleet Manager on-behalf scenarios proven; no consent/confirmation is faked.
