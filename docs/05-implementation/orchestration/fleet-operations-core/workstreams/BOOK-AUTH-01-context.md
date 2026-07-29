# Agent Context Pack - BOOK-AUTH-01

| Field | Value |
|---|---|
| Parent phase | CORE-2 prerequisite |
| Outcome | Restore Booking compilation and enforce a secure self-service authorization floor. |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Status | `READY` |
| Agent | Generic isolated implementation agent |

## Scope and Ownership

May edit only:

- `app-api/src/modules/bookings/controllers/bookings.controller.ts`;
- `app-api/src/modules/bookings/controllers/bookings.controller.spec.ts`;
- `app-api/src/modules/bookings/services/booking.service.ts`;
- `app-api/src/modules/bookings/services/booking.service.spec.ts`;
- `app-api/src/modules/bookings/repositories/bookings.repository.ts` only if an existing projection cannot support a required check.

Do not edit shared contracts, integration fixtures, schemas/migrations, workflow/policy implementation, Vehicle files, UI or orchestration records. If a public-contract change is required, stop and return it to the orchestrator as a separate prerequisite.

## Required Behavior

1. Pass `Principal` to availability and all self-service Booking operations in scope.
2. Implement `assertCreateAuthority` using persisted organization/person/vehicle scope facts.
3. Initial mode is self-service: linked active person must equal requester and driver; on-behalf is denied using an existing authorization response until D-SCOPE-PROVISIONAL and G-0006 close.
4. Bind consent to the authenticated driver; deny impersonation.
5. Enforce owner and same-organization access for get/events/submit/modify/extend/cancel.
6. Preserve approval behavior, 8.2 decisions/provenance, overlap, consent/number atomicity and `modify()` re-consent behavior.
7. Do not claim full O4/O6, on-behalf, B3 workflow or UI completion.

## First Hypothesis and Check

Hypothesis: propagating Principal and implementing self-service checks fixes compilation and blocks spoofed actors without changing valid self-booking.

Falsifying case: employee A creates a Booking naming employee B as requester/driver. Expected `403` with no booking/event/audit/outbox or policy evaluation.

First focused check after the first substantive edit:

```powershell
pnpm --filter fleet-platform-api typecheck
```

Then run Booking controller/service unit suites. Post-integration validation runs Booking HTTP/integration tests against a migrated, unseeded database after FIX-FIXTURES-01A/01B, including database assertions that denied operations create no booking/event/audit/outbox writes.

## Acceptance

- Focused unit tests pass; repository typecheck passes after integration with independently owned compile repairs.
- Existing valid Booking unit behavior remains green.
- New negative tests cover unlinked, spoofed requester/driver, cross-org/resource, non-owner read/action and consent impersonation.
- Self-booking remains functional.
- Post-integration negative HTTP/database assertions pass for spoofing, cross-org/resource access, non-owner actions and consent impersonation.
- Handoff records exact commands, commit, environment and results.

## Readiness Response

Before edits, report understanding, authority matrix, exact expected files, first check and any missing persisted fact. Edits are authorized only after orchestrator approval.
