# Phase 3 — Intelligence & International (Backend + DB)

**Goal:** turn 6+ months of clean data into decisions (AI recommendations, predictive flags, an executive copilot) and prepare for deployment outside the reference organization. **AI guardrail (C13):** AI recommends, humans decide — no AI output auto-executes a blocking/disciplinary/financial action; the copilot enforces the same RBAC/scope as the UI. **Governing doc:** `05_Phase3_Intelligence_International_ADPorts.md`.

**Precondition:** Phase 2 production-readiness gate green; 6+ months of clean, dense data. **Exit:** §7 production-readiness gate green.

---

## 1. Workstream slices (backend + DB)

### W1 — AI optimisation engine
- **Backend:** under/over-utilisation detection, cost-per-km outliers, right-sizing with **net financial case** (uses Phase-2 off-hire penalty terms). Output = an **accept/reject recommendation card** only (never auto-executes).
- **DB:** `recommendation` (type, evidence, financial_impact, status, decided_by), `recommendation_feedback`.
- **Exit:** per-pool/per-model **data-readiness gate** (density + quality) before a model ships (P3-R1-1).

### W2 — Predictive maintenance
- **Backend:** breakdown-risk flags from mileage/age/accident/maintenance history; surfaced in the fleet console before downtime.
- **DB:** `maintenance_prediction`. **Exit:** precision tracked; alert-fatigue threshold defined.

### W3 — Anomaly & fraud detection
- **Backend:** off-hours patterns, fuel-vs-distance mismatch, toll-vs-destination mismatch — **human-decided queue**.
- **DB:** `anomaly_flag` (reuses the recommendation/decision pattern).

### W4 — Driver risk scoring
- **Backend:** fines + accidents + telematics → risk score feeding the Phase-2 behaviour engine; **HR gate unchanged**.
- **DB:** extend `behaviour_score` with risk inputs.

### W5 — AI Copilot
- **Backend:** NL booking + analytics, **role-permitted data only**; propose→confirm; all actions attributed + logged. Needs an **ML-safety design** (scope-checked retrieval, I/O filters, prompt-injection defense, red-team) **before build** (P3-R1-2), and a **model-selection ADR** + cost/latency guardrails + fallback model (P3-R2-3).
- **DB:** `copilot_session`, `copilot_action` (attributed, logged).

### W6 — CV damage comparison
- **Backend:** handover vs return photo sets auto-compared; new-damage candidates → human-confirm queue (advisory). Uses Phase-1 normalized `damage_pin` coords + Phase-2 photos.
- **DB:** `damage_comparison` (confidence, confirmed_by). **Exit:** labeled photo-pair set + confidence thresholds; precision measured (P3-R2-4).

### W7 — ESG & sustainability
- **Backend:** fuel/CO₂ per vehicle/pool/cluster/group (emission factors **D10**), EV/hybrid share, exportable report, EV-transition scenarios.
- **DB:** `esg_snapshot`, `emission_factor` (config). **Exit:** D10 closed (factors defensible).

### W8 — International & platform maturity
- **Backend:** multi-currency, Arabic RTL full UI (approval-gated S-01), **jurisdiction packs = policy-engine rule-type templates per country**, **full historical policy simulation** in the admin studio (matures the Phase-1 dry-run), curated BI feed, public API maturity.
- **DB:** `jurisdiction_pack`, `currency_rate`; **`decision_log` → Timescale hypertable** (high-write at scale).
- **ADR required:** multi-region / residency (regional deployments vs multi-region DB) — the dormant `organization_id` seam is multi-*org*, not multi-*region* (P3-R2-2 / A-07).

---

## 2. Cross-cutting Phase-3 infrastructure
- **MLOps / eval harness:** golden sets, automatic metrics, drift detection, **eval-in-CI** for every model + the copilot + OCR accuracy (P3-R2-1). Without it, models silently degrade.
- **One recommendation component + decision-log schema** reused by W1/W3/W4/W6 (P3-R1-3).
- **Model-selection ADR**, cost guardrails, fallback model for the copilot (P3-R2-3).

---

## 3. Critique & gap analysis — Round 1 (data readiness & AI governance)

| # | Gap | Sev | Resolution |
|---|---|---|---|
| P3B-R1-1 | No per-model data-readiness gate; sparse pools produce guesses | H | Per-pool/per-model density + quality entry gate; ship only where data suffices |
| P3B-R1-2 | Copilot safety unaddressed (prompt injection, cross-scope leakage, PII) | H | ML-safety design (scope-checked retrieval, I/O filters, injection defense, red-team) before W5 |
| P3B-R1-3 | Recommendation UX + decision logging undesigned across W1/W3/W4/W6 | M | One recommendation component + decision-log schema reused everywhere |
| P3B-R1-4 | W8 circularity: jurisdiction packs need simulation to validate, both in W8 | M | Build historical simulation first, then author + simulate packs |
| P3B-R1-5 | ESG emission factors (D10) external dependency | M | Close D10 (Sustainability) before ESG go-live |

## 4. Critique & gap analysis — Round 2 (MLOps, architecture, residency)

| # | Gap | Sev | Resolution |
|---|---|---|---|
| P3B-R2-1 | No MLOps/eval harness → undetected model rot | H | Stand up eval harness (golden sets, metrics, drift alerts, eval-in-CI) as Phase-3 infra |
| P3B-R2-2 | International residency conflicts with one-DB-per-org/UAE-North; dormant `organization_id` is multi-org not multi-region | H | New ADR for multi-region/residency (regional deployments vs multi-region DB) before international go-live |
| P3B-R2-3 | Copilot cost/latency/model-selection unaddressed | M | Model-selection ADR + cost/latency guardrails + fallback model |
| P3B-R2-4 | CV needs labeled photo pairs at scale + false-positive-fatigue mgmt | M | Labeled set + confidence thresholds + human-confirm queue; measure precision |
| P3B-R2-5 | `decision_log` at scale outgrows a plain table | M | Migrate `decision_log` to a Timescale hypertable + retention/aggregates |
| P3B-R2-6 | Accountability for repeatedly-ignored recommendations | L | Quarterly review of accepted/rejected recommendation trends |
| P3B-R2-7 | AI output could bypass "humans decide" via an automation path | H | No write path from any AI output to a blocking/disciplinary/financial action; enforced by design + test |

## 5. Validation & verification
- Every model passes its **data-readiness gate** before shipping per pool.
- **Eval harness** green in CI (acceptance rate, false-positive rate, OCR accuracy, drift) with alert thresholds.
- Copilot: scope-checked retrieval + injection red-team + RBAC-on-every-response tests; cost/latency within guardrails.
- No AI output has a write path to a blocking/disciplinary/financial action (design review + test).
- Multi-region ADR approved before any international deployment.

## 6. Data model additions
`recommendation` · `recommendation_feedback` · `maintenance_prediction` · `anomaly_flag` · `copilot_session` · `copilot_action` · `damage_comparison` · `esg_snapshot` · `emission_factor` · `jurisdiction_pack` · `currency_rate`; `decision_log` → hypertable.

## 7. ✅ Production-readiness gate — Phase 3 (all must pass)
- [ ] Per-model **data-readiness gate** enforced; models ship only where data density/quality suffices.
- [ ] **Eval harness** in CI for every model + copilot + OCR; drift alerts live.
- [ ] Copilot: ML-safety design implemented (scope retrieval, injection defense, PII filters); RBAC/scope enforced on **every** response; red-team passed; model-selection ADR + cost/latency guardrails + fallback in place.
- [ ] **AI recommends, humans decide** — verified no auto-execute path to blocking/disciplinary/financial actions; one audited recommendation+decision pattern across W1/W3/W4/W6.
- [ ] CV damage: precision measured; human-confirm queue; false-positive fatigue managed.
- [ ] ESG factors (D10) closed; ESG numbers defensible.
- [ ] Jurisdiction packs validated via historical simulation; **multi-region/residency ADR approved** before international go-live.
- [ ] `decision_log` hypertable migration proven at scale.
- [ ] Round 1 & Round 2 findings each **closed or accepted-with-dated-risk**.

**Back to:** [README](README.md) · [Migration catalog & conventions](04_migration-catalog-and-conventions.md).
