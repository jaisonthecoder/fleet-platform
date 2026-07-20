# 8.5 - Entitlement Eligibility and Approval Workflow

## Objective

Migrate dedicated-vehicle eligibility and entitlement approval routing with authoritative facts, separate provenance and immutable workflow-definition pinning.

Backend migration alone does not complete the business journey. [8.5A - Live Dedicated Vehicle Journey](05a-live-dedicated-vehicle-journey.md) is required for the employee request, approval evidence, consent, Fleet Manager allocation and BSD user flows.

## Owners and dependencies

- Primary: Entitlement and Workflow Backend owners
- Contributors: HR, Cluster owners, Security/SoD, QA
- Depends on: 8.1 and workflow-definition foundation
- Human gate: D8 eligibility criteria and approval-route owners

## Eligibility

Replace grade proxy when authoritative HR eligibility facts exist. Fact assembler records request type/duration, employee grade/role/business unit, organization/location scope, employment/licence status and freshness. Missing location/home scope is an explicit data-quality failure.

## Route and workflow

`entitlement-approval-chain` returns typed assignment descriptors. Import `legacy-entitlement-approval-v1`; compare current/new routes in shadow. Pin definition deployment/version, route decision provenance, hierarchy generation and scope on instance start.

## Persistence

Separate eligibility and approval-route provenance; do not overwrite one `policyVersion`. Persist consent/allocation evidence and workflow linkage. Re-review/modification cycles retain prior instances and start a new pinned cycle.

## SoD/delegation

Requester/delegate cannot approve own entitlement. Validate assignment at resolved scope and one-hop delegation. Concurrent decisions and duplicate submit/start are idempotent.

## Tests

D8 allow/deny boundaries, stale/missing facts, scoped inheritance, eligibility/route provenance, route parity, no approver, SoD-02, delegation, modify/resubmit, consent/allocation guards, restart/concurrency and rollback with in-flight requests.

## Rollout

Eligibility shadows before route/workflow. Canary approved organization scope, then wider scopes. Legacy instances drain; no in-place migration.

## Rollback

Return new entitlement submissions to legacy eligibility/route selectors. Versioned in-flight workflow instances continue pinned and existing eligibility/consent/allocation evidence is untouched. New schema remains additive.

## Critique checklist

Check eligibility proxy facts, provenance overwrite, runtime-built definitions, self/delegate approval, orphaned instances and allocation before consent/workflow approval.

## Exit gate

8.5 passes when separate decisions and workflow definitions are fully attributable, parity/SoD/delegation/consent tests pass and selectors can roll new requests back without affecting in-flight instances.

The complete dedicated-vehicle capability is not user-complete until 8.5A passes.
