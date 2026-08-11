# INT-2 Decision and Workflow Migration Plan

**Status:** `ACTIVE_PLAN_BASELINE_APPROVED_FOR_AUTONOMOUS_EXECUTION`  
**Updated:** 2026-08-01  
**Owner:** Delivery Orchestrator with Backend, Frontend, Data, QA, SRE and Reviewer roles  
**Source plans:** `decision-and-workflow-platform-plan/08-domain-integration-and-legacy-migration.md` and `phase-8-domain-migration/00-10`  
**Entry gate:** INT-1 O4 `VERIFIED_COMPLETE`; O6 foundation retained; stable Booking, Dedicated, Handover and Operations journeys

## 1. Objective

Migrate every active domain decision and approval workflow to the organization/scope-aware decision boundary with typed failures, immutable provenance, independent shadow parity, deterministic canary selection, tested rollback and operational UI evidence. Finish only when direct legacy evaluator/runtime-built workflow paths are removed or covered by an approved dated exception.

This plan controls implementation order and evidence. Older Phase 8 documents remain requirements references; where their current-state statements conflict with source or this plan, this plan wins.

## 2. Current-State Inspection Baseline

### Verified foundations

- 8.0 baseline, 8.1 `DomainDecisionService`/selector/comparison schema and 8.2 Booking values/re-consent are implemented.
- INT-1 O4 is verified: tenant/scope boundaries, effective roles/nodes/Vehicle assignments/delegations, scoped telemetry and persisted UI scope revocation.
- Booking approval-chain now enters `DomainDecisionService`, persists selector-aware provenance once across replay, and starts an organization-pinned immutable deployment under `legacy-booking-approval-v1`.
- Entitlement workflow starts under `legacy-entitlement-approval-v1`.
- Workflow deployments, decided steps and Booking route lineage are DB-immutable.
- Selector supports `legacy-only`, `shadow`, `new-canary`, `new-primary-with-legacy-shadow` and `new-only`; canary bucketing and privacy-minimized comparison persistence exist.

### Remaining direct decision consumers

| Decision | Consumer | Current boundary | Required migration |
|---|---|---|---|
| `booking-approval-chain` | Booking submit | Domain adapter, but legacy/new both call the same evaluator | Independent legacy comparator, parity, rollback, selector inheritance |
| `driver-eligibility-gate` | Compliance | Direct `PolicyEvaluatorService` after structural hard blocks | Domain adapter, authoritative facts/provenance, fail-closed parity |
| `dedicated-vehicle-eligibility` | Entitlement preview | Direct evaluator | Domain adapter, separate persisted eligibility provenance |
| `entitlement-approval-chain` | Entitlement submit | Direct evaluator | Domain adapter, route parity, explicit workflow definition and rollback |
| `fines-hr-threshold` | Fine post-processing | Direct evaluator with fallback behavior | Event-time adapter, persisted provenance, replay-safe effects |
| `black-point-timeframe` | Fine/black-point creation | Direct evaluator with fallback behavior | Event-time adapter, persisted provenance, no duplicate blocks |
| `fuel-deviation-threshold` | Handover Return | Direct evaluator | Event-time adapter and receipt/history provenance |
| `compliance-alert-ladders` | No active consumer | Registered only | Implement governed consumer or retire explicitly |
| `hard-block-conditions` | No active consumer | Structural rules in code | Retire as policy or document invariant ownership |
| `driver-eligibility` | No active consumer | Registered only | Retire or assign a named consumer |

### Frontend baseline

- Booking approval, Dedicated approval, Handover/Return, receipt/chain, Policy Studio and Operations pages exist with EN/AR/RTL.
- Booking approval evidence can render reason/version where supplied, but cross-domain provenance/degraded-state presentation is not yet consistent.
- Fines and Compliance operational surfaces are incomplete for Phase 8.9 evidence.
- UI must never evaluate rules or thresholds; it presents backend decision traces only.

### Concurrent workstream isolation

Migration `0057_person_credentials`, HCM configuration, credential APIs, profile hooks and booking reason-message changes are a concurrent credential/HCM stream. INT-2 must preserve them and may consume their stable eligibility facts, but must not rewrite their schema, contracts or UI unless an INT-2 acceptance criterion requires a compatible additive change. Shared-file edits require re-read and focused regression.

## 3. Non-Negotiable Invariants

1. Persisted resource organization/scope/effective time is authoritative; request bodies never select authority.
2. Shadow evaluation is side-effect-free and never creates a second workflow, block, notification, fine or Handover mutation.
3. Structural controls remain code/DB invariants and cannot be weakened by policy.
4. Every migrated primary result records decision key, selector ID/revision/mode, source, deployment/rule/version IDs, requested/resolved scope, effective/evaluated time, reasons, fingerprint and correlation.
5. No silent value, route or threshold fallback in a migrated consumer.
6. Workflow instances remain pinned across selector/policy/role changes and rollback.
7. Rollback changes selector/configuration, never historical domain evidence.
8. PII is minimized in comparisons/logs; comparison subjects and correlations remain fingerprinted.
9. New state-changing administration endpoints require Principal-bound RBAC, optimistic revision/idempotency where applicable, audit and transactional outbox.
10. EN/AR/RTL and accessibility parity are mandatory for changed UI surfaces.

## 4. Mandatory Phase Loop

Every phase follows this exact loop:

1. **Pre-entry critique:** inspect current code/data/tests and record Blocking/High risks and cheapest falsifying checks.
2. **Plan delta:** update this file if source reality changes; identify owned/shared files and rollback.
3. **Small first edit:** make the narrowest grounded implementation change.
4. **Immediate focused validation:** run the cheapest executable test that can falsify the hypothesis.
5. **Complete phase implementation:** backend, DB, frontend and documentation as applicable.
6. **Focused and neighboring validation:** unit, PostgreSQL/HTTP, static/guards, UI EN/AR where changed.
7. **Independent post-phase critique:** separate reviewer; repair all Blocking/High findings and re-review.
8. **Evidence/status update:** append `EVIDENCE-REGISTER`, update `MASTER-STATUS`, gaps and repository memory.
9. **Advance automatically** only after the exit gate is green.

## 5. Phase Sequence

| Phase | Status |
|---|---|
| INT2-00 | `VERIFIED` |
| INT2-01 | `VERIFIED` |
| INT2-02 | `VERIFIED` |
| INT2-03 | `VERIFIED` |
| INT2-04 | `ACTIVE` |
| INT2-05 through INT2-09 | `NOT_STARTED` |

### INT2-00 — Baseline Freeze and Ownership Map

**Outcome:** Reconcile source, migrations through `0057`, concurrent changes, direct consumers, selector modes and test commands; freeze ownership boundaries.

**Implementation:**
- Record exact consumer matrix above and direct-call guard baseline.
- Verify contract manifest rather than regenerating over concurrent changes.
- Add no behavior changes.

**Exit evidence:** backend/frontend typecheck; focused adapter/workflow tests; migration journal consistency; current changed-file inventory; pre-entry independent critique.

**Rollback:** documentation-only.

### INT2-01 — Selector, Comparison and Administration Hardening

**Outcome:** Close 8.1 residual gates before further domain cutover.

**Implementation:**
- Prove nearest-ancestor selector inheritance, organization/environment isolation and organization-default fallback with real PostgreSQL.
- Prove deterministic canary buckets and comparison sampling boundaries.
- Add guarded selector read/update administration API with revision conflict, audit and bounded percentages if not already exposed.
- Add comparison summary/read API for authorized operators without raw facts/subjects.
- Define comparison retention and indexes; add migration only if storage changes are needed.

**Pre-critique focus:** selector ambiguity, cross-org leakage, hash stability, comparison uniqueness/privacy, audit transactionality.

**Exit gate:** selector matrix, canary determinism, revision conflict, comparison privacy/retention and rollback-to-legacy tests pass; independent review has no Blocking/High.

**Rollback:** set selector to `legacy-only`; administration API may be disabled without changing stored history.

### INT2-02 — Booking Approval Workflow Migration (8.3)

**Outcome:** Complete Booking route parity, immutable definition governance and rollback.

**Implementation:**
- Preserve the verified adapter/provenance/idempotent backbone.
- Implement an independent legacy Booking route adapter frozen to pre-migration semantics; it must not call the new evaluator.
- Import/govern explicit `legacy-booking-approval-v1` and target Booking definition snapshots; do not create unknown definitions implicitly in production.
- Shadow compare role descriptors, resolved assignee order, SLA and unavailable-assignee/error behavior without starting a second workflow.
- Prove selector inheritance and all modes for Booking.
- Rehearse `legacy-only -> shadow -> new-canary -> new-primary-with-legacy-shadow -> new-only -> legacy-only` rollback.
- Prove in-flight instances remain pinned while new instances follow the changed selector.
- Add operational comparison/rollback runbook and divergence threshold.

**Pre-critique focus:** false parity from same implementation, duplicate tasks, role changes after start, unavailable approvers, SoD/delegation, resubmission cycles, correlation PII.

**Exit gate:** unexplained route/error divergence is zero for golden and PostgreSQL scenarios; rollback and pinned instances pass; no duplicate workflow/effects; independent review has no Blocking/High.

### INT2-03 — Compliance and Driver Eligibility (8.4)

**Outcome:** Migrate configurable eligibility while preserving structural hard blocks.

**Implementation:**
- Define authoritative fact assembler including organization, driver/Vehicle scope, credential provenance, HCM enabled/freshness and data-as-of.
- Keep missing/expired licence, expired Vehicle documents, inactive employment, active access block and non-bookable Vehicle structural and fail-closed.
- Route only the configurable eligibility decision through `DomainDecisionService`.
- Persist full decision provenance in `eligibility_evaluation` or a linked immutable decision record.
- Shadow expired/missing/stale/manual/HCM/access-block and cross-org scenarios.
- Add remediable/degraded contract fields only when backed by real behavior; preserve concurrent credential stream.

**Pre-critique focus:** fail-open risk, HCM-disabled manual mode, PII leakage, stale data, duplicate evidence, structural/policy authority overlap.

**Exit gate:** hard blocks cannot be weakened; typed failures and provenance pass; shadow parity/rollback proven; changed Booking/Dedicated UI messages pass EN/AR; no Blocking/High.

### INT2-04 — Entitlement Eligibility and Approval Workflow (8.5)

**Outcome:** Separate Dedicated eligibility and approval-route provenance and pin governed workflow definitions.

**Implementation:**
- Migrate `dedicated-vehicle-eligibility` and `entitlement-approval-chain` through the domain adapter.
- Persist separate immutable decision traces; do not combine eligibility and route evidence.
- Govern `legacy-entitlement-approval-v1` and target definition snapshots.
- Shadow route/assignee/SLA/unavailable role behavior; preserve requester vs assigned-driver consent and allocation exclusivity.
- Rehearse selector rollback with in-flight workflow and modification/resubmission.

**Pre-critique focus:** D8 fact authority, professional-driver freshness, preference leakage into allocation, incomplete route, duplicate workflow, consent actor separation.

**Exit gate:** eligibility/route parity and rollback green; complete pinned route; Dedicated PostgreSQL/concurrency/UI regressions pass; no Blocking/High.

### INT2-05 — Fines and Black-Point Decisions (8.6)

**Outcome:** Event-time thresholds/timeframes with persisted provenance and replay-safe effects.

**Implementation:**
- Add immutable Fine/black-point decision evidence linked to Fine and event time.
- Migrate `fines-hr-threshold` and `black-point-timeframe` through adapter; remove silent constants.
- Evaluate policy effective at offence/event time, not processing time.
- Ensure shadow/replay cannot emit duplicate HR alerts, blocks, notifications or recovery instructions.
- Prove cross-org isolation, attribution history and rollback.

**Pre-critique focus:** duplicated effects, historical policy drift, fallback constants, jurisdiction, late-arriving fines, privacy/cost masking.

**Exit gate:** event-time version/provenance, idempotency and rollback pass; no silent fallback; no Blocking/High.

### INT2-06 — Handover Fuel Advisory (8.7)

**Outcome:** Return reconciliation retains historical advisory policy evidence.

**Implementation:**
- Migrate `fuel-deviation-threshold` through adapter using Return event time and Vehicle scope.
- Persist full provenance with immutable Return/receipt evidence.
- Preserve odometer/condition/key/damage structural logic and command replay.
- Shadow and rollback without changing Booking completion or evidence claims.
- Present provenance/degraded status in receipt/chain only when contractually useful.

**Pre-critique focus:** replay drift, duplicate Return, fallback threshold, telemetry/manual conflict, legacy partial records, receipt fabrication.

**Exit gate:** historical Return keeps version/threshold/source; replay stable; Handover PostgreSQL/HTTP/UI matrix green; no Blocking/High.

### INT2-07 — Alert Ladders and Unused Rule Governance (8.8)

**Outcome:** Every registered rule has a named consumer or explicit retirement decision.

**Implementation:**
- Implement `compliance-alert-ladders` only if an owned scheduler/notification contract exists; otherwise retire with ADR/evidence.
- Classify `hard-block-conditions` as structural invariant and remove misleading active policy artifacts.
- Retire or assign `driver-eligibility` to a named consumer.
- Add CI inventory guard preventing active unowned rules and unregistered direct evaluator calls.

**Pre-critique focus:** duplicate authority, dormant active policy, notification spam, accidental hard-block configurability.

**Exit gate:** zero unexplained active/unowned rules; inventory guard and migration/rollback pass; no Blocking/High.

### INT2-08 — Domain UI Decision Evidence (8.9)

**Outcome:** Authorized users see minimized, localized decision reason/version/degraded evidence consistently.

**Implementation:**
- Define one frontend decision-trace presentation contract sourced from backend DTOs.
- Booking/Dedicated approvals show relevant reason, version/source and degraded state without PII.
- Handover receipt/chain shows advisory provenance where operationally relevant.
- Implement the minimum Fines/Compliance views required to verify migrated decision evidence; do not create unrelated marketing surfaces.
- Add EN/AR reason mapping, RTL, loading/error/empty/degraded and accessibility tests.
- Retain server-side scope as authority; selected UI scope may narrow queries only where APIs support it.

**Pre-critique focus:** raw codes, PII/fact leakage, fake provider data, client recomputation, stale selected scope, mobile overflow.

**Exit gate:** all migrated decision evidence has an authorized UI or documented API-only exception; EN/AR responsive/accessibility matrix green; no Blocking/High.

### INT2-09 — Shadow/Canary/Cutover and Legacy Removal (8.10)

**Outcome:** Safe promotion to new-only or explicit dated exception for every active consumer.

**Implementation order:** Handover advisory -> Booking values -> Fines advisory -> Entitlement eligibility -> Booking/Entitlement workflows -> driver eligibility -> blocking black-point behavior.

**Per-consumer promotion:**
1. `legacy-only` baseline.
2. `shadow` at approved sample/scopes.
3. Resolve every unexplained divergence.
4. `new-canary` with deterministic percentage.
5. `new-primary-with-legacy-shadow`.
6. `new-only` after SLO/observation gate.
7. Rehearse rollback during every promotion step.
8. Remove direct legacy path only after the rollback window and retention approval.

**Observability:** volume, p50/p95/p99, timeout/error/fail-safe, comparison categories, provenance completeness, workflow SLA, effects and rollback events by decision/consumer/org/scope/mode.

**Pre-critique focus:** vanity parity, unobserved scopes, selector/cache mismatch, effectful shadow, rollback rewriting history, premature removal, alert without owner/action.

**Exit gate:** every consumer new-only or explicitly excepted; direct evaluator/runtime definition guard passes; rollback runbook rehearsed; SRE/domain/support approval recorded; final independent end-to-end critique has no Blocking/High.

## 6. Validation Matrix

| Layer | Minimum command/evidence per affected phase |
|---|---|
| Contracts | `pnpm guard:contracts`; update manifest only after re-reading concurrent changes |
| Backend static | `pnpm typecheck`, `pnpm lint`, `pnpm guard:org`, `pnpm build`, `git diff --check` |
| Database | migration forward + idempotency + rollback where safe; real PostgreSQL integration |
| Decision | selector inheritance/modes, comparison category/privacy, typed result/failure, provenance completeness |
| Workflow | definition/deployment pinning, replay/race, unavailable assignee, SoD/delegation, rollback with in-flight instance |
| Domain | focused unit + neighboring integration + failure injection and replay |
| Frontend | Vitest/RTL/MSW; EN/AR; 320/1440; no raw codes/PII/overflow; accessibility |
| Performance | shadow overhead and domain-specific p95 floors; no unbounded comparison growth |
| Review | independent critique before and after every phase; all Blocking/High repaired and re-reviewed |

## 7. File Ownership and Integration Rules

- **Orchestrator-owned shared surfaces:** schema barrel, migration journal, contracts manifest, app module, lockfile, selector/workflow core, master/gap/evidence ledgers.
- **Domain-owned:** Booking, Compliance, Entitlement, Fines, Handover source/tests and their phase-specific migrations.
- **Frontend-owned:** feature contracts/pages/tests and both locale catalogs.
- **Concurrent credential/HCM stream:** migration `0057`, person credential schema/contracts/services/profile files and booking reason UI. Re-read before overlap; preserve all changes.
- No destructive cleanup or unrelated refactor. No commit/branch unless requested.

## 8. Program Completion and Non-Claims

Until INT2-09 passes, do not claim complete Phase 8 cutover, production new-only policy operation, legacy removal or SRE-approved rollout. A phase may be `BACKBONE_VERIFIED` or `TECHNICALLY_VERIFIED` while human production observation/approval remains explicit.

## 9. Immediate Next Action

Execute INT2-00 evidence freeze, then INT2-01 selector/inheritance/administration hardening. INT2-02 Booking parity begins only after INT2-01 exit evidence is green.