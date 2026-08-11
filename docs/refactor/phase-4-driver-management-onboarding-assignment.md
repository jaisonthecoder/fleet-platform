# Phase 4 — Driver Management (Onboarding & Assignment)

**Goal:** A proper driver-management capability: onboard a person as a professional/substitute driver (capturing licence, medical, training, endorsements), maintain a searchable driver register, and manage driver-to-vehicle assignment with effective dates, exclusivity, and history.

**Scenarios:** S-50, S-51, S-52, S-53, S-54, S-55, S-43
**Features:** F-30, F-31, F-32, F-33, F-34, F-35

---

## In scope
- `driver_profile` + `driver_assignment` tables.
- Onboarding wizard; driver register; assignment lifecycle; credential-expiry blocks on driving/assignment.

## Out of scope
- Mobile driver app; behaviour scoring (later phase of product).

## DB
- Migration: `fleet.driver_profile`, `fleet.driver_assignment` (§03 1.3) with `btree_gist` exclusion for non-overlapping open assignments per vehicle and per driver. Rollback drops both.
- Keep `vehicle.assigned_driver_person_id` as the effective pointer, synced from the active assignment.

## Backend
- New `DriverManagementModule`:
  - `POST /v1/drivers` — onboard (promote person → professional/substitute; create `driver_profile`; set `is_professional_driver` where applicable; require licence via document center).
  - `GET /v1/drivers` — register (search, credential status), `GET /v1/drivers/:personId` — profile.
  - `POST /v1/drivers/:personId/assignments` — assign to vehicle (effective dates, type); `DELETE .../assignments/:id` — end.
  - `GET /v1/vehicles/:id/driver` — current + history.
- Enforce: assignment requires a driver with **valid** licence (+ medical/training if configured); expiry blocks new assignments and flags active ones (`driver-credential-expired`). Preserve the existing Dedicated-requires-driver invariant.
- Reuse `person_document` (P2) for licence/medical/training; `listProfessionalDrivers` continues to back dedicated WithDriver.

## Frontend
- **Driver register** page (Fleet roles): searchable list with credential status chips; open a driver drawer (profile, documents via P2 panel, assignments, history).
- **Driver onboarding wizard**: select person → capture credentials/documents → confirm → active.
- **Assignment** UI in the driver drawer and the vehicle detail drawer's Assignment tab (extend existing): assign/replace with dates, view history.

## Contracts / guards
- New DTOs → `guard:contracts:update`; org-scoped files → `guard:org` allowlist.

## Tests
- BE: onboarding creates profile; assignment exclusivity (no overlap) via int-spec; expiry blocks assignment; effective-pointer sync; RBAC.
- FE: register search; onboarding wizard; assignment create/replace; expiry chips.

## Acceptance criteria
- A Fleet Manager can onboard a professional driver with licence/medical/training and see them in the register.
- A driver can be assigned to a vehicle with dates; overlapping open assignments are rejected.
- Expired driver credentials block new assignments and surface a clear reason.

## Dependencies
P2 (documents). Feeds P6 (profile) and dedicated WithDriver.
