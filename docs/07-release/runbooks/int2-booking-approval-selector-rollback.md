# Booking Approval Selector Promotion and Rollback

**Owner:** SRE with Booking and Workflow domain owners  
**Decision key:** `booking-approval-chain`  
**Workflow definition:** `legacy-booking-approval-v1`  
**Status:** Technically rehearsed; production promotion remains a human gate

## Purpose

Promote or roll back Booking approval routing without rewriting Booking history or in-flight workflow instances. Selector changes affect only decisions evaluated after the change. Existing workflow instances remain pinned to their immutable `definition_deployment_id`.

## Preconditions

- INT2-01 selector administration and comparison summary APIs are healthy.
- Caller is a `SystemAdmin` at the target scope or organization root.
- Booking and Workflow owners are present for canary/new-primary changes.
- The target `environment`, organization and optional scope are explicit.
- Current selector revision has been read immediately before update.

## Read Current State

`GET /api/v1/admin/decision-runtime/selectors/booking-approval-chain?environment=<env>&scopeNodeId=<uuid>`

Record:

- exact configured selector ID/revision;
- effective inherited mode and sample percentages;
- target organization/scope/environment;
- change ticket and operator.

Read parity evidence:

`GET /api/v1/admin/decision-runtime/comparisons/summary?decisionKey=booking-approval-chain&environment=<env>&scopeNodeId=<uuid>&sinceUtc=<iso>`

The endpoint returns aggregate mode/category counts only. It never returns subjects, correlations, facts, routes or values.

## Promotion Sequence

For each update, send `PATCH /api/v1/admin/decision-runtime/selectors/booking-approval-chain` with the latest `expectedRevision`.

1. `legacy-only`, canary `0`, comparison `0` — baseline.
2. `shadow`, canary `0`, comparison `100` — independent legacy remains primary; new route is effect-free.
3. Confirm zero unexplained `OUTPUT_DIVERGENCE` and `ERROR_DIVERGENCE` across approved scopes and unavailable-assignee tests.
4. `new-canary`, canary `10`, comparison `100`.
5. Increase canary only after latency/error/workflow-creation gates remain green.
6. `new-primary-with-legacy-shadow`, canary `100`, comparison `100`.
7. `new-only`, canary `100`, comparison `0` only after the observation and support gate.

## Immediate Rollback

Trigger rollback for any unexplained divergence, policy/runtime error increase, missing approver regression, duplicate workflow/task, Booking submit latency breach or provenance gap.

1. Read the selector and obtain the latest revision.
2. PATCH mode to `legacy-only`, canary `0`, comparison `0`, with that `expectedRevision`.
3. Verify the update response reports effective `legacy-only`.
4. Submit a controlled Booking and verify its `booking_policy_decision.provenance.source` is `legacy`.
5. Verify an in-flight workflow created before rollback retains the same instance ID, status and `definition_deployment_id`.
6. Verify no historical Booking, route step, workflow decision or comparison row was updated.
7. Keep comparison evidence for the configured retention window and open an incident review.

## Concurrency and Failure Handling

- A stale `expectedRevision` returns `409 decision-selector-revision-conflict`; reread before retrying.
- Selector write and audit record are one database transaction; audit failure rolls back the selector.
- Never use direct SQL for routine promotion/rollback.
- Never delete or rewrite in-flight workflow instances.
- If the administration API is unavailable, stop promotion. Existing mode continues; emergency direct DB action requires incident commander and database owner approval.

## Validation Checklist

- API health and PostgreSQL/Redis readiness.
- Selector effective mode matches exact target/inheritance expectation.
- Comparison summary has no unexplained divergence.
- Exactly one workflow instance and one submit command per Booking.
- Complete approval route; missing required assignee fails before workflow creation.
- SoD and delegation remain enforced.
- Booking/Workflow p95 and error rate within current SLO.
- Audit event `DOMAIN_DECISION_SELECTOR_CHANGED` exists.

## Observation and Legacy Removal

Do not remove the independent legacy adapter until all approved scopes are `new-only`, the rollback window has elapsed, retained comparisons are reviewed, and SRE/Booking/Workflow owners approve removal. Removing the adapter is a separate INT2-09 change with a CI direct-call guard and release evidence.