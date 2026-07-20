# 8.1 - Shared Decision Adapter, Provenance, and Shadow Foundation

## Objective

Create one reusable domain decision port that assembles organization/scope/effective context, supports selector modes, compares legacy/new results without effects, emits metrics and returns a persistence-ready provenance envelope.

## Owners and dependencies

- Primary: Backend Decision Platform owner
- Contributors: Database, Security, QA, SRE
- Depends on: 8.0

## Deliverables

### Decision port

Introduce `DomainDecisionService`/adapter above `PolicyEvaluatorService` with typed decision-key-specific inputs/outputs. Modes: `legacy-only`, `shadow`, `new-canary`, `new-primary-with-legacy-shadow`, `new-only`.

### Provenance envelope

Standard fields: decision key, organization ID, requested/resolved scope, immutable policy/version/deployment identity, decision, reasons, matched row/path, effective-at, evaluated-at, fact snapshot/reference/fingerprint, source freshness, correlation and degraded/failure status.

### Shadow comparison

Normalize legacy/new outputs before comparison. Record output/reason/route/default/error differences in a separate append-only comparison store, sampled and privacy-minimized. Shadow evaluation cannot enqueue escalation, workflow, audit side effects or domain events.

### Selector and rollback

Selector resolves environment/organization/scope/decision mode. Defaults to legacy-only until approved. Rollback is one selector/deployment operation. No domain-specific feature-flag branching duplicated in services.

### Schema

Additive provenance/comparison/deployment references. Prefer one structured envelope plus queryable critical FKs/columns. Do not add disconnected version columns without a write/read contract.

### Observability

Counters and latency by decision/consumer/mode/scope; divergence categories; fallback/fail-safe counts; missing provenance alerts; payload redaction.

## Tests

Adapter unit tests for every mode, normalization/property tests, no-side-effect shadow tests, correlation/provenance schema, cross-org/scope denial, stale facts, timeout/cache failure, selector rollback and sampling/privacy.

## Rollback

Disable adapter selector and route consumers to legacy-only. Additive comparison/provenance storage remains. No domain row is rewritten.

## Critique checklist

Check dual evaluation does not duplicate effects, selector decisions are deterministic/auditable, raw PII is not logged, and legacy/new errors are compared consistently.

## Exit gate

8.1 passes when a test consumer can run every selector mode, persist complete provenance, compare without side effects, expose actionable metrics and roll back instantly.

## Implementation status - complete

- `DomainDecisionService` supports legacy-only, shadow, deterministic canary, new-primary-with-legacy-shadow and new-only modes using effect-free decision closures.
- Persisted selectors are environment/organization/nearest-ancestor scoped with audited changes, revision, canary percentage and comparison sampling.
- Provenance carries selector identity/revision, policy rule/version IDs, matched row, organization, requested/resolved scope, effective/evaluated time, fact fingerprint, selected source and degraded state.
- Append-only comparisons are privacy-minimized, idempotent per request/fingerprint, environment-scoped and record output/error divergence without raw facts, raw subject IDs, raw reasons, routes, values or exception messages.
- Dual evaluation is bounded by per-request timeout; comparison sampling never changes the selected primary result.
- Historical Booking rows are backfilled with an explicit unknown provenance envelope rather than left ambiguous.

Critique findings closed: selector persistence/environment/scope inheritance, deterministic canary, sampling, raw PII/error leakage, deep-stable fingerprints, selector audit/revision, comparison idempotency, primary/secondary error handling and unbounded shadow evaluation.

Evidence: 14 focused unit tests, 5 live selector/cache integration tests, strict type/lint/dependency/contract/organization guards, build, and migration forward/idempotency are green.

8.1 is complete. Sub-phase 8.2 Booking value and re-consent adoption is active.
