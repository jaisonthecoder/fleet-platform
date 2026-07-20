# 8.2A - Live Booking User Journey

## Status

Planned. Implementation must not begin until this document is reviewed. The supplied Helm screenshots are visual/business references only and must not be modified.

## Objective

Replace the static `/booking` mock route with a production-backed Wayfinder booking journey for:

1. An employee booking a pool vehicle for their own trip.
2. A Fleet Manager or higher fleet authority booking on behalf of another active person within an authorized hierarchy scope.
3. A requester choosing a different eligible driver where policy and role permit it.
4. Driver consent, booking-number issuance, submission and visible approval status.

Dedicated/long-term vehicle requests remain the Entitlement domain and are implemented in Phase 8.5.

## Dependencies

- Phase 8.1 shared decision selector/shadow/provenance: complete.
- Phase 8.2 booking buffer, duration and re-consent decisions: complete.
- Organization O0-O6 and authorized scope closure: complete.
- Booking backend draft/consent/submit endpoints: implemented but require actor/scope hardening below.
- Phase 8.3 approval workflow migration begins only after this phase passes.

## Source and design boundaries

- Preserve the attached mockup files/screens unchanged.
- Build a new application implementation using existing Wayfinder tokens, components, route conventions and EN/AR support.
- Keep the mockup’s information hierarchy: destination/window/passengers, pool availability timeline, eligible vehicle cards and clear Book command.
- Replace all mock arrays, static availability bars and synthetic booking results with API-backed data.
- No landing-page or instructional marketing content.

## Business scenarios

### Scenario A - Employee self-booking

1. Authenticated linked employee opens `/booking`.
2. Scope defaults to their authorized home/role scope.
3. Employee enters destination, pickup, return and passenger count.
4. System lists only eligible/available vehicles within authorized scope.
5. Requester and driver default to the authenticated person.
6. User selects a vehicle and creates a Draft booking.
7. Actual driver signs consent.
8. Booking number is issued atomically with consent.
9. Booking submits to approval and displays current status.

### Scenario B - Fleet Manager booking for another person

1. Actor holds FleetManager, ClusterFleetLead, GroupFleetLead or SystemAdmin in a scope containing the requested trip/driver.
2. Actor selects `Book for someone else`.
3. Backend returns active people inside the actor's manageable scope only.
4. Actor selects requester and driver; they may be the same person.
5. Backend records acting person separately from requested-by and driver identities.
6. The selected driver must provide consent; Fleet Manager cannot impersonate driver consent.
7. Audit records actor, requester, driver, scope and booking IDs.

### Scenario C - Professional/substitute driver

- Fleet authority may select an eligible ProfessionalDriver or SubstituteDriver in the managed scope.
- Eligibility hard gate runs on the selected driver and vehicle before reservation.
- If no eligible driver exists, the UI shows an explainable blocked state; it never substitutes silently.

### Scenario D - No availability

- Availability returns an empty result with reason/next-action state.
- No Draft is created.
- Future waitlist support may be offered only after the existing waitlist endpoint/workflow is implemented and tested.

### Scenario E - Material modification

- Existing Booking detail/edit route reuses Phase 8.2 re-consent behavior.
- Vehicle/category/window changes outside tolerance void prior consent and approval linkage atomically.
- UI shows that fresh consent and resubmission are required.

## Authorization rules

### Self-booking

- Any linked active person may create a booking where `requestedByPersonId` and `driverPersonId` equal their authenticated `personId`.
- Backend overwrites/rejects caller identity fields that attempt another person without elevated authority.

### Booking on behalf

Allowed roles:

- FleetManager
- ClusterFleetLead
- GroupFleetLead
- SystemAdmin

Rules:

- Actor, selected requester, selected driver, vehicle and hierarchy scope must share organization.
- Actor's role scope must contain the requested scope.
- Selected person must be active and visible in the actor's authorized scope closure.
- SystemAdmin still cannot bypass driver consent or eligibility.
- Every on-behalf action is audited with `actorPersonId`, `requestedByPersonId`, `driverPersonId`, and scope.

## Backend contracts

### Availability

`GET /api/v1/vehicles/available`

Inputs:

- `pickupAtUtc`
- `returnAtUtc`
- `passengerCount` or `seatingCapacity`
- `scopeNodeId`
- optional category/body/fuel filters

Backend behavior:

- Validate requested scope against Principal.
- Resolve authorized descendants.
- Filter vehicle hierarchy assignments to those descendants and Principal organization.
- Apply lifecycle, booking-pool, compliance, capacity and reservation-overlap filters.
- Return typed vehicle summary; do not expose unavailable vehicles as available.

Response fields:

- vehicle ID
- plate
- make/model display values
- body/use/fuel codes
- seating capacity
- hierarchy node summary
- optional next-available time when efficiently available

### Booking people picker

`GET /api/v1/bookings/people?scopeNodeId=`

- Employee receives only self.
- Fleet authority receives active people in managed scope.
- Returns minimal data: person ID, display name, employee ID, grade, home scope, professional/substitute-driver indicators.
- Search is server-side and paginated for large organizations.

### Create Draft

`POST /api/v1/bookings`

Request UI fields:

- vehicle ID
- selected requester person ID
- selected driver person ID
- pickup/return
- destination
- purpose
- passenger count

Server-added fields:

- authenticated actor
- organization
- vehicle scope/effective time
- decision selector environment
- correlation ID

### Consent

`POST /api/v1/bookings/:id/consent`

- Must be performed by the selected driver or a future explicitly approved digital-signature flow.
- Consent version/signature metadata are required by contract.
- Booking number and reservation commit in the same transaction.

### Submit

`POST /api/v1/bookings/:id/submit`

- Idempotent when an active workflow already exists.
- Phase 8.3 will migrate route selection and workflow-definition provenance.
- Until 8.3 completes, UI shows the existing workflow status without claiming the new route engine is primary.

### Read booking

`GET /api/v1/bookings/:id`

Must expose:

- booking number/status
- vehicle/requester/driver IDs and display summaries where authorized
- pickup/return/destination/passengers
- consent state
- workflow status
- current decision evidence summary added in Phase 8.9

## Backend implementation slices

### B1 - Actor and on-behalf authorization

- Bind create/modify/cancel/submit actor from Principal.
- Add reusable booking authorization service.
- Validate same organization and hierarchy closure.
- Add audit actor/requester/driver context.

### B2 - Scoped live availability

- Extend repository availability query with organization and authorized node IDs.
- Remove any whole-database vehicle availability path.
- Add capacity, lifecycle and booking-pool checks.

### B3 - Scoped people search

- Add booking-specific paged people query.
- Employee self-only projection.
- Fleet authority managed-scope projection.
- Professional/substitute driver flags.

### B4 - Typed booking frontend API

- Add Zod contracts and TanStack Query/mutation hooks.
- Search query key includes scope/window/passengers/filters.
- Draft/consent/submit mutations invalidate availability and booking detail.

## Frontend route and composition

Route: `/{lang}/booking`

Primary composition:

1. `BookingPageHeader`
2. `BookingSearchForm`
3. `BookForSelector` (shown only to eligible fleet roles)
4. `PoolAvailabilityTimeline`
5. `EligibleVehicleGrid`
6. `BookingReviewDialog` or unframed review step
7. `DriverConsentStep`
8. `BookingSubmissionResult`

### Search form

- Destination
- Pickup date/time
- Return date/time
- Passenger count
- Current hierarchy scope
- Requester/driver selectors when booking on behalf
- Search command

### Availability timeline

- Driven by API data; no hard-coded vehicles or bars.
- Stable dimensions and responsive horizontal scroll/list fallback.
- Color is never the only state indicator.
- On mobile, use vehicle list with availability labels rather than compressing the timeline beyond readability.

### Vehicle cards

- Actual make/model/plate/capacity/fuel/hierarchy data.
- Availability status from backend.
- Book button disabled for stale/unavailable results.
- Selecting a vehicle opens review rather than creating immediately.

### Review and consent

- Review requester, driver, scope, vehicle, trip window, destination and passengers.
- Explicitly state who must consent.
- Fleet Manager booking on behalf receives `Awaiting driver consent` when actor is not driver.
- Self-driver can continue to consent immediately.

### Success/status

- Show booking number only after consent transaction succeeds.
- Show Pending Approval, Approved, Declined, Draft/Re-consent Required or other actual backend status.
- Link to booking detail/events when available.

## UI states

- Initial/default search
- Searching/loading
- Results
- No eligible vehicles
- Invalid window
- Unauthorized scope
- Person search empty/loading/error
- Vehicle became unavailable (409)
- Eligibility denied with reasons
- Consent required from another driver
- Consent failed
- Submitted/pending approval
- Re-consent required
- API unavailable/retry

## Accessibility and localization

- EN/AR and RTL for all new text, forms, dialogs and status states.
- Keyboard-complete search, selectors, cards and review/consent flow.
- Proper labels and error associations.
- Focus moves to search results, errors, review and success headings.
- Availability is conveyed by text/icon as well as color.
- 320px/mobile, tablet and desktop verification.
- Reduced-motion compliance.

## Persistence and evidence

- Booking current projection retains Phase 8.2 provenance JSON.
- Append-only `booking_policy_decision` retains each value/re-consent decision.
- Booking events include actor/requester/driver changes without raw sensitive facts.
- Audit identifies on-behalf actor separately.
- Phase 8.3 adds approval-route/workflow-definition evidence.

## Tests

### Backend unit

- Employee cannot request for another person.
- Fleet authority can request for a person in descendant scope.
- Fleet authority cannot request across sibling/foreign scope.
- Selected driver must be active and same organization.
- Consent actor must match selected driver.
- Availability filters unauthorized nodes and active overlaps.

### Backend integration

- Self-booking full draft -> consent -> submit flow.
- Fleet Manager on-behalf draft; driver completes consent.
- Unauthorized on-behalf returns 403.
- Cross-organization person/vehicle/scope rejected.
- Concurrent vehicle selection returns one success and one 409.
- Append-only provenance/audit/event evidence exists.

### Frontend

- Live availability request and rendering.
- Self-booking default identities.
- Fleet Manager on-behalf selectors.
- Review/consent/status transitions.
- API error and 409 recovery.
- EN/AR/RTL and axe.

### Browser E2E

- Employee self-booking.
- Fleet Manager booking for manager/employee.
- Driver consent handoff state.
- No-availability flow.
- Mobile and desktop screenshots.

## Rollout

1. Development with MSW contract tests and live backend.
2. UAT with seeded Employee and Fleet Manager users.
3. Shadow operational observation while Booking selectors remain legacy-only.
4. Enable live route after authorization and atomicity gates pass.
5. Monitor booking create/409/eligibility/consent/submit failures.

## Rollback

- Route feature flag can restore the existing static page only in development; production rollback returns a controlled unavailable state rather than fake booking behavior.
- Backend additions remain additive.
- Decision selectors return to legacy-only independently.
- Existing committed bookings and provenance are never rewritten.

## Vehicle Management sequencing

Vehicle Management is a separate operational module, not part of this Booking page implementation.

Recommended order:

1. Complete 8.2A live normal Booking journey.
2. Complete 8.3 Booking approval workflow and UI status.
3. Complete 8.5 Dedicated Vehicle Entitlement request/approval UI.
4. Deliver Vehicle Management UI against the existing vehicle backend:
   - scoped vehicle list
   - vehicle detail
   - onboard wizard
   - lifecycle transitions
   - hierarchy transfer
   - compliance documents
   - history and telemetry
5. Continue compliance/fines/handover evidence integrations.

Reason: Booking and Dedicated Entitlement establish the user demand/allocation behavior; Vehicle Management then provides fleet-manager inventory and operational administration without blocking employee booking delivery.

## Critique checklist

- No mock arrays remain on the production route.
- Caller identity cannot be spoofed.
- Fleet Manager cannot exceed hierarchy scope.
- Driver consent cannot be impersonated.
- Availability and commit use the same reservation semantics.
- UI never shows a booking number before consent commits.
- Loading/error/no-result/409 states are complete.
- Desktop/mobile/EN/AR/RTL evidence exists.

## Exit gate

8.2A passes when Employee self-booking and Fleet Manager on-behalf booking run end-to-end against the live backend, consent/booking-number atomicity is preserved, no static production booking data remains, all states are accessible and bilingual, and the mandatory critique round has no unresolved critical/high findings.
