# Phase V2 — Vehicle Registry, Search and Detail

## Objective

Deliver the live scoped vehicle registry and reusable vehicle inspector/detail experience that every booking, operations, compliance and handover flow depends on.

## Mandatory mockup gate — ask before implementation

Request: Fleet Manager list, filters and vitals; grouped/paged states; desktop inspector and mobile full-page detail; all detail tabs; current-state card; hierarchy assignment; compliance runway; risk counters; GPS/map/no-tracker states; loading/empty/error/permission states; EN/AR.

## Actors and scope

Fleet Manager (pool), Fleet Leads (cluster/group), Data Steward, Procurement/Finance/Insurance/HSE per field/capability, Internal Audit read-only. Queries are organization and authorized-scope filtered server-side.

## Registry

- Vitals: total, bookable now, in use, maintenance, compliance blocks, completeness.
- Search plate/VIN/make/model/driver/code.
- Filters: hierarchy, lifecycle, operational, booking-pool, assignment model, body/fuel/ownership, compliance, tracker, completeness.
- Sort, pagination/export with authorization and limits.
- Dense table grouped by scope where useful; stable status labels.

## Detail/inspector

Header identity and booking-pool status. Tabs: Overview; Ownership & Lease; Compliance & Documents; Telematics & GPS; Maintenance; Lifecycle History. Overview includes classification, current state, current driver/custody, hierarchy path, utilization, GPS state/map, risk counters and actions.

## Database/read models

Add indexed search/read projections if query plans require them. Resolve current effective hierarchy/device/driver/custody/documents/booking state without N+1. Keep source tables authoritative.

## Backend/API

Scoped list/detail endpoints with field-level masking, filter schema, paging, summary counts, current assignment, compliance runway, active booking, assigned driver, utilization, key custody, fines/accidents, GPS freshness and links to histories.

## Frontend

Real `/fleet` and `/fleet/:id` (or inspector) routes. Shared Vehicle & Pool Finder/card/table primitives used by Booking. Mobile inspector replaces list with back navigation. Every empty/degraded state is explicit.

## Tests

Scope isolation, role masking, query plans/latency, no-tracker/no-doc/no-driver, active booking, dedicated/reserve/maintenance states, stale telemetry, mobile/RTL, keyboard table/inspector, contract and E2E.

## Rollback

Read-only feature flag returns users to existing safe screens; no data rollback. New projections can be rebuilt.

## Mandatory critique

Look for unscoped listing, stale current-state joins, N+1, cost leakage, misleading missing telemetry, color-only state, inaccessible dense tables and mobile overflow.

## Exit gate

Fleet users can find and inspect every authorized vehicle with accurate current/historical status, and Booking can consume the same live vehicle summary contract.
