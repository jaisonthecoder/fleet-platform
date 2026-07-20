# Backend — Phase 3 (Intelligence & International) · Workstreams W1–W8

**Goal:** turn accumulated data into recommendations (never autonomous actions), add an AI copilot and CV damage comparison, ship ESG, and prepare jurisdiction packs + international operation — all under the **AI-recommends-humans-decide** guardrail.

**Scope source (opened to all capabilities):** [`../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`](../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md) (C11 AI, C12 ESG, P3 policy engine, P8 API) · **Phase scope:** [`../../startup-doccs/05_Phase3_Intelligence_International_ADPorts.md`](../../startup-doccs/05_Phase3_Intelligence_International_ADPorts.md) (W1–W8) · **DB:** [db-phase-3-intelligence-international.md](../database/db-phase-3-intelligence-international.md).

**Entry gate:** [Phase 2](backend-phase-2-scale-automate.md) gate green; **6+ months of clean group-wide data**. AI/ML work follows the `adp-ml-*` skills (model selection, prompt design, RAG, eval harness, safety).

---

## 1. Workstreams (build, capability, guardrail)

| WS | Capability | Backend build | Guardrail |
|----|-----------|---------------|-----------|
| W1 AI optimisation engine | C11 | Under/over-utilisation detection, cost-per-km outliers, right-sizing with **net financial case** (uses P2 off-hire penalties) | Recommendation **card + accept/reject**, never auto-execute a transfer/off-hire |
| W2 Predictive maintenance | C11 | Breakdown-risk flags from mileage/age/accident/maintenance history | Advisory flag in the fleet console |
| W3 Anomaly & fraud detection | C11 | Off-hours patterns, fuel-vs-distance, toll-vs-destination mismatch | **Human-decided review queue** |
| W4 Driver risk scoring | C10/C11 | Fines + accidents + telematics → risk score into the P2 behaviour engine | HR gate unchanged |
| W5 AI copilot | C11 | NL booking + analytics; answers **strictly from role-permitted data**; propose→confirm; all actions logged | RBAC/scope on every response; ML-safety controls |
| W6 CV damage comparison | C4/C11 | Handover-vs-return photo sets auto-compared; new-damage candidates | **Advisory, human-confirmed** overlay |
| W7 ESG & sustainability | C12 | Fuel/CO₂ per vehicle/pool/cluster/group (emission factors D10), EV/hybrid share, exportable report, EV-transition scenarios | — |
| W8 International & platform maturity | P3/P8 | Multi-currency, Arabic-RTL full UI, **jurisdiction packs = policy rule-type templates per country**, **full historical policy simulation**, public API v1 maturity, curated BI feed | — |

## 2. New platform capabilities (MLOps + safety)

- **Eval harness** (from the start of Phase 3, not per-model afterthought): golden sets, automatic metrics, LLM-as-judge where relevant, regression suite, **eval-in-CI**, drift detection, eval reporting — so models don't silently degrade (gap P3B-1).
- **Model serving** — batching, autoscaling, CPU/GPU choice, canary/shadow rollout, fallback model, cost guardrails; a **model-selection ADR** per model (LLM vs classical, hosted vs self-hosted).
- **ML safety** — for the copilot: scope-checked retrieval, input/output filters, prompt-injection + jailbreak resistance, PII redaction, rate limits, residual-risk record.
- **One recommendation component + decision-log schema** reused by W1/W3/W4/W6 so every AI decision is consistent and audited (gap P3B-2).
- **Policy simulation** (matures P1 dry-run) in the PAP: test a draft rule against months of real transactions, see the outcome diff before activation — the validator for jurisdiction packs.

## 3. Inspection Gate — Gap Analysis & Fixes

**Round 1 — data readiness & AI governance**

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P3B-1 | **No per-model data-readiness gate** (models need 6+ months clean/dense data) | H | Per-pool/per-model density + quality entry gate; ship only where data suffices | ML + Data |
| P3B-2 | **Copilot safety** (RBAC/scope, injection, PII) unaddressed | H | ML-safety design before W5: scope-checked retrieval, I/O filters, injection defence, red-team | ML + Security |
| P3B-3 | **Recommendation UX + decision logging** undesigned across W1/W3/W4/W6 | M | One recommendation component + audited decision-log schema | Backend + ML |
| P3B-4 | **W8 circularity** — jurisdiction packs need simulation to validate, both in W8 | M | Build historical simulation first, then author + simulate packs | Backend |
| P3B-5 | **ESG emission factors (D10)** external dependency | M | Close D10 before ESG go-live; store factors as configurable data | Sustainability |

**Round 2 — MLOps, architecture, residency**

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P3B-6 | **No MLOps/eval harness** → undetected model rot | H | Stand up the eval harness + drift detection + eval-in-CI as Phase-3 infra | ML |
| P3B-7 | **International residency** conflicts with "one DB per org, UAE North" (ADR-004/008 = multi-*org*, not multi-*region*) | H | New ADR for multi-region/residency (regional deployments vs multi-region DB) before international go-live | Architecture |
| P3B-8 | **Copilot cost/latency/model-selection** unaddressed | M | Model-selection ADR + cost/latency guardrails + fallback model | ML |
| P3B-9 | **CV damage comparison** — labeled pairs at scale + false-positive fatigue | M | Labeled set + confidence thresholds + human-confirm queue; track precision | ML |
| P3B-10 | Accountability for **ignored recommendations** | L | Quarterly governance review of accepted/rejected trends | Governance |

**Exit criteria:** each shipped model passes its data-readiness + eval gate; copilot enforces RBAC/scope with a signed ML-safety record; jurisdiction packs validated via policy simulation; international residency ADR approved before any non-UAE go-live; all **H** gaps fixed; DB [Phase 3 gate](../database/db-phase-3-intelligence-international.md) green.
