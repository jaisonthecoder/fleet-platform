# Phase 10 - Testing, Performance, and Resilience Gates

## 1. Objective

Prove the platform is correct, explainable, secure, accessible, performant, resilient, migration-safe, and reversible before production cutover.

## 2. Owners and dependencies

- **Primary:** AI Quality Engineer
- **Contributors:** Backend, Frontend, Database, Security, SRE, Domain owners
- **Depends on:** Phases 4-9
- **Human gate:** QA release recommendation and risk acceptance

## 3. Test pyramid

### Unit/pure model

- Operators, type coercion, null/date/timezone semantics.
- Compiler diagnostics and decision hit policies.
- Scope/effective deployment resolution.
- Workflow transition reducer/statechart.
- Parallel/quorum/order-independent outcomes.
- Assignment and SoD rules.
- Semantic diff and result minimization.

### Component/service

- Fact assemblers and output adapters.
- Runtime adapter conformance.
- Administration lifecycle services.
- Timer/command handlers.
- React condition/outcome editors and workflow templates.

### Integration

- PostgreSQL/Redis with real migrations.
- Activation transaction and propagation.
- Decision audit/outbox.
- Workflow transitions/tasks/timers/events/outbox.
- Domain PEP integrations.
- Authorization/SoD and multi-organization isolation.
- Hierarchy create/rename/move/retire/reactivate, impact preview, cache invalidation and organization data-quality reports.

### Contract/E2E

- OpenAPI/frontend contract drift.
- Policy author -> simulate -> review -> deploy -> evaluate -> rollback.
- Workflow author -> publish -> instance -> tasks -> timer/escalation -> terminal domain event.
- Real-browser EN/AR and desktop/mobile journeys.

## 4. Golden decision corpus

Each decision version carries executable tests:

- Happy path.
- Default path.
- Every decision row/path.
- Boundary immediately below/at/above thresholds.
- Null/missing/stale/invalid facts.
- Scope override/fallback.
- Effective-date before/at/after.
- Expected output schema, reasons and matched path.

High-impact policies cannot deploy unless mandatory cases pass.

## 5. Model-based and property testing

- Generate operator/type combinations within limits.
- Verify deterministic result for identical artifact/facts/effective context.
- Verify result independent of object key ordering.
- Verify `UNIQUE` detects multiple hits.
- Verify workflow cannot reach undefined states.
- Verify terminal workflow cannot accept normal commands.
- Verify duplicate command produces identical response without duplicate events/effects.
- Verify event sequence remains contiguous under concurrency.
- Generate valid/invalid arbitrary-depth trees; verify no cycles, one root, parent/level/org consistency, ancestry closure and move path preservation.

## 6. Migration and parity testing

- Fresh schema and upgrade from current migration `0013`.
- Backfill all current seeds/active versions.
- Legacy/new shadow comparison for every current consumer.
- Current booking, compliance, entitlement, fine and handover regression suites remain green.
- Active legacy workflows drain/continue safely.
- Forward and compensating migration rehearsal.
- Destructive cleanup tested only after rollback window.
- Fresh/upgrade remediation from four-root local state, stable-code/Arabic/level backfill, approved hierarchy import and test-artifact cleanup.

## 7. Concurrency tests

- Two policy activations for same org/key/scope.
- Activation concurrent with evaluation.
- Draft optimistic update conflict.
- Two approvers acting on same task.
- Parallel/quorum tasks completing in every order.
- Timer and user decision racing.
- Multiple workers claiming due timers.
- Out-of-order/duplicate activation events.
- Rollback concurrent with canary promotion.
- Concurrent hierarchy moves, move vs role/vehicle/policy assignment, retire vs workflow start, and SoD role grants.

## 8. Failure injection

- Redis unavailable/slow/corrupt entry.
- PostgreSQL unavailable during evaluation and activation.
- Last-known-good bundle absent/corrupt.
- Runtime adapter timeout/exception.
- Audit/outbox unavailable.
- Worker crash before/after commit.
- Activation event publication/consumption failure.
- Stale hierarchy/fact source.
- Deployment replica restart during propagation.
- Browser/API network interruption during draft save.

Assert the documented failure policy and no duplicate side effects.

## 9. Performance gates

### Decision runtime

- Warm in-process p95 <= 50 ms target.
- End-to-end production evaluation p95 <= 200 ms.
- Eligibility path p95 <= 500 ms including fact assembly.
- 10x expected burst without event-loop p99 lag > 10 ms.
- Activation propagation <= 5 seconds healthy target.
- Batch replay meets approved throughput without starving production.

### Workflow

- Transition command p95 target defined from baseline, excluding external side effects.
- Timer lag within agreed tolerance under peak load.
- Inbox list/detail meets operational UI target.
- Soak with realistic long-running instance count and task history.

### UI

- Route-level lazy loading.
- Policy catalog and workspace interaction budgets.
- Large decision table virtualization only if measured and accessible.
- INP < 200 ms target; no editor keystroke triggering network compile.

## 10. Security tests

- Role/scope/tenant matrix for every endpoint.
- Self-approval and publisher separation.
- IDOR and hierarchy leakage.
- Expression/resource abuse and oversized payloads.
- Injection/log forging.
- Replay data masking/access.
- Artifact tampering/checksum mismatch.
- Secret/PII leakage in errors, logs, traces and UI.
- Direct DB/cache bypass operational controls.
- Normal user hierarchy filtering, arbitrary dashboard scope, cross-organization parent/scope/policy binding, retired-node selection, role-revoke scope freshness and admin full-tree separation.

## 11. Accessibility and i18n gates

- Automated axe on all major pages/states.
- Full keyboard authoring and task decision flows.
- Focus order and restoration after dynamic row operations.
- Screen-reader labels/live-region behavior.
- English and Arabic copy completeness.
- RTL visual and semantic parity.
- Contrast in light/dark themes.
- 320px/mobile/tablet/desktop/wide screenshots with no overlap or truncation.
- Reduced-motion behavior.
- Organization tree/table keyboard navigation, focus restoration after restructure, bilingual node labels/level terminology and mobile drill-down parity.

## 12. Replay and impact acceptance

Before high-impact production deployment:

- Replay dataset and privacy approval recorded.
- Draft vs active difference thresholds defined.
- Changed outcomes reviewed by business owner.
- Unexpected differences resolved.
- Performance/capacity impact reviewed.
- Rollback target and triggers confirmed.

## 13. Test environments and data

- Local: deterministic fixtures, Postgres/Redis containers.
- CI: fresh migrations, integration services, generated/fixed golden corpus.
- UAT: production-like topology, anonymized datasets, Entra roles, Arabic testing.
- Performance: isolated environment sized to represent runtime topology.
- Production shadow: minimized comparison telemetry with no behavioral effect.

## 14. Evidence package

- Automated test reports and coverage.
- Golden/replay comparison results.
- Migration/rollback logs.
- Load/soak/failure-injection results.
- Security scan/assessment.
- Accessibility report and screenshots.
- Residual risks, owners, dates and approvals.
- Release recommendation.

## 15. Exit gate

Phase 10 passes only when O0-O6 plus all mandatory correctness, migration, hierarchy/property, concurrency, failure, performance, security, accessibility and rollback gates pass or have explicit dated risk acceptance by the correct human authority.
