# Phase 8 (V4) — Vehicle Documents, Compliance, Telematics and Key Custody

## Objective

Make each vehicle operationally trustworthy before Booking relies on it: current documents, compliance gates, tracker/GPS freshness, odometer evidence and key custody.

## Mandatory mockup gate — ask before implementation

Request: document vault/upload/version/history; compliance runway; tracker pairing/unpairing/no-device/stale states; GPS/map inspector; key cabinet/custody/lost-key flows; alerts and responsive field screens.

## Documents/compliance

Mulkiya/registration, insurance, lease, maintenance and configured documents; immutable versions, effective/expiry dates, verification, storage references, alerts and hard blocks. Renewal never overwrites prior evidence.

## Telematics

SimulatorSource in Phase 1; device inventory, effective pairing, live telemetry, GPS freshness, odometer and trip attachment. No tracker is explicit. Telematics values never silently overwrite manual custody/inspection data; discrepancies retain both values.

Phase 1 exit gate is simulator-only. Aggregator/DirectVendorSource hardware ingestion remains Phase 2 W2 behind the same contract.

## Key custody

Key inventory/cabinet, custody issue/return/lost/duplicate, actor/time/booking/vehicle, append-only log. Handover requires available custody record; lost key starts an exception workflow.

Custody access: key manager/scoped Fleet roles see authorized logs; Driver sees own custody only; other employees do not. Sensitive reads are audited. Retention/archive follows Legal/Records decision; lost-key/incident evidence is never silently deleted.

## Database

Document versions, compliance items/blocks, device/pairing, telemetry/trip, key logs/assets/custody, freshness/indexes/retention. Effective constraints prevent overlapping pairings/custody.

## Backend/API

Upload metadata + immutable Blob reference; verify/renew; expiry queries; hard-block evaluation; pair/unpair; live location/odometer; custody commands/history; organization/scope authorization; audit/outbox/alerts.

## Frontend

Vehicle detail tabs and operational components reused by Booking/Handover: compliance runway, document list, tracker status/map, key state. Explicit loading/error/offline/stale/no-data states; no fake map values.

## Tests

Expired docs block availability; renewal history; storage failure; device overlap; stale telemetry; odometer conflict; key double-issue/lost; authorization; retention/privacy; accessibility/RTL/browser.

## Rollback

Disable writes/integration source; retain immutable evidence. Simulator remains valid fallback source, not fake production data.

## Mandatory critique

Look for fail-open compliance, overwritten evidence, stale GPS presented live, device/key overlap, unsafe file handling, secrets/PII, retention gaps and inaccessible status presentation.

## Exit gate

Every bookable vehicle has explainable current compliance, location/tracker and custody state, with hard blocks enforced server-side.
