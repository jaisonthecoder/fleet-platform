# Phase 11 (B3) — Booking Approval, Delegation and Fleet Operations

## Objective

Deliver the approval route and Fleet Manager operational queues after a booking is submitted, with immutable workflow/version/scope evidence and exactly-once effects.

## Mandatory mockup gate — ask before implementation

Request: Approval Inbox queue/evidence/decision; delegated/on-behalf banner; SLA/escalation; request-change/decline reasons; Fleet Manager booking queue/day preparation; on-behalf booking indicators; assignment/mediation states; mobile/RTL.

## Approval policy/workflow

`booking-approval-chain` resolves at booking scope/effective time via shared adapter. Start one immutable workflow definition/deployment; persist route, workflow version, requested/resolved scope and policy provenance. Line Manager or active one-hop delegate; cross-node additional owning Fleet Lead where policy allows; emergency route belongs B5.

Persist policy rule/version/deployment and workflow definition/deployment/version IDs on approval evidence. SLA expiry creates an escalation task for the configured role and never auto-approves. Existing instances remain pinned after policy/workflow changes.

## SoD/authorization

Requester/actor cannot approve; SystemAdmin cannot approve; delegate evidence records decided-by/on-behalf-of; task assignment and scope checked server-side at decision time. Fleet Manager booking on behalf does not make that Fleet Manager the approver by default.

## Approval UI

Pending/Decided queue, SLA, evidence card, policy reasons, consent status, requester/beneficiary/driver, vehicle/window/scope, previous decisions. Approve/request change/decline; reason rules; optimistic/idempotent commands; empty/error/delegated states.

## Fleet Manager operations

Queue of approved/upcoming handovers by managed scope; vehicle preparation, assignment/mediation where permitted, compliance/custody readiness and notifications. No silent vehicle substitution.

Material changes use an explicit workflow cancellation command with revision/idempotency. If a decision committed or a non-cancellable task is in progress, modification returns conflict and keeps the original booking unchanged; no orphan task.

## Database/backend

Pinned workflow deployment/version, task/effect idempotency, delegation fields, route provenance, append-only decisions, scheduled escalation, audit/outbox. Query APIs for inbox and preparation queue.

## Tests

All route variants; active/expired delegation; self-approval; duplicate submit/decision; concurrent approvers; SLA escalation; request change; cross-node; actor separation; shadow evaluates twice but workflow starts once; rollback selector; UI accessibility/RTL/E2E.

Approval delegation tests are distinct from operational on-behalf booking. Verify pinned versions, cancellation-vs-decision race, no auto-approval on SLA and one terminal domain effect/outbox.

## Rollback

New submissions can return to legacy route selector. Existing workflow instances remain pinned and complete under their original definition unless an approved migration command exists.

## Mandatory critique

Look for duplicate workflows/notifications, unpinned definitions, cross-scope approval, delegation chains, stale task authorization, workflow effects during shadow, and request-change orphan state.

## Exit gate

Submitted bookings route and decide exactly once with complete evidence; Fleet Manager sees an actionable scoped preparation queue.
