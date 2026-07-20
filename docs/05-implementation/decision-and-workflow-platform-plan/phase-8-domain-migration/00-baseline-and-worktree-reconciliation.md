# 8.0 - Baseline and Worktree Reconciliation

## Objective

Freeze a trustworthy Phase 8 starting point before accepting further domain changes. Review the partial BookingService/migration `0023` work, inventory every PEP and workflow call, capture current behavior and separate intended changes from accidental drift.

## Owners and dependencies

- Primary: Backend Engineer and QA
- Reviewers: Architecture, Database, Security, domain owners
- Depends on: O6 complete
- Human gate: booking business behavior and workflow migration assumptions

## Work items

1. Diff and review all unverified Phase 8 files, especially BookingService, BookingsRepository, booking schema/migration `0023`, tests and policy seeds.
2. Run complete backend/frontend/static/migration baseline before accepting edits.
3. Produce the canonical PEP inventory: decision key, consumer, facts, scope source, effective time, output, fallback, side effects, persistence and tests.
4. Freeze golden outputs for every current seed row/default and structural hard-block scenario.
5. Confirm rule catalog reconciliation: 13 registered keys; classify active, missing seed, unused and duplicate-authority rules.
6. Record open decisions: re-consent historical version, hard-block policy boundary, workflow definition prerequisite, cross-cluster rules and advisory fail behavior.
7. Confirm migration journal allocation after `0023`; no migration numbers are reserved until implementation.

## Required evidence

- Clean baseline command outputs.
- Reviewed worktree-diff record for partial booking changes.
- Consumer and seed matrix.
- Golden fixture corpus with stable expected outputs/reasons.
- Open-decision register with owners/dates.

## Tests

Full unit/integration/E2E/migration tests; contract drift; direct evaluator grep; hardcoded threshold grep; schema/provenance audit query.

## Rollback

If partial Booking edits fail review, revert only those Phase 8 changes while preserving completed O0-O6 work. Migration `0023` is additive; an empty JSONB column may remain during rollback but must not be claimed as completed provenance.

## Critique checklist

Look for hidden behavior changes, stale seed assumptions, tests that assert implementation rather than behavior, and fields added without consumers/backfill.

## Exit gate

8.0 passes when the baseline is green, every current decision/workflow consumer is accounted for, partial booking work is accepted or removed, and no downstream sub-phase must infer current behavior.

## Implementation status - complete

- Partial Booking migration and `0023_booking_policy_provenance` are accepted after repairing scope-aware unit/integration fixtures.
- Booking fails closed when a vehicle has no active hierarchy scope; unit evidence added.
- Booking integration vehicles now carry persisted hierarchy assignments; full booking loop/double-book/hard-block/availability tests pass.
- Current consumer inventory: Booking 4 decisions; Compliance 1; Entitlement 2; Fines 2; Handover 1. Workflow starts remain in Booking and Entitlement.
- Hidden fallback inventory: Booking migrated to typed fail-closed; Entitlement route/eligibility, Fines thresholds/timeframes and Handover fuel threshold remain direct/unscoped and are owned by 8.4-8.7.
- Registered policy inventory remains 13 keys; `driver-eligibility` and alert-ladder consumer status are reconciled in 8.8.
- Migration journal through `0023` and fresh/idempotent migration gate pass.

Critique disposition:

- Historical Booking provenance backfill is a valid gap and is assigned to the 8.1 shared provenance migration.
- Shared adapter/shadow schema/feature selector are 8.1 deliverables, not baseline defects.
- Workflow definition/version/scope pinning and delegation validation are explicit 8.3/8.5 gates.
- Domain provenance gaps are owned by their respective sub-phases and are now fully inventoried.

8.0 is complete. 8.1 shared decision adapter/provenance/shadow implementation is active.
