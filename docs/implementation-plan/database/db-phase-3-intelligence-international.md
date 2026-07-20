# Database — Phase 3 (Intelligence & International)

**Goal:** add the data foundations for AI recommendations, ESG, CV comparison, jurisdiction packs, and the curated analytics feed — and take a decision on international residency that the P1 "one DB per org, UAE North" model does not yet cover.

**Scope source (opened to all capabilities):** [`../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`](../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md) (C11, C12, P3, P8, P11) · **Phase scope:** [`../../startup-doccs/05_Phase3_Intelligence_International_ADPorts.md`](../../startup-doccs/05_Phase3_Intelligence_International_ADPorts.md) · **Design:** [`../02_Database_Design.md`](../02_Database_Design.md) · **Backend:** [backend-phase-3-intelligence-international.md](../backend/backend-phase-3-intelligence-international.md).

**Entry gate:** [DB Phase 2](db-phase-2-scale-automate.md) gate green (`decision_log` hypertable; group-scale throughput validated).

---

## 1. Schema delta

| Group | Tables (new) | Capability |
|-------|--------------|-----------|
| AI recommendations | `recommendation` (type, subject_ref, drivers/reasoning jsonb, financial_case, status Accepted/Rejected/Superseded, decided_by, decided_at) — one shape for W1/W3/W4/W6 | C11 |
| Predictive / anomaly | `maintenance_risk_flag`, `anomaly_case` (review-queue status) | C11 |
| Driver risk | `driver_risk_score` (feeds the behaviour engine) | C10/C11 |
| CV | `cv_damage_candidate` (handover vs return, confidence, region_code, confirmed_by) | C4/C11 |
| ESG | `emission_factor` (per fuel type, D10 — configurable), `esg_metric` (fuel/CO₂ per node/period) | C12 |
| Jurisdiction | `jurisdiction_pack` + `policy_rule_template` (per-country rule-type templates), `policy_simulation_run` (draft vs active outcome diff) | P3 |
| Analytics | curated BI feed views / `bi_export_*` (read models for the group data platform) | P11 |

- **Recommendation & decision provenance:** every `recommendation` links to the `decision_log`/audit so an AI-derived output is fully traceable; **no AI table ever drives an autonomous state change** (guardrail C13) — a human decision row is required to act.
- **Model features** live in read-optimised feature tables / continuous aggregates over P1–P2 data, not in the transactional path.

## 2. International & residency (the architectural decision this phase forces)

The P1 model is **one database per organization, UAE North** (ADR-004/008 — the dormant `organization_id` is a multi-*org* seam, **not** multi-*region*). A genuine second-country deployment needs either **separate regional deployments** (preferred, keeps residency simple) or a multi-region database (latency/residency complexity). **This is a new ADR (gap P3D-1)** — the schema stance: keep per-deployment isolation; jurisdiction differences are **data** (`jurisdiction_pack`, `emission_factor`, `policy_rule_template`), never code branches.

## 3. Inspection Gate — Gap Analysis & Fixes

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P3D-1 | **International residency** not covered by the current data model | H | New ADR: regional deployments vs multi-region DB; jurisdiction diffs as data, not schema forks | Architecture + DB |
| P3D-2 | AI recommendations must **never** auto-mutate operational tables | H | `recommendation` is advisory-only; a human `decision` row (audited) is required to act; enforced by FK/trigger + service | DB + Backend |
| P3D-3 | Feature/analytics reads must not tax the transactional path | M | Feature tables + continuous aggregates + the curated BI feed read from replicas/aggregates, not `booking`/`fine` directly | DB + Data |
| P3D-4 | `emission_factor` (D10) is an external dependency → placeholder ESG | M | Model as configurable data; block ESG go-live until D10 closes | DB + Sustainability |
| P3D-5 | `policy_rule_template` versioning must reuse the immutable policy-version model | M | Templates are versioned like `policy_version`; simulation records the diff before activation | DB |
| P3D-6 | Multi-currency (W8) roll-ups from P2 non-AED contracts | M | Store currency + FX; group roll-ups convert consistently; report base currency explicit | DB + Finance |

**Exit criteria:** recommendation/decision provenance enforced (no autonomous mutation); ESG blocked until D10; jurisdiction templates versioned + simulated before activation; **international residency ADR approved** before any non-UAE go-live; all **H** gaps fixed.
