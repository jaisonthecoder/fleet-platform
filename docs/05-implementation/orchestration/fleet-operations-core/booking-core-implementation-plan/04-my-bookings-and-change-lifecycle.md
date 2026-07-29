# BOOKING-04 - My Bookings and Change Lifecycle

> **Current status (2026-07-29):** `VERIFIED`. Owner-scoped list/detail/history, server-derived actions, modify/re-consent, extend and cancel are wired and validated. Active custody can only complete through Handover Return.

## Objective

Give Employees a complete owner-scoped view of Draft, upcoming, active and historical Bookings with server-authorized modify/re-consent, extend and cancel actions.

## Entry Criteria

- BOOKING-00 authorized detail/events and capability projection are live.
- BOOKING-02 consent lifecycle is live.
- BOOKING-03 race semantics are required before Pending Approval changes are enabled.

## Mandatory Visual Source

My Bookings has no standalone PNG. Its design and implementation are explicitly authorized by [mockup-review.md](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/mockup-review.md) and controlled by the [derived My Bookings contract](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/derived-screen-contracts.md). Use screen [21](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/21-booking-employee-book-a-vehicle.png) for Employee density/type/status language and screen [25](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/25-booking-approvals-inbox.png) for detail/evidence composition. Do not create a marketing dashboard or unrelated card layout.

## Database and API Work

1. Add an owner/scope-safe cursor-paged `GET /v1/bookings` projection.
2. Employee queries are requester/beneficiary/driver ownership-bound according to the approved product rule; Fleet operational views remain separate.
3. Support stable tabs/filters: Upcoming (`Draft`, `PendingApproval`, `Approved`), Active and Past terminal states.
4. Include display-safe Vehicle/person summaries, current consent/workflow state and server-derived capabilities.
5. Add indexes for organization/person/status/window/cursor query shapes.
6. Freeze the legal status/action matrix. A client cannot move terminal state or cancel an Active handover.
7. Extend modify to use revision/idempotency and serialize against approval decisions.
8. Material change atomically voids consent and workflow linkage, records provenance and returns to Draft/re-consent state.
9. Extension revalidates duration, buffer and downstream reservation without leaking another user. Policy decides whether approval/mediation is needed.
10. Cancellation applies cutoff/state policy, records reason, releases reservation and emits effects once.
11. Early return navigates to Handover Return; Booking cancel does not complete physical custody.

## Frontend Work

1. Add My Bookings navigation and Upcoming/Active/Past views.
2. Use cards/labelled rows on small screens and a dense list/table on desktop without nested cards.
3. Detail shows event history and safe consent/policy references.
4. Render only server capabilities, while treating backend 403/409 as authoritative.
5. Reuse the Booking search/review components for modification.
6. On material change, explain consent invalidation and reopen the BOOKING-02 consent flow.
7. Show extension conflict/mediation without disclosing downstream Booking identity.
8. Terminal Bookings are read-only; completed receipt is linked after BOOKING-05.

## Tests

- Employee ownership isolation and Fleet-view separation.
- Cursor/filter correctness and 10k-row reference query plan.
- Every status/action pair, including terminal denial.
- Material/non-material modification and historical provenance.
- Modify/approve, cancel/approve and duplicate command races.
- Extension conflict privacy and original Booking preservation.
- Frontend stale-state refresh, error/empty/loading, EN/AR/RTL, keyboard and browser E2E.

## Exit Gate

Employees can understand every Booking state and perform only the actions authorized by persisted server state. No list/detail/event leaks another user's Booking, and change retries are idempotent.
