# AD Ports Group — Fleet Management Platform
# Phase 3 Scope — Intelligence & International

**Version 3.1-P3 (Outline) · Precondition: Phase 2 rolled out group-wide with 6+ months of clean operational data**

## Goal

Turn two-plus years of accumulated booking, cost, fines and telematics data into decisions — AI recommendations, predictive flags, an executive copilot — and take the platform international (and optionally productised beyond AD Ports).

Why AI waits until Phase 3: every model below feeds on history the earlier phases generate. Predictive maintenance needs breakdown records; right-sizing needs months of utilisation; behaviour risk needs booking patterns. Built earlier, they would guess; built now, they are accurate.

## Scope — 8 workstreams

| # | Workstream | What ships | Feeds on |
|---|---|---|---|
| W1 | AI optimisation engine | Under/over-utilisation detection, high cost-per-km outliers, fleet right-sizing per pool/cluster, lease-reduction recommendations with **net financial case** (uses off-hire penalty terms from Phase 2 W8) | P1 bookings, P2 costs & contracts |
| W2 | Predictive maintenance | Breakdown-risk flags from mileage, age, accident and maintenance history; surfaced in fleet console before downtime happens | P2 maintenance & telematics |
| W3 | Anomaly & fraud detection | Off-hours booking patterns, abnormal trips, fuel-volume vs distance mismatch, toll crossings inconsistent with destinations — review queue, human-decided | P2 fuel, toll, GPS data |
| W4 | Driver risk scoring | Fines + accidents + telematics signals combined into a risk score feeding the Phase 2 behaviour engine; HR gate unchanged | P1 fines, P2 scoring |
| W5 | AI copilot | Natural-language booking ("book me a 7-seater tomorrow 9–3") and analytics ("top 5 most expensive vehicles per km this quarter, Ports cluster") — answers strictly from role-permitted data; copilot proposes, user confirms; all actions attributed and logged | Everything |
| W6 | CV damage comparison | Handover vs return photo sets auto-compared; new-damage candidates highlighted for fleet-manager confirmation (advisory, human-confirmed) | P2 W4 photo capture |
| W7 | ESG & sustainability | Fuel trends, CO₂ per vehicle/pool/cluster/group (emission factors per D10), EV/hybrid utilisation share, exportable ESG report, EV-transition scenario modelling (cost + CO₂ impact of replacing flagged high-emission vehicles) | P2 fuel & toll data |
| W8 | International & platform maturity | Multi-currency, multi-language UI (Arabic RTL first), multi-region residency, **jurisdiction packs = policy-engine rule-type templates per country** (compliance types, penalty models like black points, toll models — deploying a new country is configuration, not code); **full historical policy simulation in the admin studio** (matures the P1 dry-run: test any draft rule against months of real transactions, see outcome diff before activation); direct traffic-authority fines feeds where APIs open; curated BI feed to group data platform; public API v1 + webhooks; optional per-organization convenience tooling (branding, setup wizard) if a re-deployment for another organization is planned — reusability itself is already delivered by the configurable core from Phase 1 | P1 policy engine |

## AI guardrails (non-negotiable)

- Every recommendation carries an explanation (the drivers behind it) and an accept/reject/comment control.
- No AI output autonomously executes a blocking or disciplinary action — AI flags, humans decide.
- Copilot enforces the same RBAC and cost-masking as the UI on every response.
- Model performance monitored: recommendation acceptance rate, anomaly false-positive rate, OCR accuracy.

## Phase 3 KPIs

| KPI | Target |
|---|---|
| Fleet right-sizing actions taken on AI recommendation | Baseline set, quarterly upward trend |
| Recommendation acceptance rate | ≥ 40% (with rejection reasons captured) |
| Predictive-maintenance flags preceding actual breakdowns | Precision tracked; alert fatigue < defined threshold |
| Cost-per-km computed (incl. tolls) | ≥ 90% of fleet |
| ESG reporting coverage | ≥ 95% of fleet |
| Copilot weekly active usage (manager+ roles) | Adoption tracked & trended |

## Blocking decisions for Phase 3

D5 (currencies/clusters per phase — international wave plan) · D10 (CO₂ emission factors).

## Top risks

| Risk | Mitigation |
|---|---|
| Dirty or sparse history weakens models | Data-quality KPIs enforced from P1; models ship per-pool only where data density suffices |
| Recommendation fatigue / low trust | Explanations + financial case attached; start with top-3 recommendations, not firehose |
| Fines-authority APIs never open | Manual + statement paths remain; revisit annually |
| International privacy regimes differ from PDPL | Jurisdiction packs include privacy configuration; legal review per country before go-live |

---

**End of phase set.** Phase 1 = prove the loop at GS Pool. Phase 2 = scale and automate it group-wide. Phase 3 = make it intelligent and take it global. Each phase ships independently and stands on the data of the one before.
