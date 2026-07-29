# Agent Context Pack - BOOK-AUTH-HTTP-01

| Field | Value |
|---|---|
| Parent phase | CORE-2 prerequisite |
| Outcome | Add HTTP and database-side-effect evidence for the Booking self-service authorization floor. |
| Starting commit | Integration commit containing verified FIX-FIXTURES-01A and BOOK-AUTH-01 |
| Status | `BLOCKED_BY_01A_AND_BOOK_AUTH` |
| Agent | Generic isolated implementation agent |

## Dependencies

- FIX-FIXTURES-01A must freeze the shared hierarchy helper.
- BOOK-AUTH-01 must integrate the self-service authorization behavior.

## Scope and Ownership

May edit only:

- `app-api/test/booking.int-spec.ts` after FIX-FIXTURES-01A releases ownership;
- one new Booking-specific HTTP integration spec under `app-api/test/` only if the existing suite cannot exercise authenticated HTTP boundaries cleanly.

Do not modify the shared fixture helper, Booking production source, contracts, migrations, other integration suites, UI or orchestration records.

## Required Evidence

1. Spoofed requester/driver is denied.
2. Unlinked identity is denied.
3. Cross-organization vehicle/booking access is denied.
4. Non-owner read, events, submit, modify, extend and cancel are denied.
5. Consent signed by anyone other than the persisted driver is denied.
6. Denied create/action produces no unauthorized booking/event/audit/outbox writes; denied create does not invoke policy evaluation where test instrumentation can prove it.
7. Valid same-person self-booking remains green.

## Validation

Run the owned Booking integration/HTTP suite against migrated, unseeded storage, then repository typecheck and the combined integration suite after FIX-FIXTURES-01B completes.

## Readiness Response

Do not start until both dependencies are verified and file ownership is explicitly transferred. Then report exact tests, database assertions, fixture API usage and first falsifying check.