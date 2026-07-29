# Vehicle Management — Execution Plan (Telematics-driven)

> Focused, phase-by-phase build plan for the Vehicle Management surface, including
> live telematics (KM / fuel / GPS). Complements the domain design docs under
> `booking_and_vehiclemanagement/06..08`. Owner: fleet vehicle workstream.
> Scope note: **booking is out of scope here** (owned by another workstream).

## Reality check (verified in code)

**Vehicle master (M2)** — CRUD, 7-state lifecycle, transfer, document vault (POST),
audit + `VehicleChanged` outbox. FE: registry list + onboarding wizard + detail
drawer (Details / Edit / Lifecycle / History).

**Telematics domain (M10) — already rich:**
- `telemetry` TimescaleDB hypertable stores per ping: `lat, lon, speed, ignition,
  odometer, fuelLevel, dtcCodes, deviceHealth` (`common/database/schema/telematics.schema.ts`).
  Written by the `telematics-ingest` worker; simulator emits odometer + `fuelLevel`.
- Device registry + effective-dated device↔vehicle pairing (btree_gist exclusion).
- Auto-odometer: trip-end writes `vehicle.lastConfirmedOdometer` (telematics = SoR).
- Live endpoint `GET /v1/vehicles/:id/telemetry/live` → position/speed/ignition/online,
  **audited** (D4 privacy). Currently omits odometer + fuel.
- Alerts: unplug / tamper / device-silent (raise + ack).

**Frontend reality:** live-map route is `ComingSoonPage`; no device / telemetry /
transfer / document / driver / alert / trip UI.

## Feasibility of telematics KM + fuel — YES
- KM = `telemetry.odometer` (already ingested; flows to `vehicle.lastConfirmedOdometer`).
- Fuel = `telemetry.fuelLevel` (0–1, already ingested).
- Position/speed/ignition/online already returned by the live endpoint.
- Only change to expose KM+fuel: add `odometer` + `fuelLevel` to `LivePositionDto`
  and `getLive` (the repo's `latestTelemetry` already selects them).

## Gaps

| # | Gap | Backend ready? |
|---|-----|----------------|
| G1 | DTO drift: `year, colour, seatingCapacity, sim, nextMaintenanceDue, insuranceCoverageType, depreciationRate` not in `toDto`/FE contract; `colour` editable but not returned (blind edit). | partial |
| G2 | No live telemetry in vehicle UI (KM, fuel, position, speed, ignition, health, DTC). | yes (needs DTO extension) |
| G3 | No GPS device pairing UI. | yes (needs current-pairing read) |
| G4 | No transfer UI / transfer history. | POST exists; needs GET history |
| G5 | No dedicated-driver assignment UI. | yes |
| G6 | No document vault UI. | POST exists; needs GET list |
| G7 | No alerts / trips / utilization / fuel-consumption. | partial |
| G8 | Registry is client-only filter/pagination; metrics reflect one page. | needs query params |
| G9 | Compliance/maintenance ops (`nextMaintenanceDue`, expiries) not surfaced. | partial |
| G10 | Bulk import is ComingSoon. | needs importer |

## Phase-by-phase plan

### Phase 0 — Contract / DTO completeness (foundation)
- BE: add `year, colour, seatingCapacity, sim, nextMaintenanceDue, insuranceCoverageType, depreciationRate` to `VehicleDto` + `toDto`.
- FE: extend `vehicleSchema`; prefill `colour` in edit; surface `year/seatingCapacity` read-only.
- Tests: contract-drift + DTO shape. **Exit:** complete record, no blind fields.

### Phase 1 — Live telematics in the detail drawer (KM · Fuel · GPS) ⭐
- BE: extend `LivePositionDto` + `getLive` with `odometer, fuelLevel, deviceHealth, dtcCodes`, and `lastConfirmedOdometer` fallback.
- FE: new **Telematics** tab in `VehicleDetailDrawer` — online/offline chip, last-seen, **odometer (KM)**, **fuel %**, speed, ignition, position (lat/lon + map link), health/DTC. Poll ~30s while open.
- States: no device / offline / masked off-shift. Tests (MSW live payload).
- **Exit:** current KM + fuel from the device visible per vehicle.

### Phase 2 — GPS device management + pairing
- BE: `GET /v1/vehicles/:id/device` (current pairing + device details).
- FE: Telematics tab shows paired device (identifier, model, SIM, firmware, status, last health); Pair / Unpair actions. **Exit:** trackers attachable in-app.

### Phase 3 — Transfer + dedicated-driver assignment
- BE: `GET /v1/vehicles/:id/transfers`.
- FE: Assignment tab — transfer to another node (scoped picker) + assign/unassign dedicated driver (person picker), transfer history. **Exit:** re-home + driver assignment in-app.

### Phase 4 — Document vault
- BE: `GET /v1/vehicles/:id/documents` (versioned list) + download.
- FE: Documents tab — versioned Mulkiya/insurance/registration, upload/view, expiry tie-in. **Exit:** compliance docs managed.

### Phase 5 — Alerts, trips & utilization
- BE: `GET /v1/vehicles/:id/alerts`, `GET /v1/vehicles/:id/trips`.
- FE: alerts (ack), trip history (distance/driver), fuel consumption vs `fuelEfficiencyKmpl`, utilization KPIs. **Exit:** operational health + usage per vehicle.

### Phase 6 — Registry at scale
- BE: server-side search/filter/sort + pagination + summary metrics endpoint.
- FE: server-driven table, operational/pool/driver/next-maintenance columns, saved views, export, maintenance/expiry dashboards. **Exit:** scales to thousands.

### Phase 7 — Bulk import / migrate
- Real importer UI (CSV/JSON) with validation, dedup, steward sign-off (mirrors reference-data import). **Exit:** fleet-scale onboarding.

**Order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.

## Status
- [x] Plan saved
- [x] Phase 0 — DTO/contract completeness (BE `toDto` + FE `vehicleSchema` extended with year, colour, seatingCapacity, sim, nextMaintenanceDue, insuranceCoverageType, depreciationRate; `colour` now editable)
- [x] Phase 1 — Live telematics tab (BE `LivePositionDto`/`getLive` return odometer + fuel + DTC + health; FE `useVehicleLive` 30s poll + Telematics tab showing KM, fuel %, speed, ignition, position, online/offline).
- [x] Phase 2 — GPS device management + pairing (BE `GET /v1/vehicles/:id/device`; FE DevicePanel in Telematics tab: current device, pair/unpair, register).
- [x] Phase 3 — Transfer + dedicated-driver assignment (BE `GET /v1/vehicles/:id/transfers`; FE Assignment tab: node transfer + history, driver search/assign/unassign).
- [x] Phase 4 — Document vault (BE `GET /v1/vehicles/:id/documents`; FE Documents tab: versioned docs + add version, expiry flags).
- [x] Phase 5 — Alerts, trips & utilization (BE `GET /v1/vehicles/:id/alerts` + `/trips`; FE Activity tab: alerts w/ ack, trips, distance/efficiency tiles).
- [x] Phase 6 — Registry at scale (BE `search` param on list + `GET /v1/vehicles/summary`; FE server-side search + summary-driven metric tiles).
- [x] Phase 7 — Bulk import / migrate (wired existing M3 import API; FE `VehicleImportPage` at `/vehicles/import`: stage → validate → review → steward sign-off).

**Verification:** FE 130/130 tests pass (15 vehicle); BE 25/25 unit specs pass; both packages typecheck clean. EN + AR i18n throughout.


