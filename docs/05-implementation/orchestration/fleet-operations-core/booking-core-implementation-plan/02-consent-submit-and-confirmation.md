# BOOKING-02 - Consent, Submission and Confirmation

> **Status:** `VERIFIED_GOVERNED_CONSENT_LOCAL`
> **Updated:** 2026-07-29
> **Target-environment gate:** Create accepted EN/AR wording in Consent management and activate it through maker-checker. The source and workflow are implemented.

## Objective

Complete the core Employee loop from a reviewed Draft through authenticated driver consent, atomic number/reservation issuance, exactly-once approval submission and persisted confirmation.

## Entry Criteria

- BOOKING-01 live Draft is verified.
- Consent/legal owner approves the template/version/retention contract.
- Driver identity is persisted and Principal-bound.
- Durable idempotency is available for consent and submit.

## Mandatory Visual Source

The consent and confirmation screens are approved business-derived states in [mockup-review.md](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/mockup-review.md) and specified in [derived-screen-contracts.md](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/derived-screen-contracts.md). They extend screen [21](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/21-booking-employee-book-a-vehicle.png) without changing its visual language.

The consent state must be an inline Sheet/Dialog after Vehicle review. Confirmation must show persisted number/status, Vehicle/window, next approval step, handover guidance, calendar action and My Bookings link. These states are not permission to invent legal text, approval actors or success.

## Backend Work

1. Replace the frontend's hard-coded `booking-consent-v1` with a server-authoritative template/version/content-hash projection.
2. Resolve the effective consent version again inside the consent command. A changed version returns `409 consent-version-changed` with no consent, number or reserving state.
3. Require the authenticated Principal person to equal the persisted driver. No Fleet or admin role substitutes consent.
4. Re-run eligibility and Vehicle bookability immediately before reserving.
5. Preserve the existing single transaction for consent record, lifecycle event, booking number, reserving status, Booking event, audit and outbox.
6. Store only approved device/signature evidence; do not trust a client-supplied IP when server transport metadata is available.
7. Deduplicate consent by organization/driver/Booking/key and payload hash.
8. Make submit exactly once. Eliminate the workflow-orphan window using the approved boundary: either pass the same Drizzle transaction executor through Workflow persistence, or commit an idempotent `StartBookingApproval` outbox command and attach its result through a revision-checked consumer. Merely calling `workflow.start()` inside a callback is not atomic if it uses its own database handle.
9. Persist approval route and workflow identifiers only after the exactly-once boundary succeeds.
10. On timeout, allow the client to query the existing Booking before retrying.
11. Propagate the request correlation ID through Booking events, decision provenance, audit, command ledger and outbox; do not generate disconnected IDs for each layer.

## Frontend Work

1. Render the approved inline consent Sheet/Dialog after Draft creation.
2. Display requester, driver, Vehicle, window, destination, template version and material-change warning.
3. Require an explicit agreement control; disable dismissal and duplicate actions while committing.
4. On version conflict, replace the legal content, focus the change notice and require fresh agreement.
5. On Vehicle overlap, retain search data, return to live results and do not display a number.
6. After consent and submit, display only persisted Booking status, number, next step, handover guidance and My Bookings link.
7. If actor and driver differ in a later on-behalf release, show `Awaiting driver consent`; do not provide actor impersonation.

## Tests

- Authenticated driver versus requester/Fleet/non-driver consent matrix.
- Eligibility deny and Vehicle deterioration between Draft and consent.
- Injected failures at consent, number, event, audit and outbox writes: all roll back.
- Concurrent overlapping consent: exactly one reservation; loser remains Draft without number/consent.
- Consent version change and duplicate key/payload conflict.
- Duplicate submit and submit race: one workflow/domain effect.
- Workflow-boundary failure before/after commit: reconciliation produces one attached workflow and no orphan instance.
- Frontend consent, conflict recovery, timeout reconciliation and persisted confirmation.
- Browser complete Employee search -> Draft -> consent -> submit in EN/AR and mobile/desktop.

## Exit Gate

A real Employee receives a booking number only after committed consent and sees the persisted Pending Approval state. Duplicate retries create no second consent, number, reservation or workflow.

## Technical Baseline Evidence

- `ConsentTemplateProvider` is server-authoritative and fails closed outside tests. Test content is isolated under `test/support`; no unapproved legal body ships in production source.
- Context projects status/version/hash/effective time/content. Local and production return `PENDING_APPROVAL`; the UI saves a Draft but renders no signing action.
- Consent rejects unavailable or changed templates before side effects and resolves the effective version again inside the transaction.
- Principal-bound driver authority, eligibility and Vehicle bookability are rechecked. Fastify transport IP replaces any client-supplied IP.
- Consent record, lifecycle event, booking number/reserving state, Booking event, audit, outbox and command result commit atomically. Injected outbox failure rolls all state back and the same key retries successfully.
- Submit uses the BOOKING-00 shared transaction boundary. The UI uses distinct stable consent/submit keys, explicit agreement, non-dismissible busy phases, 5xx reconciliation and resumed submit after an ambiguous committed consent.
- Confirmation uses persisted number/status/window, selected Vehicle details, approval/handover guidance and a calendar download. My Bookings remains explicitly unavailable until BOOKING-04.
- Evidence: API focused `70/70`; guarded HTTP/PostgreSQL/concurrency/Handover `22/22`; UI `19` files / `86` tests and build; typecheck/lint/contracts/organization/dependency guards pass.
- Live `localhost:5173` Employee check against the real local API saved a Draft, displayed the pending Legal/Privacy gate and exposed zero consent-signing actions.
- Two rigorous critique rounds completed. Genuine findings (test-content isolation, transport IP, explicit consent phases, ambiguous-response reconciliation and calendar/Vehicle confirmation) were repaired. Repeated broad-role and idempotency-format recommendations were rejected because persisted-driver identity and opaque command-scoped keys are the controlling contracts.

## Governed Consent Closure

Migrations `0054`/`0055` and `/:lang/admin/consents` now provide the application-owned source, immutable EN/AR version/hash, effective time, retirement process, maker-checker activation, audit evidence and fail-closed outage behavior. Local version `booking-operational-ack-v3` is Active.

For UAT/production, the organization reviews its exact wording and a different SystemAdmin activates the accepted Draft. This is a deployment/governance action, not missing application functionality or integration. See [Consent Governance](../CONSENT-GOVERNANCE.md).
