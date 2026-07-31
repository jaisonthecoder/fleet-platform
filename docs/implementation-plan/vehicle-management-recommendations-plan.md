# Vehicle Management — Recommendations Execution Plan (Phase 9)

> Implements the outstanding recommendations after the follow-ups (A/B/C/D).
> Each phase is a self-contained, testable slice: BE + FE + EN/AR i18n + tests,
> then gates (typecheck, tests, lint, guards). Ordered by value / low risk first.

## Ground truth (verified)
- `updateVehicleSchema` (BE) currently allows: colour, useCategoryCode, fuelTypeCode, mulkiya*, insurance*(provider/policy/expiry), fuelCardNumber, salik/darb, operationalStatus, bookingPoolFlag, assignedDriverPersonId, tracker*, gpsStatus. **Missing: year, seatingCapacity, nextMaintenanceDue, insuranceCoverageType.**
- Registry list sort whitelist = plate|make|lifecycle|mulkiyaExpiry|createdAt. **Missing: node, operational.**
- Registry FE: server pagination envelope + sort + CSV export shipped; **no page-size selector**.
- Activity tab shows trips + tiles (distance, trip count, open alerts, rated efficiency). **No estimated fuel used / utilization rate.**
- Live map plots individual MapLibre markers; **no clustering, no click-through to the vehicle drawer.**
- Int-spec harness: `NestFactory.createApplicationContext(AppModule)` + `createCoreHierarchyFixture` (test/support). Existing `vehicle.int-spec.ts`, `telematics.int-spec.ts` test services directly. **No coverage for the new list/summary/transfers/documents/device/alerts/trips/fleet-live methods.**

---

## Phase 1 — Editable fields (year, seating, maintenance, coverage)
**BE**: extend `updateVehicleSchema` with `year` (int), `seatingCapacity` (int>0), `nextMaintenanceDue` (date str), `insuranceCoverageType` (str). `repo.update` already spreads the set; confirm the service passes them (validate year/seating ranges). `toDto` already returns them.
**FE**: add these to `UpdateVehicleInput`; add inputs to the Edit tab (year + seating as numbers, nextMaintenanceDue as date, coverage as text). Convert numeric strings → numbers on save.
**i18n**: reuse existing field labels; add `edit` hints if needed.
**Test**: extend the patch test to send `year`; assert it round-trips.
**Exit**: the previously read-only fields are editable and persist.

## Phase 2 — Registry completeness (page size + more sort columns)
**BE**: add `node` (order by `hierarchyNode.name`) and `operational` (`vehicle.operationalStatus`) to the sort whitelist in `vehicle.repository.list`.
**FE**: add a page-size `Select` (25/50/100) wired to `pageSize` state (reset to page 1 on change); make the Hierarchy node + Operational headers sortable via the existing `SortButton`.
**i18n**: `vehicleManagement.pageSizeLabel`, `perPage`.
**Test**: assert page-size select renders + a node sort request.
**Exit**: sort on 7 columns, choose page size.

## Phase 3 — Compliance operations (quick filter)
**FE**: add a "Compliance blocks only" toggle in the registry toolbar that filters the loaded rows to those with an expired/missing Mulkiya or insurance (client-side over the page; the tile already gives the scoped total). Surface `nextMaintenanceDue` due-soon styling in the detail card.
**i18n**: `vehicleManagement.blockedOnly`.
**Test**: toggle hides compliant rows.
**Exit**: fleet managers can isolate compliance-blocked vehicles.

## Phase 4 — Fuel / utilization analytics (Activity tab)
**FE** (compute from data already loaded): add tiles for **avg distance/trip**, **estimated fuel used** (`Σ distanceKm / fuelEfficiencyKmpl`, shown only when efficiency is known), and a small per-trip list already present. Keep it honest — label estimates as such (no per-trip fuel telemetry stored).
**i18n**: `activity.avgTrip`, `activity.estFuel`, `activity.litres`, `activity.estimateNote`.
**Test**: assert the estimate tile from mocked trips.
**Exit**: utilization + fuel estimate visible per vehicle.

## Phase 5 — Live map polish (clustering + click-through)
**FE**: convert the live map from individual markers to a **GeoJSON source with `cluster: true`** + cluster/count/point layers (proper clustering at scale); clicking a point (or a side-list row) **opens the vehicle** by navigating to `/:lang/vehicles?vehicle=<id>`. The management page reads `?vehicle=` on mount, fetches that vehicle (`GET /v1/vehicles/:id`) and opens the drawer.
**BE**: FE needs a single-vehicle fetch → add `fetchVehicle(id)` in the contract hitting the existing `GET /v1/vehicles/:id` (already mapped). (The list returns a page, so a direct get is cleaner for deep-link.)
**i18n**: none new (reuse).
**Test**: keep the existing live-map test; add a management-page test that `?vehicle=<id>` opens the drawer (mock `GET /vehicles/:id`).
**Exit**: clustered live map; click a vehicle → its drawer opens.

## Phase 6 — Test hardening (BE int-specs + FE transfer test)
**BE int-specs** (extend telematics/vehicle int-specs or add a focused one): seed via `createCoreHierarchyFixture` + a vehicle, then assert: `VehicleService.list` (search/sort/pagination) + `count` + `summary`; `transfers`; `DocumentVaultService.listDocuments`; `DeviceService.getVehicleDevice`; `AlertService.listForVehicle`; `TripService.listForVehicle`; `LiveMapService.getFleetLive` (with a seeded telemetry row).
**FE**: add the transfer + driver-assign interaction test (mock hierarchy + `admin/users` + `/transfers` + `/transfer`).
**Exit**: the new surface is covered by automated tests.

## Global gates (per phase)
`pnpm typecheck` (both) · targeted vitest/jest · `pnpm lint` · `guard:contracts` (+`:update` for new DTOs) · `guard:org`.

## Status
- [x] Phase 1 — editable fields
- [x] Phase 2 — registry page size + sort columns
- [x] Phase 3 — compliance quick filter
- [x] Phase 4 — fuel/utilization analytics
- [x] Phase 5 — live map clustering + click-through
- [x] Phase 6 — BE int-specs + FE transfer test
