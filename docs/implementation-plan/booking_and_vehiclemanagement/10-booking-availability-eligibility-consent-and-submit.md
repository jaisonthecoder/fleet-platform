# Phase 10 (B2) — Availability, Eligibility, Selection, Consent and Submission

## Objective

Complete the core under-two-minute booking loop through live availability, eligible vehicle selection, immutable consent, booking-number issuance and approval submission.

## Dependencies

V2 registry summary contract, V3 booking-pool/lifecycle, V4 compliance/telematics state, B1 actor authority, policy decision foundation.

## Mandatory mockup gate — ask before implementation

Request: Window step; loading/results; buffer-unavailable/free-from; eligibility-block banner; no-results/waitlist offer; vehicle cards/recommendation; inline Consent Sheet EN/AR; policy refresh/re-consent warning; confirmed/pending-approval state; mobile stepper.

## Availability

Server derives authorized scope/people and queries only lifecycle-active, booking-pool-included, compliant, suitable vehicles. Apply buffer and reservation overlap using one authority. Show unavailable/free-from rather than lying or hiding where required. Filter category/seats; rank suitability/proximity/fuel only from real data, with deterministic non-AI fallback.

## Eligibility

Run driver+vehicle gate before results/selection confirmation. Fail safe on stale/unavailable facts. Explain employment/licence/black-points/behaviour/vehicle registration/insurance blocks with stable remediation reasons. No UI-only eligibility.

## Draft/consent ordering

The recommended business flow is logically select → consent → confirm; implementation may create a server Draft before consent for idempotency, but no booking number, active reservation or approval workflow exists until the consent transaction. Returning to Window/Vehicle discards or invalidates consent when material facts change.

## Consent

Versioned EN/AR text; actual driver identity; vehicle/category/window/policy; explicit agreement; timestamp/device/IP/signature ref; policy text refresh if version changes. Consent and booking number/reservation status commit atomically. No role override.

## Submit/confirmation

Submit starts approval exactly once, shows booking number and Pending Approval state, handover instructions, calendar action and links to My Bookings. Notification to requester/driver/approver/Fleet Manager follows transaction via outbox.

## Waitlist entry point

If no vehicles, offer widening window and waitlist enrollment. Full auto-allocation is B5; never show a false confirmed booking.

## Database/backend

Availability query indexes; consent/version/lifecycle evidence; atomic number/reservation; eligibility decision evidence; append-only policy provenance; idempotent consent and submit; outbox.

## Tests

Buffer boundaries, overlap concurrency, compliance hard blocks, policy failure, category/seats, consent atomicity, version refresh, back navigation, duplicate click, no-result/waitlist, actor/driver identity, response latency/load and browser E2E.

## Rollback

Selector rollback to legacy decisions; UI capability flag; committed bookings retain values/provenance. Never remove consent or recalculate ranges.

## Mandatory critique

Look for availability/commit mismatch, consent after approval, fail-open eligibility, duplicate number/workflow, fake recommendation/location/fuel, stale policy text, inaccessible consent and hidden waitlist.

## Exit gate

A real eligible user can complete search → select → consent → submit and see a persisted Pending Approval booking; blocked/no-vehicle cases are explainable and recoverable.
