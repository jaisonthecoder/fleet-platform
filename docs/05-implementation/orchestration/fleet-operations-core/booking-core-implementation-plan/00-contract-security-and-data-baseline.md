# BOOKING-00 - Contract, Security and Data Baseline

> **Status:** `VERIFIED`
> **Verified:** 2026-07-24

## Objective

Freeze the contracts and persistence required for a secure live Booking journey before replacing the static frontend. Close or explicitly gate `G-0006` and `G-0007`; preserve the verified Vehicle bookability, eligibility, consent and exclusion-constraint behavior.

## Verified Evidence

- Migration `0044_booking_command_baseline` persists beneficiary, event-time scope, revision and the durable organization/actor/command/key ledger.
- Context, people, ID read/events and requester commands are Principal-aware; guarded HTTP proves unauthenticated and non-owner denial.
- Create, consent, submit, modify, extend and cancel enforce durable idempotency; mutable commands also enforce optimistic revision checks.
- Submit claims its command, locks the Booking, creates workflow instance/steps, links the Booking, records event/audit and completes the command in one transaction.
- PostgreSQL tests prove stable submit replay, complete rollback on injected audit failure and a fresh workflow after modification-requested, edit and re-consent.
- Employee self-booking is enabled. On-behalf remains fail-closed under `G-0006` and `D-SCOPE-PROVISIONAL`.

## On-Behalf Visual Contract

When, and only when, the beneficiary/scope/idempotency gates close, follow [23-booking-create-on-behalf.png](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/23-booking-create-on-behalf.png). BOOKING-00 must provide the contracts behind its mode selection, scoped Employee search, driver eligibility, trip facts, Vehicle options, submit consequences and SoD message. The emergency mode visible beside it remains disabled and routes to no operational action until B5 is approved.

## Scope

### Product and status contracts

1. Freeze legal Booking transitions and reject every other transition.
2. Add server-derived capabilities to the authorized Booking projection: `canModify`, `canConsent`, `canSubmit`, `canCancel`, `canExtend`, `canApprove`, `canOpenHandover` and stable blocking reasons.
3. Separate actor, requester, beneficiary and driver. Employee self-booking may set all person roles equal; on-behalf cannot be released until the distinct beneficiary contract and audit evidence exist.
4. Persist direct/effective Booking scope or immutable event-time scope evidence. Vehicle assignment alone is insufficient historical evidence after transfers.
5. Freeze stable reason codes and their safe UI exposure. Raw HR, licence, audit IP/device and policy facts remain masked.

### API contracts

1. Add `GET /v1/bookings/context` with actor summary, self/on-behalf modes, default person/scope, legal consent metadata and dependency status.
2. Expose the existing `bookablePeople()` projection as `GET /v1/bookings/people`, initially bounded and then cursor-paged/searchable before large rollout.
3. Make `GET /v1/bookings/:id` and `/events` Principal-aware and owner/scope protected.
4. Make consent and submit require a linked Principal and authorize the current actor against persisted Booking state.
5. Return opaque not-found behavior for unauthorized IDs where the platform convention requires it.
6. Add an optimistic revision to mutable Booking commands.

Register static collection routes such as `/bookings/context`, `/bookings/people` and `/bookings` before `/bookings/:id`, and add HTTP tests proving that `context` and `people` are never parsed as Booking IDs.

### Database

Add only after contract review:

- nullable beneficiary and event-time scope columns with a backfill rule for existing self bookings;
- a Booking revision or equivalent compare-and-swap field;
- `booking_command_ledger` with organization, actor, command type, idempotency key, payload hash, result reference, timestamps and a unique organization/actor/command/key constraint;
- indexes supporting people search and the later owner/scope Booking list.

Do not commit a consent-template table in this phase until Legal/Privacy and Architecture choose the approved content store. Freeze a `ConsentTemplateProvider` contract with version, language, content hash, effective time, retirement and outage behavior; the selected persistence implementation is then delivered before BOOKING-02.

Migration tests must cover fresh apply, idempotent rerun, constraints, backfill and old-code/read compatibility.

## Authorization Matrix

| Action | Employee | Fleet Manager/Cluster/Group lead | SystemAdmin | Approver/delegate |
|---|---|---|---|---|
| Availability/context | Own authorized scope | Managed scope | No operational mode | Own context only if also Employee |
| People options | Self only | Active persons in managed closure | No operational expansion | Self unless Fleet role also held |
| Create self | Yes | Yes when also valid Employee | No solely by role | Yes when also valid Employee |
| Create on behalf | No | After beneficiary/scope/idempotency gates | No | No unless Fleet role also held |
| Read/events | Own | Managed closure | Audited admin read only if separately approved | Assigned evidence only |
| Consent | Persisted driver only | Persisted driver only | Never by role | Persisted driver only |
| Submit/modify/cancel | Owner; state-gated | Managed closure; explicit on-behalf evidence | No | No unless owner/Fleet role |

## Tests

1. Guarded HTTP: unlinked, inactive, foreign organization, sibling scope, spoofed requester/driver, non-owner ID read/events/consent/submit.
2. Database side effects: every denied command creates no Booking/event/audit/outbox/command-ledger row.
3. Role composition: unrelated roles cannot widen Fleet closure; `SystemAdmin` alone remains denied.
4. On-behalf: distinct actor/requester/beneficiary/driver and event-time scope survive read/audit projection.
5. Idempotency: same key/same payload returns original result; same key/different payload returns stable conflict.
6. Contract drift: backend Zod/OpenAPI and frontend schemas agree.
7. Route precedence: collection/static routes resolve correctly alongside `/:id` routes.

## Exit Gate

- `G-0006`, `G-0007` and `D-SCOPE-PROVISIONAL` are closed or on-behalf remains disabled.
- Every public Booking operation is Principal-aware.
- Contract, migration, unit, guarded HTTP and real-PostgreSQL tests pass.
- No frontend production route is edited in this phase.
