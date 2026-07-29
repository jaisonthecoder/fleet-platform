# DEDICATED-02 - Submission and Approval Workflow

> **Status:** `VERIFIED`

## Implemented - 2026-07-26

- Owner/revision-bound submit uses durable idempotency and revalidates current opaque eligibility evidence.
- Approval policy resolves every required distinct non-requester route step or fails closed; current LongTerm vocabulary replaces the unreachable legacy `permanent` rule.
- Workflow definition deployment, instance, steps, Entitlement transition, immutable route provenance, audit, outbox and command result share one transaction.
- Assigned/delegated minimized worklist and version-bound Approve, Request Modification and Decline commands are live in the unified Approval Inbox.
- SystemAdmin-only operational decisions and requester self-approval are denied. Negative decisions require a reason.
- Modification cycles preserve prior provenance history, close the current workflow on owner edit, require fresh eligibility and permit a new pinned submission cycle.
- Employee My Requests exposes Submit and status guidance; EN/AR approval tabs distinguish Pool Booking and Dedicated Vehicle work.

Evidence: backend focused 30/30; PostgreSQL 5/5 with complete four-person route and immutable deployment; frontend 11/11 focused plus typecheck/build; three critique rounds completed with stale reviewer reports rejected and direct findings remediated.

Residual: dedicated consent/allocation remains fail closed under DEDICATED-03. Workflow failure injection is inherited from the shared transaction-capable engine but should receive Entitlement-specific injected outbox/audit tests in DEDICATED-06.

## Objective

Submit an eligibility-evidenced Draft exactly once into an immutable, pinned entitlement approval route and provide requester/approver evidence without permitting self-approval.

## Entry Criteria

- DEDICATED-00 verified and DEDICATED-01 Draft/eligibility contract stable.
- Entitlement approval route policy approved, including thresholds, delegation, SLA and no-approver behavior.
- Workflow definition/deployment lineage follows the verified Booking pattern.

## Backend Work

1. Revalidate Draft revision, owner/scope, eligibility freshness, class and preferred Vehicle evidence at submit.
2. Durable submit command with stable replay and same-key/different-payload conflict.
3. In one transaction: lock request, claim command, pin workflow deployment, create instance/steps, persist immutable approval route, transition to PendingApproval, audit/outbox and complete command result.
4. Resolve Line Manager, Cluster Fleet Lead and Cluster CEO by policy; exclude requester/actor and enforce SoD-02/SoD-05.
5. Assigned/delegated approval worklist with minimized requester, ask, eligibility, justification, preference and prior-decision evidence.
6. Versioned/idempotent Approve, Request Modification and Decline commands with required negative reasons.
7. ModificationRequested preserves prior workflow/history; resubmission starts a new pinned cycle.

## Frontend Work

- Requester submitted state with immutable route progress, SLA and safe decision reasons.
- Unified Approvals inbox distinguishes Booking and Entitlement tasks.
- Senior decision view presents request axes, approved class, non-binding preference/note, eligibility provenance, justification, attachments and approved cost read model only.
- Request Modification returns actionable comments to My Requests.

## Tests and Evidence

- Submit replay/rollback, no approver, stale revision and eligibility expiry.
- Direct/delegated approval, requester self-approval denial and SystemAdmin denial.
- Concurrent decide/cancel/modify with one winner and stable replay.
- Immutable historical routes across modification/resubmission.
- EN/AR worklist, decision states and responsive evidence.

## Three Critique Rounds

### Round 1 - Contract, Security and Data

Review workflow pinning, route immutability, worklist masking, actor/requester separation, tenant scope and audit evidence. Repair and rerun HTTP/PostgreSQL tests.

### Round 2 - Behavior and Concurrency

Challenge submit/decide/cancel races, delegation windows, SLA escalation, modification cycles and exactly-once side effects. Repair with failure injection and rerun.

### Round 3 - UX and Operations

Review requester progress, approval evidence hierarchy, reason requirements, preference non-guarantee, Arabic RTL, accessibility and escalation observability. Repair and capture UI/build evidence.

## Exit Gate

A valid Draft submits exactly once to a pinned approval route; authorized decisions are immutable and race-safe; requester sees current progress and modification outcomes; no Vehicle allocation occurs.
