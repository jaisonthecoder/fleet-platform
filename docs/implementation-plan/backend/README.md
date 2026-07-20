# Backend — Phase-by-Phase Implementation Plan

**Source of truth:** [`../03_Backend_Design.md`](../03_Backend_Design.md) (module catalogue, PDP, eventing, jobs, error model, DoD) · **Data:** [`../02_Database_Design.md`](../02_Database_Design.md) · **Sequencing/gates:** [`../06_Phase_Plan_and_Delivery.md`](../06_Phase_Plan_and_Delivery.md) · **Stack:** [`../01_Architecture_and_Tech_Stack.md`](../01_Architecture_and_Tech_Stack.md).

**Stack:** NestJS + TypeScript (Fastify), Drizzle, Zod (`nestjs-zod`), BullMQ, Azure Service Bus, Redis, Socket.IO, `nestjs-pino`, OpenTelemetry. Three deployables from one repo: `api`, `pdp`, `telematics-ingest` (+ `ocr-worker` from Phase 2).

---

## How to use this plan

Each phase is a **separate file**. Work a phase to its **Inspection Gate**, run the gap analysis, **fix every gap**, pass the exit criteria, and only then start the next phase. Do not carry an open High gap forward.

| Phase | File | Backend scope (headline) |
|-------|------|--------------------------|
| 0 — Foundation (Sprint 0, wk 1–4) | [backend-phase-0-foundation.md](backend-phase-0-foundation.md) | 3 deployables scaffolded, `contracts/`, `platform` skeleton (auth + RBAC + SoD + hash-chained audit), PDP with 2 rule types, `telematics-ingest` + `SimulatorSource`; load test passes |
| 1 — MVP (wk 5–24, Blocks A–G) | [backend-phase-1-mvp.md](backend-phase-1-mvp.md) | M1–M10: hierarchy + workflow + PDP→12 rules, vehicles + migration, telematics domain, booking + consent + handover + compliance, entitlements + fines + substitution model, dashboards + realtime + notifications |
| 2 — Scale & Automate (W1–W10) | [backend-phase-2-scale-automate.md](backend-phase-2-scale-automate.md) | Real telematics sources, `ocr-worker`, tolls, fuel, vendor/lease, behaviour scoring, recovery/payroll, break-glass, recurring, public API v1; new PDP rule types |
| 3 — Intelligence & International (W1–W8) | [backend-phase-3-intelligence-international.md](backend-phase-3-intelligence-international.md) | AI optimisation, predictive maintenance, anomaly/fraud, driver risk, copilot, CV comparison, ESG, jurisdiction packs + policy simulation, API maturity |

## Non-negotiables carried into every phase (from 03 §1, §10)

1. **The `api` process only awaits I/O.** CPU-heavy work → `telematics-ingest` / BullMQ sandboxed processors / workers. Guarded by the event-loop-lag metric.
2. **Every PEP asks the PDP; it never decides.** No business threshold hard-coded (CI grep guard).
3. **PDP fails safe** — unreachable/no-match → `DENY` + escalate, never a 500 that fails open.
4. **Consent is a hard gate** — no signed `consent_record` ⇒ no booking number / allocation.
5. **SoD is structural** (authorization layer) — each of the 8 rules has a passing test.
6. **Every state change** emits an append-only, hash-chained audit entry + records the policy version.
7. **Module boundaries** enforced by `dependency-cruiser`; each module exports only its service.
8. **Error model** — RFC-7807 problems; denials carry machine reason codes localised EN + AR.
9. **DoD (03 §10) applies to every module** in every phase.

## The inspection-gate discipline

Every phase file ends with **§ Inspection Gate — Gaps, Planned Remediation & Evidence**: each gap records severity, impact, planned remediation and owner. Closure additionally requires a result, evidence URI and reviewer; High gaps block the next phase.
