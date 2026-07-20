# Fleet Management Platform — Candidate Technical Implementation Plan

**A single, well-drafted engineering plan that takes the platform from an empty repository to a Phase 1 go-live at GS Pool (Mina Zayed), and forward through Phase 2 and Phase 3.**

Reference deployment: **AD Ports Group** · Stack: **NestJS + React + PostgreSQL + Azure (UAE North)** · Delivery model: **one project, three deployables, phased**.

---

## What this is

This folder is a **candidate implementation plan for review**. It translates the product/design/architecture source documents (in [`../startup-doccs/`](../startup-doccs/)) into a proposed, phase-by-phase engineering plan covering database design, backend design, frontend design, cross-cutting concerns, telematics, integrations, testing, DevOps, and go-live.

It does **not** approve product scope, business rules, architecture, funding, or delivery dates. The current startup documents are candidate inputs until the business baseline, BRD, PRD/FR/NFR, architecture decisions, and plan are approved. Where a rule or threshold appears here, it is cited to its source and is expressed as **policy-engine configuration, never hard-coded** (per FR-ARC-03).

**Current control records:** [formal review](../06-verification/implementation-plan-review.md) · [active remediation tracker](../04-planning/implementation-plan-remediation-tracker.md). The tracker, not this index, records closure status and required evidence.

## Naming and identifier policy

The final product name is undecided. Product-facing prose uses **Fleet Management Platform** as a neutral working description. Technical examples use placeholders such as `<app-slug>-api`, `<app-slug>-ui`, and `<app_schema>`; replace them only after naming and identifier governance are approved. Existing source filenames are retained only because they are current repository paths, not because they approve a product name.

## Document map (read in order)

| # | Document | Covers |
|---|----------|--------|
| 00 | [Overview & Engineering Principles](00_Overview_and_Principles.md) | Business context, the non-negotiable constitution, the three things that can't be retrofitted, delivery-phase summary |
| 01 | [Architecture & Technology Stack](01_Architecture_and_Tech_Stack.md) | Proposed stack, the three deployables, repo layout, module boundaries, policy engine (PAP/PDP/PEP), telematics split, data flow, ADR candidates |
| 02 | [Database Design](02_Database_Design.md) | Schema conventions, ERD, every core table with keys/indexes, tamper-evident audit, telemetry hypertable, consent store, dormant `organization_id`, migrations |
| 03 | [Backend Application Design](03_Backend_Design.md) | NestJS structure, `contracts/` + Zod, the PDP, per-module design (services, controllers, DTOs, REST/events), error model, Definition of Done |
| 04 | [Frontend Application Design](04_Frontend_Design.md) | React + Vite structure, the fixed app shell, routing, role/scope navigation, state (TanStack Query), per-screen build, design tokens, a11y/perf — **plus deep design for live GPS-map visualization (§12), vehicle damage/condition capture (§13), the interactive Pool Radar availability visualization (§14), mobile-first/responsive engineering (§15), and the UI foundation — Tailwind + shadcn/ui, EN/Arabic RTL + light/dark (§16)** |
| 05 | [Cross-Cutting, Telematics & Integrations](05_CrossCutting_Telematics_Integrations.md) | Auth (Entra/MSAL), RBAC + 8 SoD, tamper-evident audit interceptor, consent gate, observability, `telematics-ingest` + `SimulatorSource`, OCR worker, Oracle HCM / Email / adapter integrations |
| 06 | [Phase-by-Phase Delivery Plan](06_Phase_Plan_and_Delivery.md) | Phase 0 (Sprint 0), Phase 1 Blocks A–G, Phase 2 (W1–W10), Phase 3 (W1–W8): tasks, deliverables, acceptance, build order, dependencies, KPIs — **plus a two-round Critique & Gap Analysis per phase** |
| 07 | [Testing, DevOps & Go-Live](07_Testing_DevOps_GoLive.md) | Test strategy & pyramid, the load test, CI/CD (GitHub Actions + OIDC), IaC, Azure resources, environments, go-live gates, risks & open decisions |

## Phase-by-phase build sub-plans (a separate file per phase, each with an inspection gate)

Two detailed engineering sub-plans decompose docs 02 and 03 into **one file per phase (0/1/2/3)**. Each phase ends with an **Inspection Gate — Gaps, Planned Remediation & Evidence**. A remediation row is not closed until its owner, result and evidence URI are recorded and independently reviewed.

- **[backend/](backend/README.md)** — NestJS phased plan: Phase 0 Foundation → Phase 1 MVP (Blocks A–G) → Phase 2 Scale & Automate → Phase 3 Intelligence & International. Derived from [03_Backend_Design.md](03_Backend_Design.md); Phase 1 grounded in `../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md`, Phases 2–3 opened to `../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`.
- **[database/](database/README.md)** — PostgreSQL + TimescaleDB phased plan: schema delta, migrations, indexes, constraints, and retention per phase, same 0→3 sequence. Derived from [02_Database_Design.md](02_Database_Design.md).

## Source documents (candidate inputs)

All in [`../startup-doccs/`](../startup-doccs/):

- `01_PROJECT_SUMMARY.md` — whole-project overview.
- `02_Fleet_Management_Platform_PRD_v3.0.md` — draft full requirements (C1–C15, P1–P11, all phases); retain this filename only as a repository path.
- `03_Phase1_MVP_PRD_ADPorts.md` — candidate Phase 1 scope (10 modules, all FRs).
- `04_Phase2_Scale_Automate_ADPorts.md` / `05_Phase3_Intelligence_International_ADPorts.md` — later-phase scope.
- `06_UX_Design_System_v2.md` + `07_Page_Functional_Specifications.md` — candidate UI baseline pending Product/UX approval.
- `08_Development_Approach_and_Implementation_Plan.md` — stack, architecture, ADRs, Azure list, IoT simulation.
- `09_Azure_Resource_Request.md` — every cloud resource + SKU.
- `10_AI_Agent_MetaPrompt_MasterBuild.md` — the operating constitution and phased kickoff prompts.

## Golden rules while building (summary — full text in 00)

1. **The booking path is sacred** — CPU-heavy work runs in a different process; `api` only awaits I/O.
2. **Rules live in the policy engine, never in code.**
3. **The policy engine fails safe** (deny + escalate), never open.
4. **Consent is a hard gate** — no signed consent, no booking number / allocation.
5. **Segregation of duties is structural**, enforced in the authorization layer.
6. **The audit log is append-only and hash-chained.**
7. **Telematics is a pluggable module**, simulator-first, no hardware in Phase 1.
8. **One deployment per organization** — dormant `organization_id`, no active multi-tenancy.
9. **One visual register everywhere** — the same design system for employee, ops, and executive screens.

## Status

**Draft v1.1 — candidate engineering plan under remediation.** The business baseline and wiki will be recreated later and are not current evidence. Application repositories `<app-slug>-api/` and `<app-slug>-ui/` are placeholders; this plan must not authorize Phase 0 until the review blockers and required approvals are closed.
