# Phase 12 - Traceability, Deliverables, and Phase Gates

## 1. Objective

Provide the program-level completeness matrix, deliverable register, role handoffs, phase gates, and omission checks used to declare the decision/workflow platform complete.

## 2. Cross-stack traceability matrix

Maintain one row per policy/workflow capability during implementation:

| Capability | Driver/FR | Fact/output contract | DB entities | Backend service/API | UI route/component | Tests | Security/ops | Status/risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Policy catalog | I1 | Catalog DTO | definition/version/deployment | catalog GET | `/admin/policy` | contract/E2E | RBAC/health | Planned |
| Dynamic condition authoring | I1 | Authored model/fact catalog | draft/version | draft/validate APIs | condition editor | component/compiler | sandbox/limits | Planned |
| Draft simulation | FR-POL-06 | Simulation request/result | optional test case | simulate API | DecisionTrace | no-side-effect | privacy/rate limit | Planned |
| Impact replay | Governance | Replay contracts | replay run/result | replay worker/API | replay impact | scale/privacy | capacity/audit | Planned |
| Dual approval/deploy | FR-POL-03 | lifecycle commands | approval/change/deployment | review/deploy API | lifecycle bar | SoD/concurrency | audit/alerts | Planned |
| Production evaluation | FR-POL-05 | decision request/result | deployment/evaluation log | DecisionService | traces in features | conformance/load | SLO/runbook | Planned |
| Workflow authoring | Process governance | workflow schema | definitions/versions | admin APIs | workflow builder | model/a11y | sandbox/SoD | Planned |
| Durable approvals | Booking/Entitlement | task/command DTOs | instance/task/event | workflow runtime | approvals inbox | concurrency/E2E | SLA alerts | Planned |
| Timers/escalation | NFR/operations | timer events | timer/scheduled_work | worker | timeline/status | failure injection | timer-lag alert | Planned |
| Legacy migration | Current Phase 1 | parity model | compatibility/backfill | adapters/flags | status visibility | shadow parity | rollback | Planned |
| Organization settings | FR-ARC-02 | settings/revision DTO | organization | admin settings API | `/admin/organization` | CRUD/concurrency | SystemAdmin/audit | Planned |
| N-level hierarchy read | FR-ARC-02 | authorized/admin tree DTOs | hierarchy_node | hierarchy read services | Tree/list + ScopeSwitcher | tree/property/auth | org/scope/cache | Partial |
| Hierarchy writes/history | Org governance | command/impact/history DTOs | node/change event | create/rename/move/retire/reactivate | dialogs/detail/history | transaction/concurrency | audit/outbox/runbook | Planned |
| Scope authorization | IAM | Principal/closure/resource policy | role/person/node | authorized scope service | validated scope context | cross-org/scope | role freshness/alerts | Planned |
| Policy hierarchy binding | FR-ARC-03 | scope binding/result provenance | binding/deployment | ancestry resolver | tree override indicators | inheritance/effective | invalidation/rollback | Planned |

No capability can be `Done` with a missing contract, owner, test, or operational evidence cell.

## 3. Entity completion matrix

| Entity | Keys/identity | Relationships | Constraints/indexes | Repository/service | API/UI | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| decision_definition | org + key | versions/drafts | unique org/key | catalog | catalog | migration/CRUD | Planned |
| decision_version | definition + version | deployment/tests | immutable unique | compiler/registry | history/diff | checksum/history | Planned |
| decision_draft | ID + revision | based-on/review | optimistic revision | draft service | editor | conflict/validation | Planned |
| decision_scope_binding | version/scope | hierarchy | effective exclusion | resolver | scope display | overlap/fallback | Planned |
| decision_deployment | generation | version/binding | active unique | deployment service | lifecycle | concurrency/rollback | Planned |
| decision_test_case/run | policy/test | version/run | naming/index | test service | test panel | golden tests | Planned |
| decision_replay_run/result | run ID | versions | retention/index | replay worker | impact UI | volume/privacy | Planned |
| decision_change_event | append ID | lifecycle refs | append-only | audit | timeline | immutability | Planned |
| decision_log | evaluation ID | deployment/version | partition/index | audit | audit/trace | provenance/load | Extend |
| workflow_definition/version | key/version | deployment | immutable unique | definition service | builder/history | model tests | Planned |
| workflow_deployment | generation | definition version | active unique | deployment service | lifecycle | concurrency | Planned |
| workflow_instance | ID/lock version | deployment/tasks/events | optimistic lock | runtime | timeline | restart/concurrency | Extend |
| workflow_task | task ID | instance/assignee | active/task indexes | task service | inbox | auth/SoD/SLA | Extend |
| workflow_event | instance/sequence | actor/task | unique sequence/command | runtime/audit | timeline | duplicate/order | Planned |
| workflow_timer | timer ID | instance/task | due/status index | timer worker | status | claim/race | Planned |
| organization | ID/code/revision | hierarchy nodes | unique code/settings checks | organization admin | overview/settings | migration/CRUD | Extend |
| hierarchy_node | ID/stable code | parent/org/dependencies | org/code/path/sibling/validity/level | hierarchy admin/read | tree/detail/dialogs | move/retire/property | Extend |
| hierarchy_change_event | append ID | node/actor/action | append-only node/time | hierarchy audit | history timeline | immutability | Planned |

## 4. Deliverable register by phase

### Organization O0-O6

- Approved reusable organization/hierarchy ADRs and candidate-master-data sign-off.
- Data-quality report/remediation and test-isolation evidence.
- Stable-code/invariant/history migrations and safe subtree move implementation.
- Organization/hierarchy administration and authorized-scope APIs.
- Scope-aware Principal, resource authorization, cache/query propagation.
- Organization Management UI and shared hierarchy components with EN/AR accessibility evidence.
- Policy hierarchy binding/inheritance/invalidation gate evidence.

### Phase 0

- Current capability and consumer matrix.
- Responsibility boundary and NFR baseline.
- Risk/open-question register.

### Phase 1

- Runtime/workflow spikes, scorecards and ADRs.
- Approved technology/licensing/security decision.

### Phase 2

- Backend/Frontend Contract Matrix.
- Fact/output/operator/effect/reason catalogs.
- Decision/workflow JSON schemas and golden examples.

### Phase 3

- Drizzle schema and migrations.
- Backfill/compatibility scripts and migration evidence.

### Phase 4

- Runtime adapter and unified DecisionService.
- Scope/effective resolver, cache/invalidation, audit/telemetry.

### Phase 5

- Policy administration lifecycle APIs.
- Compiler, simulation, replay, diff, deployment and rollback.

### Phase 6

- Versioned workflow runtime, task APIs and timer worker.
- Definition administration and simulation.

### Phase 7

- Policy Studio, Workflow Builder and Approval Inbox.
- EN/AR, RTL, responsive and accessibility evidence.

### Phase 8

- Domain fact assemblers/adapters and migrated PEPs.
- Legacy compatibility/shadow evidence and removal register.

### Phase 9

- Threat model, controls, security assessment.
- Dashboards, alerts, runbooks and audit evidence.

### Phase 10

- Test report, load/soak/failure/replay results.
- Migration, security and accessibility evidence.

### Phase 11

- Deployment/cutover/rollback evidence.
- Training, support KB and operating ownership.

## 5. Phase gate checklist

Each phase must answer `yes`:

- Inputs and decisions exist and are approved.
- Contracts were updated before consumers.
- Security, tenant/scope, data residency and privacy were considered.
- DB constraints protect critical concurrency/data invariants.
- Loading/empty/error/denied/degraded states are covered where UI exists.
- Unit/integration/contract/E2E tests appropriate to the slice pass.
- Observability and operational ownership are defined.
- Migration and rollback are executable.
- Two critique rounds are complete.
- Findings are closed or accepted with owner/date.
- Downstream role receives artifacts and evidence.
- Scoped-policy phases additionally prove O0-O6 completion and cannot accept a planning-only hierarchy claim.

## 6. Requirements coverage checklist

The final program review verifies:

- Reusable N-level organization hierarchy with stable codes, bilingual labels, effective history and safe restructure.
- Organization data quality, master-data approval, scope-aware Principal/authorization and real query propagation.
- Real Organization Management UI and authorized Scope Switcher behavior.

- Dynamic typed conditions and operator compatibility.
- Ordered decision rows, default outcome and hit policy.
- Decision graphs/composition where approved.
- Typed outputs and controlled effect intents.
- Fact provenance/freshness/null semantics.
- Scope inheritance and effective dates.
- Immutable versions, approvals, scheduling, canary/shadow and rollback.
- Side-effect-free simulation and replay impact.
- Unified production evaluation, audit and failure strategy.
- Lightweight open-source JS workflow orchestration.
- Sequential/parallel/quorum approvals, timers, reminders, escalation, modification and cancellation.
- Domain transaction/effect isolation.
- UI catalog/editor/trace/diff/replay/builder/inbox.
- EN/AR, RTL, keyboard, screen-reader, responsive and theme parity.
- Security, PDPL/data residency, audit, observability, load, resilience and support.
- Current policy/workflow migration and legacy retirement.

## 7. Open decision register template

| ID | Decision | Options | Owner | Due date | Blocking phase | Impact if late |
| --- | --- | --- | --- | --- | --- | --- |
| DW-001 | Decision runtime | Candidate scorecard | Architecture | Before Phase 2 | 2 | Contracts/runtime drift |
| DW-002 | Workflow foundation | XState vs reducer | Architecture/Backend | Before Phase 3 | 3/6 | Persistence/runtime drift |
| DW-003 | Retention | evaluation/replay/audit periods | Security/Legal | Before Phase 3 | 3/9 | Schema/PDPL risk |
| DW-004 | High-impact approvals | role matrix | Product/Security/Audit | Before Phase 5 | 5 | Publication blocked |
| DW-005 | Failure strategies | per decision | Domain owners/SRE | Before Phase 4 migration | 4/8 | Unsafe fallback |

Implementation may add decisions but may not hide blockers as generic `TBC`.

## 8. Final handoff package

- Architecture ADRs and contract matrix.
- Source and migration paths.
- API/OpenAPI and frontend wiring map.
- Security and audit assessment.
- Test/performance/accessibility reports.
- Deployment/rollback evidence.
- Dashboards, alerts and runbooks.
- Residual risk and exception register.
- Named operational and policy/workflow content owners.

## 9. Program completion gate

The platform is complete only when all organization and decision/workflow matrix rows are closed, no critical capability relies on an undocumented fallback or direct DB change, hierarchy-scoped authorization/policy inheritance is proven, production decisions/workflows are versioned and attributable, rollback is rehearsed, and architecture, product, Data Steward, security, QA, SRE, support and domain owners approve the evidence.
