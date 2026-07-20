# Backend — Phase 2 (Scale & Automate) · Workstreams W1–W10

**Goal:** roll the proven Phase-1 loop out group-wide and automate the manual steps — including the first **real hardware** telemetry sources — with **no re-architecture** (new PDP rule types register on the same engine).

**Scope source (opened to all capabilities):** [`../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`](../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md) (C5, C7, C9, C10, C13, C14, P8) · **Phase scope:** [`../../startup-doccs/04_Phase2_Scale_Automate_ADPorts.md`](../../startup-doccs/04_Phase2_Scale_Automate_ADPorts.md) (W1–W10) · **Design:** [`../03_Backend_Design.md`](../03_Backend_Design.md), [`../05_CrossCutting_Telematics_Integrations.md`](../05_CrossCutting_Telematics_Integrations.md) · **DB:** [db-phase-2-scale-automate.md](../database/db-phase-2-scale-automate.md).

**Entry gate:** [Phase 1](backend-phase-1-mvp.md) gate green (all 11 controlled go-live gates; binding load/soak/failover tests passed). **Precondition:** approved Phase-1 KPI observation criteria are met at GS Pool.

---

## 1. Workstreams (build, capability, key backend work)

| WS | Capability | Backend build |
|----|-----------|---------------|
| W1 Group-wide rollout | P1/P2/P4 | Per-cluster policy config via a **hardened PAP** (multi-cluster authoring, review, diff, effective-dating); onboarding of clusters/pools via M3 tooling; scope/roll-up at group scale |
| W2 Advanced telematics + real hardware | C8 | **`AggregatorSource`/`DirectVendorSource`** as new `TelemetrySource` impls (domain module **untouched**); route-replay reads Phase-1 raw trips; geofence corridors + deviation (server-side); harsh-driving signals feed W9 |
| W3 Mobile app + offline | C2/C4 | Mobile-facing API; **offline sync + conflict queue** for handover/return; push + SMS via gateway |
| W4 Mobile damage capture | C4 | Photo pipeline (compressed upload → Blob → proposal), annotations, digital acknowledgement |
| W5 Fuel automation | C9 | **`ocr-worker`** deployable (Azure AI Document Intelligence, async submit-and-poll — never in `api`); consolidated-invoice parsing to per-vehicle lines; **fuel-card master + misuse flags** |
| W6 Toll management | C14 | Salik/Darb **consumer** (statement-import fallback); auto-attribution honouring substitution windows; recharge policy (D19) → recovery |
| W7 Replacement & substitute self-service | C5 | UI + service on the **Phase-1 attribution model**; substitute auth (LM approval) + auto-revert; replacement vehicle preserves booking number |
| W8 Vendor & lease management | C13 | Vendor master, lease records, off-hire + penalty computation, renewal pipeline (90/60/30), vendor scorecards, contract-vs-invoice flags |
| W9 Behaviour scoring | C10 | Score from Phase-1 events (no-show, late/early, overbooking) + harsh-driving; **self-visible**; **HR gate** before action |
| W10 Recovery + break-glass + recurring + public API | C7/C2/P8 | Payroll **recovery-instruction** integration (D13); **break-glass** emergency booking (D17, consent still mandatory, 100% post-hoc review); recurring booking series; **public API v1** + signed webhooks |

## 2. New PDP rule types (same engine — FR-POL-09, no re-architecture)

toll-recharge-policy (D19) · behaviour-score-weights/thresholds/window (D11) · break-glass-categories + review-SLA (D17) · maintenance-due thresholds per category · professional-driver-eligibility composition (D16). Each ships as a decision table with input schema, reason codes, and safe default (P1 §4.6 pattern).

## 3. New deployable & consumers

- **`ocr-worker`** — BullMQ sandboxed processor; rides in the ingest deployable in early P2, its own Container App at volume. Submit→poll Document Intelligence; emit `DocumentParsed`; proposal → human confirm until ≥95% accuracy KPI.
- **Toll consumer** — idempotent, DLQ, statement-import fallback; attribution via the substitution-aware `FineService`/`TollService`.
- **Real telematics sources** — behind the same `TelemetrySource` contract; the domain module must require **zero changes** (leak = fix at ingest, not domain).

## 4. Cross-cutting additions

Push/SMS channel in the notification dispatcher; Oracle AP integration (I5); HR disciplinary integration (I8); payroll integration (I7, outbound instructions only); public-API auth (scoped tokens), rate-limiting, versioning, HMAC webhooks; PDPL privacy-by-design review **before W2 go-live**.

## 5. Inspection Gate — Gap Analysis & Fixes

**Round 1 — rollout, automation, ordering**

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P2B-1 | Canonical schema **unproven vs real hardware** (W2 "domain untouched" claim) | H | Contract-test the canonical schema against **real vendor payload samples** + per-vendor conformance suite before the production swap | Integration + Backend |
| P2B-2 | **PAP scale** for W1 per-cluster authoring (P1 PAP is minimal) | M | Harden PAP (authoring, review, diff, effective-dating) as a W1 prerequisite | Backend |
| P2B-3 | **W10 bundles** payroll + break-glass + recurring + API; payroll (D13) legally gated | M | Unbundle W10; gate only payroll on D13; ship the rest independently | Backend + Legal |
| P2B-4 | **Ordering:** W6 toll attribution "honours substitution windows" but self-service is W7 | M | Sequence W7 before/with W6, or fall back to P1 manual substitution model | Backend |
| P2B-5 | **OCR ≥95%** has no labeled eval set / owner | M | Labeled invoice eval set + accuracy job + owner before auto-ingest | ML/Data |

**Round 2 — trust, security, second-order**

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P2B-6 | **Public API v1 (W10)** — no security design | H | OWASP API Top-10 design: scoped tokens, quotas/rate limits, HMAC webhooks, versioning; DevSecOps review | Security + Backend |
| P2B-7 | **Behaviour scoring surveillance risk** (R10) — score without transparency | H | Ship the transparent rubric + employee self-view + HR-gate workflow as explicit W9 deliverables | Backend + HR/Legal |
| P2B-8 | **Offline sync conflict** model undefined (W3) | M | Conflict model = fleet-manager review queue; field pilot; merge tests | Backend + Mobile |
| P2B-9 | **Geofence D21** owner/tolerance unresolved | M | Close D21 before building geofence authoring | Ops/D&T |
| P2B-10 | **Full-rollout load** not re-baselined (P0 was 500 users) | M | Re-run load test at group volume (~2,000 bookings/day + 5,000 real devices) before W1 go-live | QA + SRE |

**Exit criteria:** group-wide rollout complete per cluster; W2 privacy review signed off; OCR ≥95% before manual-confirm removed; toll auto-attribution ≥90%; break-glass 100% post-hoc review; public API secured; all **H** gaps fixed; DB [Phase 2 gate](../database/db-phase-2-scale-automate.md) green. → proceed to [Phase 3](backend-phase-3-intelligence-international.md).
