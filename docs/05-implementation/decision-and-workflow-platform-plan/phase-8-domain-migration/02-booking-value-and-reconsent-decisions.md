# 8.2 - Booking Value and Re-Consent Decisions

## Objective

Migrate booking buffer, maximum duration and consent re-consent tolerance using server-derived vehicle organization/scope and booking effective time, complete provenance and explicit failure behavior.

## Owners and dependencies

- Primary: Booking Backend owner
- Contributors: Policy owner, Legal/Consent, Database, QA
- Depends on: 8.1

## Scope

- `booking-buffer`
- `max-booking-duration`
- `consent-re-consent-tolerance`

Approval routing is intentionally deferred to 8.3.

## Fact assembly

Load vehicle organization and effective hierarchy assignment from persistence. Normalize vehicle class, booking duration and change facts (driver/vehicle/category/window shift). Resolve facts once; both legacy/new paths receive the same normalized immutable input.

## Behavior

- Buffer and duration must return typed numeric values in allowed ranges.
- Re-consent must return the approved typed tolerance model; Legal decides whether modification uses original-booking policy or modification-time policy. Persist that decision.
- Invalid/missing fail-closed results raise stable explainable errors; no zero/default minutes.
- Availability and reservation use the same resolved buffer.

## Persistence

Persist separate provenance entries for buffer, duration and re-consent including effective-at and requested/resolved scope. Preserve compatibility `policyVersion` only as a transitional projection, never as the sole lineage.

## Atomicity

Decision occurs before transaction where safe; transaction persists domain row/provenance/event/audit/outbox atomically. Modification that requires re-consent voids consent and workflow linkage in the same transaction.

## Tests

Golden row/default parity, exact/ancestor/default scope, boundary duration/buffer, vehicle reassignment at effective time, malformed output/fail-safe, concurrent overlap, re-consent material/nonmaterial changes, policy change between create/modify, provenance persistence and rollback selector.

## Rollout

Shadow buffer/duration first, then low-percentage canary. Re-consent requires Legal acceptance before primary mode. Keep legacy selector during observation.

## Rollback

Return the affected decision selectors to legacy-only. New provenance columns/envelopes remain additive and readable. Existing bookings retain values/provenance already committed; rollback never recalculates reservation ranges or restores voided consent automatically.

## Critique checklist

Look for implicit defaults, duplicate fact reads, inconsistent effective time, provenance overwrite, consent/workflow orphaning and different availability/commit buffers.

## Exit gate

8.2 passes when all three decisions use the shared adapter, have approved parity/intentional differences, persist separate lineage, handle failures explicitly and pass booking atomicity/regression gates.

## Implementation status - complete

- `booking-buffer`, `max-booking-duration`, and `consent-re-consent-tolerance` use the shared `DomainDecisionService` selector/shadow/canary boundary.
- Organization, active vehicle scope, effective booking time and immutable normalized facts are derived server-side.
- Missing vehicle scope/category and malformed/out-of-range typed policy values fail closed with stable reason codes; no numeric defaults remain.
- Booking creation persists separate buffer/duration provenance; modification persists buffer/duration/re-consent provenance.
- Migration `0028_booking_policy_decision_history` adds append-only, organization-consistent decision evidence so modification never erases create-time lineage.
- Domain comparison subject and correlation references are fingerprinted; environment is persisted explicitly.
- Consent/workflow clearing remains atomic with material modification and no workflow command is emitted by shadow evaluation.

### Critique findings closed

- Bounded buffer (0-240 minutes), maximum duration (0.25-168 hours), and re-consent tolerance (0-1440 minutes).
- Unknown/missing vehicle category no longer silently maps to pool.
- Append-only provenance history prevents current-row JSON projection from becoming the only lineage.
- Integration teardown preserves FK order for append-only evidence.
- Migration journal timestamp ordering fixed so `0028` applies on fresh and existing databases.

### Verification evidence

- Focused Booking/rules/adapter: 39 tests passed.
- Full backend unit suite: 255 tests passed.
- Booking live integration: 4 tests passed, including append-only buffer/duration evidence.
- Migration through `0028`: forward and idempotency passed.
- Typecheck, lint, dependency, organization and contract guards, and SWC build passed.

Approval routing remains intentionally unchanged and is owned by sub-phase 8.3.

The production `/booking` route remains a static mock until [8.2A - Live Booking User Journey](02a-live-booking-user-journey.md) passes. Backend policy migration alone does not complete the employee workflow.
