# Phase 0 - Current State, Drivers, and Target Boundaries

## 1. Objective

Establish an approved baseline before changing code. Confirm what the current policy and workflow modules do, what they only claim to do, and which target responsibilities belong to decisions, workflows, or domain services.

## 2. Owners and handoff

- **Primary:** AI Solution Architect
- **Contributors:** Backend NestJS, Database, Frontend React, Security, QA, SRE
- **Human gate:** Architecture and product-owner approval
- **Output consumer:** Phase 1 runtime bake-off

## 3. Current-state evidence to freeze

### Decision engine

- `PolicyEvaluatorService` resolves Redis -> active PostgreSQL version -> in-memory seed.
- `evaluateTable` implements ordered, first-match evaluation with equality, `gte`, and `lte`.
- `PolicyAdminService.activate` persists, supersedes, and invalidates Redis.
- Production modules inject the evaluator directly, bypassing controller-level decision logging and fail-safe escalation.
- Scope fields, effective dates, organization isolation, lifecycle states, and policy version IDs are not fully enforced.
- Registered but currently unused policies must be identified; a registered rule is not automatically a production rule.
- Value consumers that substitute hard-coded defaults after a fail-safe response must be cataloged as correctness risks.

### Workflow engine

- `WorkflowService` supports ordered approval steps, approve/reject/modification decisions, delegation, and escalation scheduling.
- Definitions are constructed by domain services at runtime rather than persisted as immutable versioned definitions.
- Parallel, quorum, timer, compensation, and controlled service-command primitives are absent.
- Existing instances are not explicitly pinned to a workflow-definition version.

### UI

- `/admin/policy` resolves to a guarded placeholder.
- Existing mockups show a rule catalog, dynamic conditions, outcomes, and version history but not safe compilation, draft simulation, dual approval, or impact analysis.
- Existing shared components can support the studio, but no frontend policy contracts or hooks exist.

### Organization and hierarchy

- One organization and a first-class effective-dated `hierarchy_node`/ltree model exist, with hierarchy-scoped roles and effective-dated vehicle assignments.
- No organization settings or hierarchy create/rename/move/retire/reactivate API exists; `/admin/organization` is a placeholder.
- `GET /hierarchy` is minimal, unfiltered by organization/authorized scope, and ignores future `validFrom` dates.
- `RolesGuard` checks roles on any scope. The Scope Switcher persists a selection but domain queries do not consume it.
- Policy resolution/cache keys are rule-type-only; schema scope/effective fields are not enforced.
- Live DB remediation baseline: seven active nodes/four roots, three leaked test pools, missing seeded Arabic/level metadata, six people without home pools.

## 4. Target responsibility matrix

| Capability | Decision platform | Workflow orchestrator | Domain service |
| --- | --- | --- | --- |
| Eligibility | Decide | No | Assemble facts and enforce result |
| Threshold/value | Return typed value | No | Apply value transactionally |
| Approval route | Return route intent | Instantiate tasks | Resolve people and manage domain status |
| Human approval | No | Yes | React to terminal outcome |
| SLA/reminder/escalation | No | Yes | Publish domain notification when required |
| Reserve/allocate/update | Never | Emit controlled command only | Yes |
| Notification | Return optional intent only | Emit controlled intent | Outbox/adapter executes |
| Authorization | Input fact or separate auth decision | Task authorization | API guard remains authority |
| Prediction/optimization | Consume versioned result as fact | No | Separate ML/optimization service |

## 5. Decision taxonomy

Every current and planned rule must be classified as one of:

- `ELIGIBILITY`: `ALLOW`/`DENY` with reason codes.
- `VALUE`: typed scalar/object value.
- `ROUTING`: ordered or parallel approval-role intent.
- `CALCULATION`: deterministic typed calculation.
- `CLASSIFICATION`: stable category code.
- `OBLIGATION`: controlled effect intent for the PEP, never direct execution.

Every decision declares:

- Fact schema and fact sources.
- Output schema.
- Default/failure strategy.
- Scope behavior.
- Effective-date behavior.
- Freshness requirements.
- Impact class: low, medium, high, critical.
- Audit and retention class.

## 6. Workflow primitive boundary

The initial orchestrator supports only:

- Sequential approval.
- Parallel all/any/quorum approval.
- Decision branch.
- Timer/wait.
- Reminder and escalation.
- Modification request and resubmission.
- Cancellation and expiry.
- Controlled notification intent.
- Controlled service-command intent.
- Terminal success/failure.

Arbitrary scripts, SQL, HTTP URLs, dynamic package loading, and unregistered command handlers are forbidden.

## 7. Current capability inventory

Create an evidence matrix with one row per existing rule and workflow:

| Item | Current consumer | Current facts | Current output | Version persisted | Logged centrally | Target class | Migration disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| booking-buffer | Booking | vehicle class | minutes | Partial | No | VALUE | Migrate |
| max-booking-duration | Booking | vehicle class | hours | No | No | VALUE | Migrate |
| booking-approval-chain | Booking | duration | roles | No | No | ROUTING | Migrate |
| driver-eligibility-gate | Compliance | validated booleans | allow/deny | Yes in evaluation | No | ELIGIBILITY | Redesign facts |
| entitlement rules | Entitlement | grade/request type | eligibility/route | Partial | No | ELIGIBILITY/ROUTING | Migrate |
| fines thresholds | Fines | currently empty | typed object | No | No | VALUE | Migrate |
| fuel threshold | Handover | currently empty | percent | No | No | VALUE | Migrate |
| workflow chains | Booking/Entitlement | role route | task sequence | Instance only | Workflow DB | Workflow | Version definitions |

The implementation team expands this matrix to every registered and documented rule before Phase 0 closes.

## 8. NFR baseline

- Production decision p95: <= 200 ms; booking-path target after warm cache: <= 50 ms.
- Availability target: 99.9% for decision runtime; last-known-good degradation required.
- Workflow transition durability: no acknowledged transition may be lost.
- Duplicate command handling: idempotent by command ID.
- Decision and workflow audit retention: follow security/PDPL retention approval.
- Arabic/RTL parity: required for authoring and review UI.
- Maximum activation propagation target: <= 5 seconds under healthy infrastructure.
- Recovery: policy deployment rollback <= 10 minutes; workflow state restore follows platform RPO/RTO.

## 9. Risks to record

- Current behavior may rely on undocumented hard-coded fallbacks.
- Existing fixtures may be mistaken for approved production values.
- A universal engine scope can become unsafe and untestable.
- DMN/runtime licensing and operational support require evidence, not assumption.
- Policy changes can alter in-flight workflows and operational obligations.
- Raw production facts may contain personal or sensitive data.

## 10. Deliverables

- Approved current-state capability matrix.
- Target responsibility matrix.
- Initial NFR set.
- Rule and workflow migration inventory.
- Risk register with owners.
- Architecture questions routed into Phase 1 ADRs.

## 11. Verification

- Source paths and consumers verified with repository search.
- Every registered policy has a named consumer or `unused` status.
- Every direct evaluator call and hard-coded fallback is listed.
- Every workflow start call is listed with its runtime-built steps.
- Product owner confirms business-critical and high-impact classifications.
- Every organization/hierarchy read/write/scope/policy claim is classified as implemented, partial, planned, or disproved by source.

## 12. Exit gate

Phase 0 passes when architecture, product, security, backend, frontend, database, QA, and SRE agree on the boundaries and no critical current behavior remains uncataloged. Organization phases O0-O6 are mandatory before hierarchy-scoped policy activation.
