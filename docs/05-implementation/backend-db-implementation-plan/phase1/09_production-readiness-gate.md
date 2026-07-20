# Phase 1 — Production-Readiness Gate

From [01_phase1-mvp.md](../01_phase1-mvp.md) §8, carried verbatim with the **sub-phase that proves each item** and the **evidence type**. Phase 1 is production-ready **only when all boxes are green, reviewer-verified, with evidence attached** — a document edit is never evidence. Gate closure is owned by [1G](07_sub-phase-1g_hardening-and-gate.md).

---

## Implementation status — 2026-07-18 (engineering evidence)

Local gate on the built `app-api`: **unit 209/209 · integration 62/62 (16 suites) · e2e 5/5 · depcruise 245 modules / 0 violations · guard:org ✓ · guard:contracts ✓ (16) · build 187 files · `pnpm migration:test` ✓**. DB at migration `0012`.

**Engineering-provable gate items — GREEN:**

| Gate item | Status | Evidence (test/artifact) |
|---|---|---|
| 12 PDP rule types + decision tables | ✅ | policy evaluator/registry + `decision-table` specs |
| SoD-01..08 + hard-block override = logged denial | ✅ | `sod-guard.spec`; booking SoD-01, entitlement SoD-02 (unit+int); eligibility hard-block int |
| Consent hard gate + single-transaction atomicity | ✅ | `booking.service.spec` + `booking.int-spec` (number only after consent commits) |
| Zero bookings on expired Mulkiya/insurance | ✅ | `booking.int-spec` (expired doc ⇒ Forbidden, no number) |
| Double-booking race impossible | ✅ | `booking.int-spec` + **`binding-load.int-spec`** (30 concurrent ⇒ 1 reservation, every loser 409, no lost consent) |
| Fine attribution: substitution boundary/overlap + late-Completed-booking + assigned fallback | ✅ | `fines-attribution.spec` + `fine.int-spec` |
| Transactional outbox/inbox + DLQ replay + crash-replay | ✅ | `outbox-inbox.int-spec` |
| Audit hash chain verifies under concurrency | ✅ | `audit-chain.int-spec` (50 concurrent appends) |
| Migration forward + idempotent + full Phase-1 schema + exclusion constraints present | ✅ | `pnpm migration:test` (programmatic migrator — TTY-independent / CI-safe) |
| Eligibility gate p95 < 500 ms · PDP evaluate p95 < 200 ms | ✅ | `binding-load.int-spec` (eligibility p95 ≈ 256 ms); `pdp-load-floor.int-spec` |
| Concurrent contention never leaks a 500 (deadlock/serialization ⇒ retryable 409) | ✅ | `pg-error` maps 40001/40P01; proven in `binding-load.int-spec` |

**Ops / human / external gate items — PENDING (cannot be closed by code; owner + scheduled before go-live):**

| Gate item | Status | Owner |
|---|---|---|
| Full **5,000-vehicle telemetry burst + 500-user HTTP soak** (k6/artillery vs a deployed env); event-loop p99 < 10 ms; ingest lag → 0 < 60 s | ⏳ pending | Platform / SRE |
| Timed **RPO ≤ 1 h / RTO ≤ 4 h** DR restore | ⏳ pending | Platform / SRE |
| **Pen test** + full security pipeline (SAST/DAST/SCA/secrets/IaC/container) | ⏳ pending | Security |
| **D4 PDPL** sign-off · steward **≥98%** migration sign-off · **GS Pool UAT** · sponsor/security/ops **go/no-go** · rollback authority named | ⏳ pending | Governance / Sponsor |

> The **engineering (code-level) gate is green** with the evidence above. The remaining boxes are ops/human/external validations that must run against a **deployed** environment with real stakeholders — they are **not** closed by this implementation and are tracked as **accepted-with-dated-risk** until performed.

---
| ✔ | Gate item | Proven in | Evidence |
|---|---|---|---|
| ☐ | All **12 PDP rule types** pass decision-table tests; production values either signed-off (D-list) or explicitly on flagged fixtures with dated risk | [1A](01_sub-phase-1a_platform-completion.md) | Passing decision-table suite + per-rule-type status register |
| ☐ | **SoD-01..08** proven by executable tests; hard-block override attempts denied + logged | [1A](01_sub-phase-1a_platform-completion.md), [1D](04_sub-phase-1d_core-loop.md), [1E](05_sub-phase-1e_governance.md) | SoD integration tests; exception-report entry on override attempt |
| ☐ | **Consent hard gate:** no booking number / allocation without a committed, versioned consent record; re-consent on material change; single-transaction atomicity tested | [1D](04_sub-phase-1d_core-loop.md) | Consent atomicity integration test (crash between write + number) |
| ☐ | **Zero bookings possible on expired Mulkiya/insurance** (hard block), proven | [1D](04_sub-phase-1d_core-loop.md) | Hard-block test; no-override-path test |
| ☐ | **Double-booking race** impossible (`btree_gist` + concurrent tests green) | [1D](04_sub-phase-1d_core-loop.md) | Concurrent create/modify/extend test |
| ☐ | Inventory migrated **≥98% complete**, steward signed off; corrective-entry pattern defined | [1B](02_sub-phase-1b_master-data.md) | Reconciliation report + steward sign-off |
| ☐ | Telematics: ≥90% simulated coverage; trip-attach verified against **adversarial** trips; `TelemetrySource` swap-tested; **D4 PDPL sign-off** | [1C](03_sub-phase-1c_telematics-domain.md) | Coverage metric; adversarial-attach test; swap test; D4 sign-off |
| ☐ | Fine auto-attribution correct incl. substitution windows + boundary/overlap edges | [1E](05_sub-phase-1e_governance.md) | Attribution tests (boundary, overlap, no-active-booking) |
| ☐ | **Binding load test** (real modules + migrated data): eligibility p95 < 500 ms · PDP p95 < 200 ms · `api` event-loop p99 < 10 ms · ingest lag → 0 < 60 s | [1G](07_sub-phase-1g_hardening-and-gate.md) | Load-test report with the four thresholds |
| ☐ | Timed **RPO ≤1h / RTO ≤4h** restore + outbox/inbox/DLQ/scheduled-work replay drill passes | [1G](07_sub-phase-1g_hardening-and-gate.md) | Timed DR drill + replay report |
| ☐ | Pen test + security pipeline pass; audit hash chain verifies end-to-end | [1G](07_sub-phase-1g_hardening-and-gate.md) | Pen-test report; pipeline gate; chain verification job |
| ☐ | GS Pool UAT signed; no open Sev-1/Sev-2; sponsor/security/ops go/no-go signed; rollback authority named | [1G](07_sub-phase-1g_hardening-and-gate.md) | UAT sign-off; go/no-go record |
| ☐ | Round 1 & Round 2 findings each **closed or accepted-with-dated-risk** | [08](08_critique-and-gap-analysis.md) via [1G](07_sub-phase-1g_hardening-and-gate.md) | Reviewer-signed critique register |

## Sub-phase completion checklist (each has its own exit gate)

- ✅ **1A** — 12 rule types + fuel tested & logged; workflow (chains/delegation/SLA/modify/reroute); hierarchy full; notifications (unmutable floors); HCM sync + freshness; PDP escalate half.
- ✅ **1A₂** — all dropdowns source from bilingual (EN/AR) lookups incl. parent-child; org tree bilingual + entity (ADR-009); SSO JIT provisioning; admin role assign/revoke with SoD-at-assignment + audit; access-review export; `source`/`assigned_by` provenance for future HCM.
- ✅ **1B** — vehicle master + documents/transfer/history; import ≥98% + steward sign-off; not-bookable trigger; uniqueness; `vehicle_hierarchy_assignment` exclusion.
- ✅ **1C** — device registry/pairing; live map; auto-odometer; trip-attach vs adversarial; `TelemetrySource` swap; D4 privacy on simulated data. (Real bookings adapter wired into the trip-attach port — P1B-R1-1 closed.)
- ✅ **1D** — compliance gate (hard block, no override); booking + consent (atomic, versioned); handover/return/damage; double-booking impossible; SoD-01; tz/DST.
- ✅ **1E** — entitlement Cluster-CEO chain (SoD-02); fines auto-attribution incl. substitution boundary/overlap; black-point platform-wide block; HR threshold.
- ✅ **1F** — dashboards + role/scope cost masking; `GET /operations/overview` real read model (mock retired, now authenticated); measurable-now scoping.
- 🟡 **1G** — **engineering portion ✅** (binding booking-concurrency, consent atomicity, DLQ/crash replay, audit-chain-under-load, migration dry-run incl. exclusion constraints, eligibility p95 + PDP p95 floors, contention→409). **Ops portion ⏳** (full 5k-veh/500-user soak, timed DR restore, pen test, UAT, go/no-go) — pending against a deployed env.

> **Do not declare Phase 1 done** until every box above is green with attached evidence. The escalation "+ human" half and the *binding* load test that Phase 0 explicitly deferred are completed here — noted, not silently dropped.
