# 8.3 - Booking Approval and Workflow Definition Migration

## Objective

Migrate booking approval routing from runtime-built unversioned chains to a policy route decision that starts an immutable deployed workflow definition and pins complete organization/scope/decision lineage.

## Owners and dependencies

- Primary: Workflow and Booking Backend owners
- Contributors: Architecture, Security/SoD, QA, SRE
- Depends on: 8.1 and workflow-definition foundation from Phase 6
- Blocker: immutable workflow definition/version/deployment storage must exist

## Foundation

Create/import `legacy-booking-approval-v1` definition matching current route semantics. Add workflow definition/version/deployment and append-only workflow event contracts if not yet delivered by Phase 6. Existing instances remain legacy and drain.

## Route decision

`booking-approval-chain` returns typed assignment descriptors, not arbitrary role strings. Facts include duration, requester context, cross-cluster indicator and scope. Resolve assignees at the decision-resolved scope with one-hop delegation and SoD checks.

## Instance pinning

Store workflow definition version/deployment, organization, requested/resolved scope, hierarchy generation, route-policy provenance and correlation on instance start. Re-submission starts a new cycle while preserving prior instance history.

## Idempotency/concurrency

Formal command/idempotency key for submit/start. Lock or unique constraint prevents duplicate active instances. Step decision races use optimistic lock/event sequence. Completion emits idempotent domain command/event.

## Shadow parity

Compare current runtime route and new deployed-definition route without creating a second instance. Differences include role descriptors, assignee IDs, order, SLA and unavailable-assignee behavior.

## Tests

Definition lifecycle, import parity, submit idempotency, restart, concurrent submit/decision, delegation one-hop, SoD self-approval, modification/resubmit cycles, hierarchy/role change after start, pinned lineage and rollback with in-flight instances.

## Rollback

New instances selector returns to legacy route/start; already-started versioned instances continue pinned. Never rewrite active instances.

## Critique checklist

Check route decisions are not effectful, definition/version actually persists, in-flight instances ignore later policy changes, unavailable assignees fail explicitly and dual execution does not duplicate tasks.

## Exit gate

8.3 passes when new booking instances are definition-pinned, legacy/new route parity is approved, concurrency/idempotency/SoD/delegation tests pass and rollback leaves both legacy and versioned instances operable.
