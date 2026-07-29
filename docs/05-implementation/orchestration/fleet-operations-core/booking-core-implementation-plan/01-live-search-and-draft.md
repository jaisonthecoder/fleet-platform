# BOOKING-01 - Live Search, Vehicle Selection and Draft

> **Status:** `VERIFIED`
> **Verified:** 2026-07-24

## Objective

Replace the static Employee `/booking` search and Vehicle cards with a production-backed self-booking journey through idempotent Draft creation.

## Entry Criteria

- BOOKING-00 context, people, read and command contracts are frozen.
- The 10 demo Vehicles remain visible through hierarchy-scoped availability.
- Booking mockups and derived states remain approved.
- On-behalf controls stay hidden unless all BOOKING-00 gates are closed.

## Mandatory Visual Source

Follow [21-booking-employee-book-a-vehicle.png](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/21-booking-employee-book-a-vehicle.png) and the approved [mockup review](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/mockup-review.md).

Preserve these regions and order inside the existing shell:

1. Employee pool/context eyebrow, `Book a vehicle` heading and concise consent-before-number message.
2. One-row destination, pick-up, return and passenger search area on desktop, stacked responsively.
3. `Today at <pool>` availability timeline with Vehicle labels and text legend for own Booking, unavailable and open states.
4. `Eligible vehicles` count and Vehicle-card grid with make/model when available, plate, seats, fuel, safe location, availability and primary Book action.

The image contains examples, not data. `GS Pool - Mina Zayed`, people, plates, times, yard, fuel estimates and availability segments must come from authorized context/Vehicle/Booking projections.

## Backend Work

1. Preserve `GET /v1/vehicles/available` as the single availability authority.
2. Add organization predicates and stable paging/filter bounds if query review shows they are not already guaranteed by scoped hierarchy assignments.
3. Return only fields approved for Employee availability: Vehicle ID, plate, make/model display where governed, class/body/use/fuel, seats, safe location/pool summary and freshness where implemented.
4. Do not return Vendor, lease, compliance-document, VIN, cost or another user's Booking data.
5. Revalidate Vehicle lifecycle, pool flag, capacity, scope and duration at Draft creation.
6. Accept a durable create idempotency key and return the original Draft after timeout/retry.
7. Record the effective Vehicle/scope and decision provenance used to create the Draft.
8. Add a privacy-safe scoped timeline/read model for screen `21`. It may expose own Booking, open/unavailable/maintenance labels and bounded availability ranges; it must not expose another user's identity, destination or purpose.
9. Estimated fuel/energy and recommendation require verified route/efficiency/ranking inputs. Until implemented, return no value and render `Not available`; never preserve mock values.

## Frontend Work

1. Replace hard-coded `timeline` and `eligibleVehicles` arrays in the production route.
2. Load context and default self requester/driver from authenticated server data.
3. Build a validated search form for destination, UTC-safe pickup/return and passenger count.
4. Use TanStack Query for availability with a query key including scope/window/capacity/filters; do not use mutation semantics for a read after contract stabilization.
5. Render loading skeleton, invalid window, empty, denied, stale Vehicle and retry states.
6. Preserve search input after a 409 and refresh results.
7. Selecting a Vehicle opens a review step; Draft creation occurs only after explicit review.
8. Add an unsaved Draft/search guard only where state loss is material.
9. Route all visible text through EN/AR catalogs and preserve the existing shell/role navigation.
10. Keep the timeline and Vehicle-card regions visually present. Missing dependencies render honest regional unavailable states instead of being removed or filled with fixtures.

## Tests

- Backend: boundary windows, capacity, hierarchy closure, foreign organization, held/non-Active Vehicle, overlap, deterministic ordering, privacy-safe timeline and query bounds.
- Frontend: no mock arrays, context defaults, validation, search success/empty/error, Vehicle stale conflict and Draft retry.
- Contract: response masking and schema drift.
- Browser: Employee self-search and Draft at 320, 768, 1024 and 1440 in EN and AR/RTL; keyboard and axe checks.

## Observability

Measure availability duration, result count, zero-result rate, invalid-window rate, stale selection conflicts, Draft creation duration and idempotent replay count by organization/scope without person-level metric labels.

## Rollback

Disable live write capability and show a controlled unavailable/read-only state. Never restore the hard-coded production mock.

## Exit Gate

An authenticated Employee can use the screen `21` composition with real scoped search, privacy-safe timeline and Vehicle cards, then create exactly one persisted Draft for self. No booking number, reservation or approval workflow exists yet. Production `/booking` contains no synthetic data.

## Verification Evidence

- `GET /v1/vehicles/availability-timeline` returns bounded organization/hierarchy-scoped pool rows with only `OPEN`, `OWN` and `UNAVAILABLE` segments; other-person Booking facts are never projected.
- Availability returns governed make/model/body/fuel/capacity/location fields and applies passenger capacity. Draft creation revalidates lifecycle, pool membership, capacity, authorized scope and buffered active overlap.
- `/booking` uses live context, timeline and availability queries, an explicit review Dialog, server-derived self IDs and a stable `Idempotency-Key`. A 409 preserves search input, refreshes stale results and distinguishes capacity conflicts.
- API evidence: Booking controller/service `61/61`; guarded HTTP plus PostgreSQL `15/15`; typecheck, lint, contracts, organization and dependency guards pass.
- UI evidence: `19` files / `84` tests, typecheck, lint and production build pass. EN and AR/RTL browser checks at `320`, `768`, `1024` and `1440` show no horizontal overflow.
- Critique round 1 repaired capacity/overlap revalidation, stale-result recovery, live announcements and RTL isolation. Critique round 2 repaired reason-specific capacity handling and proved stable-key retry.
- Both critique rounds incorrectly claimed offset-less date-time strings parse as UTC. Executable `TZ=Asia/Dubai` evidence proves `09:00` local becomes `05:00Z` and local timeline `06:00` becomes `02:00Z`; no double-offset change was applied.
- Final independent closure re-review found no unresolved Blocking/High issue. Consent content remains BOOKING-02, on-behalf remains fail-closed under `G-0006`, and operational metrics remain BOOKING-06.
