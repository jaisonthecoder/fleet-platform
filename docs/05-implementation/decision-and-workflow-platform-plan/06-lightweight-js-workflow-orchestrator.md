# Phase 6 - Lightweight JavaScript Workflow Orchestrator

## 1. Objective

Evolve the current workflow service into a durable, versioned, open-source JavaScript/TypeScript orchestrator for controlled human approvals, timers, escalation, decision branches, and domain command intents without introducing Camunda or a general BPMN platform.

## 2. Owners and dependencies

- **Primary:** AI Backend Engineer (NestJS)
- **Contributors:** Solution Architect, Database, Security, QA, SRE, Frontend React
- **Depends on:** Phase 2 workflow contract and Phase 3 schema
- **Foundation decision:** XState statecharts or approved pure TypeScript reducer from Phase 1

## 3. Bounded primitive catalog

| Primitive | Purpose | Restrictions |
| --- | --- | --- |
| Start | Initialize variables and first state | One initial state |
| Approval | One assignee approves/rejects/requests changes | Assignment from registered resolver |
| Parallel approval | all/any/quorum tasks | Bounded branch/task count |
| Decision branch | Call registered decision key | Side-effect-free |
| Timer/wait | Pause until due/event | Persisted timer only |
| Reminder/escalation | Create notification/escalated task | Registered templates/roles |
| Notification intent | Publish controlled notification command | No arbitrary destination/template |
| Service command | Publish registered domain command | Handler allowlist, idempotency required |
| End | Terminal success/failure/cancelled/expired | Explicit outcome |

No arbitrary JavaScript, SQL, HTTP endpoints, package names, or expressions outside approved guards.

## 4. Runtime components

```text
src/modules/workflow-runtime/
  workflow-runtime.module.ts
  controllers/
    workflow-tasks.controller.ts
    workflow-admin.controller.ts
  services/
    workflow-definition.service.ts
    workflow-instance.service.ts
    workflow-task.service.ts
    workflow-timer.service.ts
    workflow-assignment.service.ts
    workflow-command.service.ts
  repositories/workflow-runtime.repository.ts
  runtime/
    workflow-machine.port.ts
    xstate-workflow.adapter.ts
  internal/
    transition.ts
    guards.ts
    commands.ts
    assignment-resolvers.ts
```

## 5. Definition lifecycle

Workflow definitions follow Draft -> InReview -> Approved -> Active -> Superseded.

- Publishing creates immutable version and deployment.
- New instances use the currently effective deployment.
- Existing instances continue on their pinned version.
- A migration tool may move an instance only through an explicitly tested migration function and human approval.

## 6. Instance transition transaction

For every command/event:

1. Validate command schema and authenticated actor.
2. Begin transaction and lock instance row or compare lock version.
3. Reject/return prior result for duplicate command ID.
4. Load pinned immutable definition and current tasks/timers.
5. Verify actor assignment, delegation, scope, and SoD.
6. Apply event to pure machine/reducer.
7. Append `workflow_event` with next sequence.
8. Update instance state/status/variables and lock version.
9. Complete/create/cancel workflow tasks.
10. Create/cancel timers or `scheduled_work` records.
11. Write audit and outbox commands.
12. Commit and return projection.

Domain command execution happens after commit through outbox consumers.

## 7. Assignment resolvers

Closed registry:

- Requester's line manager.
- Named platform role at resolved hierarchy scope.
- Fleet lead for pool/cluster/group.
- Explicit person selected under authorization.
- Delegated assignee with one-hop restriction.
- Policy result returning assignment-source descriptors.

Resolution records the source and resolved person. Vacant/unresolvable assignment triggers a defined fallback/escalation, never silent omission.

## 8. Task decisions

Supported commands:

- `APPROVE`
- `REJECT`
- `REQUEST_CHANGES`
- `CANCEL`
- `CLAIM` / `RELEASE` where task pools are approved
- `ESCALATE`
- `TIMER_FIRED`
- registered external/domain event

Reasons are mandatory for reject, request changes, manual escalation, cancellation, and administrative intervention.

## 9. Parallel and quorum semantics

Definition declares:

- Branch/task set.
- Completion mode: `ALL`, `ANY`, `QUORUM(n)`.
- Rejection mode: immediate reject, collect all, or threshold.
- SoD uniqueness requirements.
- Remaining-task cancellation behavior.
- Timeout behavior.

The pure transition tests must cover all orderings because concurrent decisions can arrive in any order.

## 10. Timers, reminders, and escalation

- PostgreSQL is authoritative for due timers.
- Worker claims due rows using `FOR UPDATE SKIP LOCKED`.
- Timer command ID is deterministic to make delivery idempotent.
- Processing attempts, last error, next attempt, and terminal failure are visible.
- Timer firing appends an event and transitions through the same service as user commands.
- Clock abstraction is mandatory for tests.
- No in-memory `setTimeout` for durable business timers.

## 11. Workflow API

### Runtime

- `POST /api/v1/workflows` start from active definition.
- `GET /api/v1/workflows/:id` instance projection.
- `GET /api/v1/workflows/:id/events` authorized timeline.
- `GET /api/v1/workflow-tasks?assignee/status/scope` inbox.
- `POST /api/v1/workflow-tasks/:id/decisions` idempotent task command.
- `POST /api/v1/workflows/:id/cancel` authorized cancellation.

### Administration

- Definition catalog, draft, validate/simulate, submit, approve, publish, diff, and retire endpoints mirroring policy governance.
- Workflow simulation returns paths/tasks/timers/commands but executes no effects.

## 12. Domain integration contract

Domain starts workflow with:

- workflow key.
- subject reference.
- organization/scope.
- requester/actor.
- variables conforming to versioned schema.
- correlation and idempotency key.

Workflow emits controlled events/commands such as `BookingApprovalCompleted`. Domain consumer validates current domain state before applying the result transactionally.

Workflow instance start pins organization, requested/resolved hierarchy scope, hierarchy generation, workflow definition deployment and any routing decision deployment. In-flight instances retain these references across later hierarchy moves; migration to a new scope/definition requires an explicit tested administrative command and audit approval.

## 13. UI requirements

- My Tasks/Approval Inbox with assignee, scope, SLA, evidence, decision trace, and reason controls.
- Instance timeline with current/complete/pending/escalated states.
- Workflow Builder using templates and controlled primitives, not raw code.
- Simulation showing route, resolved roles, tasks, timers, and command intents.
- Definition version history and semantic diff.

Detailed UI delivery is in Phase 7.

## 14. Reliability and security

- Idempotent command IDs and outbox consumers.
- Optimistic locking plus bounded retries on conflict.
- Per-instance event sequence integrity.
- Definition and command-handler allowlists.
- Authorization and SoD checked server-side on every command.
- Variables classified/minimized; secrets never stored in workflow variables.
- Administrative override is explicit, audited, role-restricted, and never mutates history.
- Task authorization uses O4 resource-scope policy, not role name alone; assignment resolvers reject unavailable or cross-organization people/scopes.

## 15. Tests

- Pure transition model tests and property tests.
- Sequential, parallel, any, quorum, reject, modification, cancel, expiry.
- Delegation and SoD tests.
- Duplicate command and concurrent approver tests.
- Worker crash/replay and outbox failure tests.
- Timer race and timezone tests.
- Definition pinning across version activation.
- Unresolvable assignee and escalation tests.
- Domain command idempotency.
- Long-running instance soak and migration compatibility.

## 16. Camunda/BPMN revisit condition

Reconsider `bpmn-engine` or another BPMN-compatible runtime only if an approved requirement cannot be expressed with the bounded primitive catalog and requires BPMN import/export or analyst-authored arbitrary gateways. Record evidence before expanding scope.

## 17. Exit gate

Phase 6 passes when workflows survive restarts, duplicates, concurrent decisions, timer races, hierarchy/definition changes and scope revocation while preserving pinned provenance, scope authorization, audit and domain side-effect isolation.
