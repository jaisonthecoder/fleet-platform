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
