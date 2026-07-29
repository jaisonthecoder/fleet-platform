# Agent Context Pack - CORE0-BOOKING

| Field | Value |
|---|---|
| Program/phase | Fleet Operations Core / CORE-0 |
| Workstream | `CORE0-BOOKING` - Booking authority and journey baseline |
| Task type | Exploration/documented reconciliation |
| Status | `READY` |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Worktree/branch | Main workspace, read-only |
| Implementer | Generic isolated subagent |
| Independent reviewer | Assigned after reconciliation |

## Business Outcome

Establish the smallest safe path from the current booking backend and static UI to basic live B1-B4 journeys, without beginning UI work before approved mockups or prematurely implementing full O4/O6.

## Scope

- Trace booking create, availability, consent, submit, approval state, modify/re-consent, extend, cancel and completion.
- Inspect authenticated Principal propagation, actor/requester/beneficiary/driver modeling, ownership, on-behalf authority, organization/scope checks and System Administrator restrictions.
- Reproduce/explain the missing `assertCreateAuthority` compile defect and stale constructor test from source; do not repair it.
- Reconcile source/tests against phases 9-12, Phase 8.2/8.2A/8.3 and Phase 19 Pool Booking matrix.
- Identify exact backend contracts the future approved UI will consume.

## Explicit Exclusions

- Do not edit any file or fix the compile error.
- Do not implement or redesign `/booking`; mockups are not yet approved.
- Do not start 8.3 or full O4/O6.
- Do not repeat the false claim that `BookingService.modify()` is absent; it exists and evaluates re-consent tolerance with provenance.

## Controlling Sources

- `docs/implementation-plan/booking_and_vehiclemanagement/09-live-pool-booking-foundation.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/10-booking-availability-eligibility-consent-and-submit.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/11-booking-approval-and-fleet-operations.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/12-my-bookings-changes-and-completion.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/19-traceability-and-completion-matrix.md`
- `docs/05-implementation/decision-and-workflow-platform-plan/phase-8-domain-migration/02-booking-value-and-reconsent-decisions.md`
- `docs/05-implementation/decision-and-workflow-platform-plan/phase-8-domain-migration/02a-live-booking-user-journey.md`
- `docs/05-implementation/orchestration/fleet-operations-core/DECISION-REGISTER.md`

## Current Implementation Anchors

- `app-api/src/modules/bookings/**`
- Booking/consent/workflow schemas and migrations under `app-api/src/common/database/schema/**` and `app-api/drizzle/migrations/**`
- `app-api/test/booking.int-spec.ts`, authorization/hierarchy tests and related fixtures
- `app-api/src/common/auth/**` and `app-api/src/modules/platform/services/scope-authorization.service.ts`
- `app-ui/src/features/booking/**`, typed API hooks/contracts, routing and mocks

## Known Verified Facts

- `BookingService.modify()` exists and implements re-consent evaluation/provenance.
- Booking overlap exclusion exists and migration testing through `0028` passed.
- `BookingService` calls a missing `assertCreateAuthority()` and current typecheck fails.
- The controller drops Principal on important create/availability paths and UUID operations need ownership/org review.
- The production booking route is still static/mock-driven; no UI edits are authorized.

## Contracts and Boundaries

- Apply D-SEQ-001 minimum authorization floor now; defer broad O4/O6 propagation.
- Never trust actor or organization identifiers supplied in the request body.
- Consent, booking number, reservation and provenance atomicity remain non-negotiable.
- Compatibility workflow behavior may remain until CORE-3/INT-2, but must be accurately labeled.

## Required Output

1. Endpoint/action authorization matrix with current enforcement and gaps.
2. B1-B4 capability matrix with code/test evidence.
3. Root-cause explanation for compile/unit failures.
4. Exact first implementation slice, owned files, tests and disconfirming check.
5. Backend contract list needed for mockup review and future UI wiring.
6. Dependencies that genuinely require Vehicle, workflow, policy or user decisions.

## Readiness Instruction

Begin by restating the outcome, boundaries and inspection strategy. Then perform the read-only investigation. Do not edit or invoke repository `ai-*` agents.
