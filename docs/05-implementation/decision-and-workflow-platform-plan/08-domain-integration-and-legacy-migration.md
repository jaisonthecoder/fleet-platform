# Phase 8 - Domain Integration and Legacy Migration

> **Status:** Research and sub-phase planning complete; implementation paused pending Sub-phase 8.0 baseline reconciliation.
> **Detailed execution package:** [phase-8-domain-migration/README.md](phase-8-domain-migration/README.md)

## 1. Objective

Migrate all current decision consumers and approval flows to the new boundaries with shadow parity, explicit intentional-difference approval, immutable provenance, and rollback. Remove unsafe direct evaluator use and runtime-built workflow definitions.

## 2. Owners and dependencies

- **Primary:** AI Backend Engineer (NestJS)
- **Contributors:** Domain feature owners, Database, Frontend React, QA, SRE, Product
- **Depends on:** Phase 4 runtime, Phase 5 governance, Phase 6 workflow orchestrator

## 2A. Research baseline - 2026-07-20

Verified production PEP inventory:

- Booking: buffer, maximum duration, approval route and re-consent tolerance.
- Compliance: driver eligibility gate plus structural hard blocks.
- Entitlement: dedicated-vehicle eligibility and approval route.
- Fines: HR threshold and black-point timeframe.
- Handover: fuel-deviation advisory.
- Registered but unresolved: compliance alert ladders, hard-block-conditions and driver-eligibility.

Critical findings:

1. Domain provenance is inconsistent and insufficient for replay/audit across all decisions.
2. Fines, black-point and fuel advisory paths retain hidden hardcoded fallbacks.
3. Approval workflows are runtime-built and not pinned to immutable workflow-definition versions.
4. No shared shadow comparison, selector modes, divergence store or rollback seam exists.
5. Current BookingService/migration `0023_booking_policy_provenance` edits are present but have not passed a Phase 8 baseline/critique gate and must not be counted complete.
6. Workflow route cutovers (8.3 and 8.5) remain gated on the Phase 6 immutable workflow-definition foundation.

Execution is split into Sub-phases 8.0-8.10. Each sub-phase must complete the mandatory implement/verify/critique/fix/document/memory loop before the next begins.

## 3. Migration strategy

Use strangler migration, not a big-bang replacement:

1. Import legacy seeds/active versions as registry artifacts.
2. Keep current evaluator behind `LegacyDecisionAdapter`.
3. Add new `DecisionService` in shadow mode beside each consumer.
4. Compare normalized results without changing behavior.
5. Resolve differences and approve intentional changes.
6. Switch one decision key/consumer at a time using feature flags/deployment selector.
7. Retain fast rollback to legacy adapter during the observation window.
8. Remove direct evaluator calls and fixtures only after all consumers pass.

Organization/scope migration precedes policy consumer cutover: every resource must expose a validated organization and effective hierarchy scope, and every Principal/action must pass O4 authorization.

## 4. Rule migration matrix

| Decision | Current consumer | Required target improvements | Migration order |
| --- | --- | --- | ---: |
| booking-buffer | Booking create/modify | Typed value, scope, provenance, no silent default | 1 |
| max-booking-duration | Booking create | Fail-closed/value policy and boundary tests | 2 |
| driver-eligibility-gate | Compliance | Replace prevalidated booleans with authoritative facts where appropriate | 3 |
| booking-approval-chain | Booking submit | Typed assignment descriptors; workflow definition integration | 4 |
| consent-re-consent-tolerance | Booking modify | Typed tolerance/change facts and version persistence | 5 |
| dedicated-vehicle-eligibility | Entitlement submit | Fact freshness, reason trace, high-impact governance | 6 |
| entitlement-approval-chain | Entitlement submit | Workflow route descriptor and definition version | 7 |
| fines-hr-threshold | Fines | Persist version used and no silent value fallback | 8 |
| black-point-timeframe | Fines | Jurisdiction/effective-date support | 9 |
| fuel-deviation-threshold | Handover | Typed percent, scope and provenance | 10 |
| compliance-alert-ladders | Scheduler | Implement consumer or retire as unused | 11 |
| hard-block-conditions | Compliance | Decide structural invariant vs policy; avoid duplicated authority | 12 |
| driver-eligibility | None/current registry | Implement named use or retire | 13 |

## 5. Structural invariant decision

Not every condition belongs in a customizable rule engine.

Keep as code/database invariant when violating it would corrupt data or breach a non-negotiable control, for example:

- No double booking.
- Immutable audit chain.
- Active vehicle date-range exclusion.
- Required consent before reservation transition.
- Authentication and task-assignee authorization.

A policy may add stricter controls but must not weaken structural invariants without a separately approved architecture/security change.

## 6. Booking integration

- Introduce booking fact assembler.
- Evaluate buffer and max duration before transaction.
- Persist all relevant policy version/deployment IDs, not only one version string.
- Eligibility produces a complete trace referenced by consent/booking.
- Approval route output starts a pinned workflow definition with route variables.
- Re-consent evaluation records its version and reasons.
- Remove hard-coded value/route fallback; handle typed failure policy explicitly.
- Preserve booking overlap exclusion and atomic consent/reservation/audit/outbox transaction.
- Resolve vehicle/requester scope, enforce authorized/cross-cluster behavior, and persist requested/resolved hierarchy codes/generation for audit.

## 7. Compliance integration

- Separate structural hard blocks from configurable policy.
- Fact assembler records HCM/vehicle source freshness.
- Persist decision ID/version/deployment and data-as-of.
- Fail closed on stale/invalid facts according to approved contract.
- Expose localized reasons and remediation to UI.
- Shadow test expired insurance/licence, active blocks, inactive employee, non-pool vehicle, and boundary dates.
- Validate person/home scope and vehicle assignment organization; handle missing home scopes as explicit data-quality/failure outcomes.

## 8. Entitlement integration

- Replace grade proxy facts when authoritative D8 facts become available.
- Persist eligibility and route decision provenance separately.
- Start versioned workflow definition and enforce author/approver SoD.
- Preserve consent and allocation transaction guards.
- Handle modification/review cycles without orphaned workflow linkage.

## 9. Fines and handover integration

### Fines

- Persist threshold/timeframe deployment IDs on resulting records/events where required.
- Use jurisdiction and effective-at event time, not processing time.
- Keep attribution algorithm/domain history separate from configurable thresholds unless explicitly redesigned.
- Ensure replay does not raise access blocks or notifications.

### Handover

- Persist fuel threshold decision provenance.
- Keep telematics odometer as authoritative domain rule.
- Policy flags advisory deviation; domain transaction records return and evidence.
- Ensure historical returns retain the policy version effective at return time.

### Vehicles, dashboards, roles and HCM

- Vehicle create/transfer validates organization, node level/status and active assignment history.
- Dashboard scope IDs are authorized server-side and passed from ScopeProvider query keys.
- Role assignment/revocation uses organization/scope consistency, concurrency locking and authorization-generation invalidation.
- HCM sync reconciles organization, line manager and home scope where authoritative; unmatched scopes become governed data-quality exceptions.

## 10. Workflow migration

- Create immutable `legacy-booking-approval-v1`, `legacy-entitlement-approval-v1`, and policy-review definitions.
- Existing active instances remain on legacy compatibility execution or drain before switch.
- New instances start new deployed definitions behind a feature flag.
- Convert workflow completion into idempotent domain events/commands.
- Prevent domain status transition if workflow subject/version no longer matches expected state.
- Preserve delegation and SoD behavior with parity tests.

## 11. Frontend integration

- Booking, eligibility, approval, entitlement, fine and handover views display decision reason and policy version where operationally useful.
- Approval evidence uses shared `DecisionTrace` with minimized facts.
- Provisional/degraded/last-known-good states are visible to authorized operational users.
- UI never recomputes policy outcomes or thresholds.
- Error reason codes are localized EN/AR.

## 12. Shadow comparison

For each decision:

- Run legacy and new runtime using the same normalized facts.
- Compare output, route, reasons, default use and errors.
- Log comparison evidence separately from production decision log.
- Define acceptable differences before execution.
- Block cutover on unexplained differences.
- Sample and aggregate to control volume/privacy.

## 13. Feature flags and rollback

Flags are scoped by decision key, environment, organization and optionally hierarchy scope:

- `legacy-only`
- `shadow`
- `new-canary`
- `new-primary-with-legacy-shadow`
- `new-only`

Rollback changes selector/deployment, not domain history. In-flight workflows remain pinned unless an approved incident action states otherwise.

## 14. Tests

- Golden parity for every current seed row/default.
- Domain integration tests proving persisted provenance.
- Failure-policy tests proving no silent fallback.
- Booking atomicity and overlap regression.
- Compliance hard-block and freshness regression.
- Workflow parity, SoD, delegation, modification and resubmission.
- Event-time effective-version tests for fines/handover.
- Shadow comparison volume/privacy tests.
- Feature-flag cutover and rollback tests.

## 15. Completion criteria by consumer

A consumer is migrated only when:

- It uses `DecisionService`, not the legacy evaluator.
- Its fact assembler is schema/freshness tested.
- It handles typed failures.
- It persists required provenance.
- Shadow parity is approved.
- UI reason/trace behavior is verified where applicable.
- Metrics, alerts and rollback are active.
- Legacy path removal date is recorded.

## 16. Exit gate

Phase 8 passes when O4/O6 are green, all resources/actions are organization/scope validated, all current PEPs and approval flows meet completion criteria, unused policies are retired, and no direct evaluator or runtime-built unversioned workflow remains without an approved dated exception.

The authoritative per-consumer gates and rollout order are maintained in the [Phase 8 sub-plan index](phase-8-domain-migration/README.md).
