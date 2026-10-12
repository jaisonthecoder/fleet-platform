# LLD — CW1 Simulator (`apps/cw1-simulator`)

| | |
|---|---|
| **Purpose** | A stand-in for CargoWise One's eAdapter so the platform can be built, demonstrated and tested before real CW1 access (OQ-2). Development and test only; never deployed to production. |
| **Written** | 04.09.2026 |
| **Grows with** | S1.01 skeleton · S1.07 organisations, message log, replies · S1.09 quotes, rate mock · S2.01 shipments and events · S2.04/S2.05 documents and invoices · S3.03 bookings |

## 1. Rules

1. No business logic. It replays canned XML templates with a few fields substituted.
2. It is not a source of truth. When real CW1 is connected, `CW1_ENDPOINT` changes and the simulator is switched off; no platform code references it.
3. Message formats follow the public eAdapter schemas until the CW1 team supplies samples (request item 2); party-role fields are marked `TODO-CONFIRM` in templates.

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| POST | `/eadapter/inbound` | receives XML the platform sends (quote request/accept/reject/cancel, booking create/update/cancel, eDoc attach); validates root element; logs; schedules a reply |
| GET | `/sim/messages` | log of received and sent messages with timestamps and correlation ids |
| POST | `/sim/replay/:id` | resend a previously sent outbound message |
| GET | `/sim/organisations.csv` | organisation export (code, name, country, city, branch, isClient, isActive, parentCode) |
| POST | `/sim/organisations/:code` | rename, deactivate or re-parent an organisation (tests import change detection) |
| POST | `/sim/rates/price` | rate-engine mock: `{mode, origin, destination, cargo}` → options for 3–4 seeded lanes, `204` otherwise |
| POST | `/sim/shipments` | create a fake shipment from a template with given parties and route; starts its event timeline |
| POST | `/sim/shipments/:id/events` | emit one event now (`code`, `actualAt`) |
| POST | `/sim/shipments/:id/documents` · `/invoices` | push an eDoc or a UniversalTransaction with `addresseeOrgCode` |
| POST | `/sim/quotes/staff-created` | push a quote "created by staff in CW1" for a given org code |
| POST | `/sim/clock/advance` | jump the simulated clock so timed events fire |

Outbound messages are POSTed to `PLATFORM_INBOUND_URL` (the platform's eAdapter inbound endpoint) with the configured auth header; failures are retried 3 times and logged.

## 3. Seed world

- 30 organisations: six client companies with 2–3 offices each (e.g. `ACMEUK001`, `ACMEAE001`, `ACMEDE001`; `BLUEQA001`; `NOVAES001`, `NOVAMX001`), six carriers, six agents, six suppliers; two inactive.
- Four lanes with rates for the mock: CNSHA→AEJEA FCL and LCL, DEHAM→AEDXB FCL, CNPVG→AEDXB air. Everything else returns "no rate".
- Shipment templates: sea FCL, sea LCL, air; each with a milestone timeline (booked → loaded on board → departed → arrived → customs cleared → delivered) at configurable intervals.
- Three standing fixtures created at start-up: a single-customer shipment (Acme), a shared shipment (Acme shipper, Blue Ocean consignee), a shipment with only unmapped codes.

## 4. Configuration

`PLATFORM_INBOUND_URL`, `REPLY_DELAY_SECONDS` (default 10), `EVENT_INTERVAL_SECONDS` (default 60), `CLOCK_MODE` (`real` | `manual`), `AUTH_HEADER`.

## 5. Tests it enables

Idempotency (same message id twice), DLQ (malformed XML), instant vs manual quote path, adoption of staff-created quotes, tenant resolution for shared and unmapped shipments, addressee rule for invoices, org import change detection, correlation-id tracing across API → worker → simulator.
