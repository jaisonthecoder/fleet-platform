# Phase 1 — Shared Domain Contracts and Data Foundation

## Objective

Freeze the cross-domain contracts and database invariants required before Vehicle Management, Pool Booking or Dedicated Entitlement UI can safely write live data.

## Dependencies

- Phase 0 approved
- Organization hierarchy O0–O6 and policy/workflow foundations
- No UI mockup required; contract review required

## Shared identity and scope

- Every resource carries organization and effective hierarchy scope.
- Principal organization and authorized scope closure are server-derived.
- Person roles are scoped and effective-dated.
- Requester, beneficiary, driver, approver, allocator, handover actor and on-behalf-of person are separate fields.
- Cross-organization references are rejected by composite constraints.

## Shared lifecycle contracts

- Vehicle lifecycle and operational status are distinct.
- Booking-pool inclusion is independent of lifecycle but constrained by lifecycle/body type/compliance.
- Booking, entitlement, handover and workflow states use stable enums/codes.
- History is append-only; current tables are projections.
- Effective dates/timezone and concurrency revision are explicit.

## Shared evidence/provenance

- Policy requested/resolved scope, immutable version IDs, matched row, reasons and fact fingerprint.
- Workflow definition/deployment/version and task actor/delegation.
- Audit correlation ID and outbox event ID.
- Consent version, language, timestamp, driver, vehicle/category/window, device/IP/signature reference.
- Raw sensitive facts are not stored in shadow-comparison evidence.

## Database invariants

- Vehicle VIN/chassis and organization+plate uniqueness.
- Effective vehicle hierarchy assignment has no overlaps.
- Booking active reservation ranges do not overlap for a vehicle.
- Consent/booking number/allocation atomic gates.
- Dedicated allocation prevents conflicting active entitlements.
- Device pairing, substitute-driver and BSD windows do not overlap illegally.
- Cross-table organization consistency.
- Append-only state/evidence tables protected against mutation where required.

## API conventions

RFC-7807 errors with stable reasons; Zod/class-validator input schemas; optimistic revisions; idempotency keys for commands; typed pagination/filtering; correlation IDs; server-side authorization; no direct `fetch` in React components.

## Frontend foundations

Typed contracts, TanStack Query keys, route guards, scope-aware caches, unsaved-change protection, shared state/status/empty/error patterns, EN/AR/RTL, 44px targets, keyboard operation and real-browser validation.

## Tests

Schema/migration fresh+upgrade+rollback; property tests for state machines; cross-org/scope tests; concurrency and idempotency; contract drift; audit/outbox atomicity; accessibility foundations.

## Rollback

Only additive storage/contracts until consumers cut over. Compatibility adapters remain until final cutover; never rewrite historical evidence.

## Mandatory critique

Look for overloaded actor IDs, implicit scope, silent defaults, nullable audit fields, non-atomic consent/allocation, cross-org leakage and UI/backend schema divergence.

## Exit gate

Shared contract matrix, invariants, reason codes, state machines and migration sequence approved by DB/BE/FE/Security/QA.
