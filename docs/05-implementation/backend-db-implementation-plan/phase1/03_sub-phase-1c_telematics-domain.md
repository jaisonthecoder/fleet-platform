# Sub-Phase 1C — Telematics Domain (Block C)

**The domain side of telematics that turns canonical telemetry into fleet value** — device registry, live map, auto-odometer, and trip→booking attribution — running in the `api` deployable (the `telematics-ingest` pipe from Phase 0 stays a separate process with **no domain logic**). Runs in **parallel with 1B** after 1A.

- **Entry dep:** 1A green (PDP for privacy/access rules; events/outbox); 1B (devices pair to vehicles).
- **Unlocks:** feeds 1D (auto-odometer at handover, trip context) and 1F (coverage %).
- **Migration:** `0007_telematics`. (`telemetry` hypertable already exists from Phase 0.)
- **Decision pulled early:** **D4 (PDPL)** privacy sign-off is pulled **before** this block so retention + masking are built to the decided policy (P1B-R2-6).

---

## 1. DB (`0007_telematics`)
- **`device`** — GPS unit registry: identifier, model, firmware, status, health.
- **`device_pairing`** — effective-dated device↔vehicle pairing (a device moves between vehicles over time).
- **`trip`** — derived trip: start/end time, distance, `vehicle_id`, **`booking_id` (nullable — unassigned until attached)**, attribution basis.
- **`telematics_alert`** — unplug/tamper/device-silent alerts.
- **Retention & continuous-aggregates** on `telemetry` are configured **now** (per D4) so Phase-2 route replay has the data; off-shift data masked at rest per policy.

## 2. Module — `telematics/domain` (in `api`)
- **Device registry & pairing** — register devices, pair/unpair to vehicles (effective-dated).
- **Live map** — current position/status per vehicle from latest telemetry; rendered client-side with **MapLibre GL + Azure Maps** (not Google Maps — billing + UAE data residency). "Is it online?" freshness check.
- **Auto-odometer** — maintains the authoritative odometer from telemetry; **telematics is the system of record** for odometer (used to flag handover odometer conflicts in 1D).
- **Trip → booking auto-attach** — matches derived trips to active bookings. Built behind a **bookings port + test-double** until 1D (P1B-R1-1); full integration at the start of 1D.
- **Unplug / tamper / silent alerts** — raised from injected canonical events → `telematics_alert` + notification.
- **Consumes canonical events** from `telematics-ingest`; **calls the PDP** for privacy/access decisions.

## 3. Privacy (D4 / PDPL)
- **Access logged** — every read of location/trip data is audited.
- **Retention** — per D4 policy (configured on the hypertable).
- **Off-shift masking** — non-working-hours positions masked; proven on **simulated** data.

## 4. Boundaries
- **`dependency-cruiser` rule:** `telematics-ingest` ⇏ request-path modules (bookings/entitlements/handover). The domain module lives in `api`; the ingest pipe does no domain work — protects the booking path's event loop (P0-R2-6).

## 5. Contracts
`contracts/device.contract.ts`, `contracts/trip.contract.ts`, `contracts/telematics-alert.contract.ts`, `contracts/bookings-port.contract.ts` (the port trip-attach depends on).

## 6. PDP rule types
Consumes privacy/access rules (from 1A); no new rule types owned here.

## 7. Events
Consumes `TripStarted`/`TripEnded`/`DeviceSilent` (from ingest). Emits `TripAttached`, `TelematicsAlertRaised`, `DevicePaired`.

## 8. Endpoints
`GET /vehicles/:id/telemetry/live`, `GET /trips`, `GET /trips/:id`, `POST /devices`, `POST /devices/:id/pair`, `GET /telematics/alerts`. (Access-controlled + logged.)

## 9. Tests
- **One simulated device per pool vehicle**; live map shows fresh positions; "online?" freshness correct.
- **Auto-odometer** tracks telemetry; conflict surfaced for 1D.
- **Trip attach** verified against the bookings test-double **and measured against adversarial (non-booking-aware) trips** (P1B-R2-3) — false-attach rate bounded.
- **Unplug alert** fires from an injected event.
- **`TelemetrySource` swap-tested** (simulator → stub aggregator) with **no domain change** — proves the pluggable-source design.
- **Privacy:** access logged; off-shift masking applied; retention honored — on simulated data.

## 10. Exit gate
- Live map + auto-odometer + trip attach verified on one simulated device per pool vehicle.
- Unplug alert via injected event; `TelemetrySource` swap-tested with no domain change.
- Trip-attach measured against adversarial trips; D4 privacy built and proven on simulated data.

## 11. Traceability
- **FRs:** FR-TEL-01..12 (device, live map, odometer, trip attach, alerts, privacy).
- **Critique resolved:** P1B-R1-1 (bookings port test-double) ✅; P1B-R2-3 (adversarial trip attach) ✅; P1B-R2-6 (D4 pulled early) ✅; P0-R2-6 (ingest boundary) ✅ reinforced.
- **Gate items advanced:** "≥90% simulated coverage; trip-attach vs adversarial trips; `TelemetrySource` swap-tested; D4 PDPL sign-off".
- **Migration catalog:** `0007_telematics`.
- **D-list:** **D4** (PDPL) — must be signed off before this block.

**Next:** [Sub-Phase 1D — Core Loop](04_sub-phase-1d_core-loop.md).
