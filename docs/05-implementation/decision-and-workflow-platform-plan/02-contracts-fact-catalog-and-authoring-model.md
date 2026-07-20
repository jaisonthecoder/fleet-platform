# Phase 2 - Contracts, Fact Catalog, and Authoring Model

## 1. Objective

Define the stack-neutral Backend/Frontend Contract Matrix, canonical fact catalog, authored decision model, compiled artifact contract, workflow-definition schema, reason-code catalog, and validation rules before DB, API, or UI implementation diverges.

## 2. Owners and dependencies

- **Primary:** AI Solution Architect
- **Implementation owners:** Backend NestJS and Frontend React
- **Contributors:** Domain owners, UX, Security, QA, Data Governance
- **Depends on:** Phase 1 ADRs

## 3. Canonical fact catalog

Each fact definition contains:

| Field | Requirement |
| --- | --- |
| `key` | Stable namespaced key, e.g. `driver.licence.status` |
| `labelEn` / `labelAr` | Localized authoring labels |
| `descriptionEn` / `descriptionAr` | Business meaning and usage |
| `dataType` | boolean, integer, decimal, string, enum, date, datetime, duration, money, list, object |
| `unit` | days, minutes, km, percent, AED, etc. |
| `operators` | Allowed operators for the type |
| `allowedValues` | Static enum or lookup-source reference |
| `nullable` | Explicit null contract |
| `nullSemantics` | reject, no-match, default, unknown |
| `source` | HCM, vehicle master, booking, telematics, request, derived |
| `freshnessSla` | Maximum acceptable source age |
| `classification` | public, internal, confidential, personal, sensitive |
| `scopeBehavior` | global, organization, hierarchy, subject |
| `deprecatedAt` | Controlled retirement metadata |

The UI receives catalog metadata from the backend; it never invents fields or operators.

## 4. Operator model

Initial supported operators:

- Scalar: `eq`, `neq`.
- Ordered values: `lt`, `lte`, `gt`, `gte`, `between`.
- Collections: `in`, `notIn`, `contains`, `containsAny`, `containsAll`.
- Strings: `startsWith`, `endsWith`, `matches` only if regex is safely constrained.
- Null: `isNull`, `isNotNull`.
- Dates: before/after/between with explicit timezone handling.

Operator/type compatibility is defined in one backend registry and returned to the UI.

## 5. Authored decision model

```ts
interface AuthoredCondition {
  id: string
  factKey: string
  operator: string
  value?: unknown
}

interface ConditionGroup {
  id: string
  combinator: 'AND' | 'OR'
  conditions: Array<AuthoredCondition | ConditionGroup>
}

interface DecisionRow {
  id: string
  order: number
  conditions: ConditionGroup
  output: Record<string, unknown>
  reasonCodes: string[]
  effectIntents?: string[]
}

interface DecisionDefinition {
  schemaVersion: number
  decisionKey: string
  hitPolicy: 'FIRST' | 'UNIQUE' | 'COLLECT'
  inputFactKeys: string[]
  outputSchemaRef: string
  rows: DecisionRow[]
  defaultOutput: Record<string, unknown>
  defaultReasonCodes: string[]
}
```

MVP authoring exposes `AND` at row level. Nested `OR` groups may be enabled only after the runtime and accessibility tests pass; the contract supports them without requiring immediate UI exposure.

## 6. Output and effect-intent model

Outputs are typed per decision, not generic unvalidated JSON. Families include:

- Eligibility output: `{ decision: 'ALLOW' | 'DENY' }`.
- Value output: schema-specific scalar/object.
- Routing output: ordered/parallel role and assignment-source descriptors.
- Classification output: stable code.
- Calculation output: typed numeric/money/duration result.

Effect intents use a closed catalog such as `NOTIFY_REQUESTER` or `CREATE_CALENDAR_HOLD`. The PEP decides whether and how to execute them. Authored policies cannot provide URLs, SQL, code, or arbitrary payload handlers.

## 7. Workflow-definition contract

```ts
interface WorkflowDefinition {
  schemaVersion: number
  workflowKey: string
  initialState: string
  states: Record<string, WorkflowState>
  variableSchemaRef: string
}

type WorkflowState =
  | ApprovalState
  | ParallelApprovalState
  | DecisionState
  | TimerState
  | NotificationState
  | ServiceCommandState
  | FinalState
```

Every state declares allowed events, transition targets, authorization policy, SLA, retry policy, and controlled command key where applicable.

## 8. Backend/Frontend Contract Matrix

| Operation | Request | Response | Roles | Error/reason codes | Status |
| --- | --- | --- | --- | --- | --- |
| List policy catalog | filters, scope | summaries and health | SystemAdmin, InternalAudit(read) | `policy-catalog-unavailable` | Draft |
| Get policy workspace | policy ID | active, draft, history, metadata | SystemAdmin | `policy-not-found` | Draft |
| Save draft | authored definition + expected revision | draft revision | SystemAdmin | validation/conflict codes | Draft |
| Validate draft | draft revision/definition | diagnostics | SystemAdmin | compiler diagnostics | Draft |
| Simulate draft | facts + effective/scope | trace and result | SystemAdmin, reviewer | fact/definition errors | Draft |
| Replay draft | dataset selector | async replay ID | SystemAdmin, InternalAudit | privacy/size errors | Draft |
| Submit/approve/reject | revision + reason | lifecycle state | author/reviewer | SoD and transition errors | Draft |
| Deploy/schedule | approved version + target | deployment | authorized publisher | concurrency/effective errors | Draft |
| Roll back | deployment + reason | new deployment | dual-control roles | rollback errors | Draft |
| List workflow definitions | filters | summaries | SystemAdmin | unavailable | Draft |
| Save/test/publish workflow | definition/revision | diagnostics/version | SystemAdmin/reviewer | graph and SoD errors | Draft |
| Act on task | command ID + decision + reason | task/instance view | assignee/delegate | assignment/duplicate errors | Existing to extend |
| Authorized hierarchy | organization/effective time | permitted tree + context ancestors + generation | Authenticated | scope/org errors | O4 |
| Admin hierarchy | filters/asOf | full tree/settings/health | SystemAdmin | hierarchy errors | O3 |
| Preview hierarchy change | node/action/target/revision | dependency impact + token | SystemAdmin | stale/invalid move errors | O3 |
| Mutate hierarchy | create/rename/move/retire/reactivate command | updated subtree/generation | SystemAdmin | validation/concurrency errors | O3 |

This matrix is frozen before React hooks or NestJS controllers are written.

## 9. Validation/compiler diagnostics

The compiler detects:

- Unknown/deprecated facts.
- Invalid operator for type.
- Invalid values, units, and output shape.
- Missing mandatory default.
- Duplicate row IDs or order.
- Contradictory/impossible ranges.
- Unreachable/shadowed rows.
- Ambiguous rows under `UNIQUE`.
- Unsafe fail-open default for critical decisions.
- Unauthorized effect intents.
- Cyclic decision dependencies.
- Excessive nesting/complexity.
- Workflow unreachable states, dead ends, cycles without a wait/exit, missing handlers, and invalid task assignment.

Diagnostics include stable code, severity, path, English/Arabic message key, and remediation hint.

## 10. Contract artifacts

- Shared OpenAPI schemas and exported Zod schemas.
- Runtime-independent JSON schemas for decision/workflow definitions.
- Fact and output-schema registries.
- Reason-code and effect-intent catalogs.
- Golden examples for all current rules.
- MSW fixtures generated from approved response contracts.
- Contract-drift checks covering backend/frontend shared enums and schemas.
- Organization/hierarchy schemas with stable node code, bilingual labels, level/status/validity, organization, revision/generation, audit metadata and dependency counts.
- Production DecisionRequest requires `organizationId`, requested scope and effective time; policy drafts/deployments declare organization-default or hierarchy-node binding.

## 11. Testing

- Schema valid/invalid fixtures.
- Operator/type matrix tests.
- Compiler diagnostic golden tests.
- EN/AR metadata completeness tests.
- Backward/forward schema-version compatibility tests.
- Consumer-driven contracts for UI and domain PEPs.

## 12. Exit gate

Phase 2 passes when architecture owns and approves the first Backend/Frontend Contract Matrix, all current policy facts and outputs are represented, organization/scope contracts are frozen, and backend/frontend/QA agree no implementation contract must be invented downstream.
