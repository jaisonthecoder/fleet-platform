# Phase 1 - Architecture Decisions and Runtime Bake-Off

## 1. Objective

Select the decision runtime, expression semantics, workflow state-machine foundation, artifact format, and deployment topology through executable evidence. No production integration starts before these decisions are approved.

## 2. Owners and dependencies

- **Primary:** AI Solution Architect
- **Technical leads:** Backend NestJS, Platform/SRE, Security
- **Reviewers:** Database, QA, Frontend React
- **Depends on:** Phase 0
- **Human gate:** Runtime/platform and licensing approval

## 3. ADR set

Create ADRs under `docs/03-architecture/ADR/` for:

1. Decision notation and expression language.
2. Decision runtime selection.
3. Lightweight workflow semantics and XState/reducer choice.
4. Policy artifact storage and compilation boundary.
5. Runtime deployment: in-process, dedicated service, or hybrid.
6. Scope and effective-date resolution.
7. Failure and last-known-good strategy.
8. Audit, fact minimization, and retention.
9. Versioning, deployment, canary, shadow, and rollback.
10. Camunda/BPMN exclusion and revisit conditions.

Each ADR records options, decision, rationale, consequences, and measurable revisit conditions.

## 4. Decision-runtime candidates

Evaluate at least:

- **Kogito/Drools DMN:** standards depth, FEEL coverage, JVM operational cost.
- **GoRules Zen:** Node/React integration, decision graph/editor potential, portability and support.
- **Bounded custom compiler/runtime:** only as fallback; compare maintenance and standards cost honestly.

OPA/Cedar are assessed only for authorization policy and are not candidates for the primary business-decision runtime.

## 5. Mandatory bake-off scenarios

Implement the same portable test corpus in each candidate:

1. Booking eligibility with hard deny and explanatory reasons.
2. Booking buffer and maximum duration values.
3. Approval route based on duration, request type, and scope.
4. Dedicated vehicle eligibility with null and stale facts.
5. Fines threshold returning a typed object.
6. Pool override falling back to cluster and group.
7. Effective-dated version boundary at Asia/Dubai midnight.
8. Draft simulation returning the matched row/path.
9. Batch replay of 100,000 fact sets.
10. Invalid definition rejection.

## 6. Scorecard

| Criterion | Weight | Mandatory evidence |
| --- | ---: | --- |
| Determinism and correctness | 20 | Golden tests and boundary tests |
| Business authoring fit | 15 | Table/graph prototype evaluated by admins |
| Explainability | 10 | Matched path, reasons, input/output trace |
| Standards portability | 10 | Export/import and expression compatibility |
| Node/Nest integration | 10 | Working adapter and typed contracts |
| Performance | 10 | Warm/cold p50/p95/p99 and batch throughput |
| Security | 10 | Sandbox/no arbitrary execution, dependency review |
| Operations | 5 | Health, metrics, deployment, recovery |
| Licensing/support | 5 | Legal and support assessment |
| Migration fit | 5 | Current 13 rules represented without semantic loss |

A candidate failing deterministic execution, safe sandboxing, immutable version identity, or explainability is rejected regardless of score.

## 7. Workflow foundation spike

Compare:

- XState statecharts with persisted snapshots/events.
- A small pure TypeScript transition reducer using the same JSON definition.
- `bpmn-engine` only as a reference if a mandatory scenario cannot be expressed with bounded primitives.

Spike scenarios:

- Sequential two-stage approval.
- Parallel all-of and quorum approval.
- Delegate decision with SoD protection.
- Modification request -> resubmit as a new cycle.
- Timer -> reminder -> escalation.
- Duplicate command replay.
- Worker crash after DB commit but before event publication.
- Definition v2 activation while a v1 instance remains in flight.

## 8. Deployment options

### Option A - Dedicated decision service

- NestJS API calls an internal decision service.
- Strong isolation and independent scaling.
- Adds network latency and service operations.

### Option B - In-process runtime with shared artifacts

- Lowest latency.
- Every API replica loads the same immutable deployment bundle.
- Requires reliable activation broadcast and parity across replicas.

### Recommended hybrid

- Compile and administer centrally.
- Load signed/checksummed compiled bundles in process for booking-path latency.
- Keep a dedicated evaluation endpoint for external/internal consumers and batch replay.
- Use the same runtime adapter and golden tests in both modes.

## 9. Proof-of-concept contracts

The spike must demonstrate:

```ts
interface DecisionRequest {
  decisionKey: string
  organizationId: string
  scopeNodeId?: string
  effectiveAtUtc: string
  facts: Record<string, unknown>
  subjectRef?: string
  correlationId: string
}

interface DecisionResult<T> {
  decisionId: string
  deploymentId: string
  policyVersionId: string
  matchedPath: string[]
  reasonCodes: string[]
  scopeResolved: string
  output: T
  durationMs: number
}
```

## 10. Security and licensing checks

- No dynamic `eval`, arbitrary module import, filesystem access, network calls, or SQL from authored definitions.
- SBOM and dependency vulnerability scan for each candidate.
- Confirm open-source license obligations and commercial-support options.
- Confirm UAE-hosted/self-managed deployment viability.
- Confirm no definition or fact data leaves the approved environment.

## 11. Deliverables

- Executable candidate adapters and test corpus.
- Scorecard with raw measurements.
- ADR set with selected runtime and workflow foundation.
- Target deployment diagram.
- Approved license/security assessment.
- Rejected-option record and revisit conditions.

## 12. Exit gate

Phase 1 passes only when one decision runtime and one workflow-state foundation meet all mandatory criteria and the architecture review approves the associated ADRs.
