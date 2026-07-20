# Functional & Architecture Deep Dives

Detailed, illustrated explainers of how the Fleet Management Platform works — expanded from the working discussions into reference documentation. They go one level deeper than the PRD narrative: concrete schemas, decision-table examples, scope-resolution queries, sequence diagrams, edge cases, and phase mapping.

| # | Document | Covers |
|---|---|---|
| 01 | [Platform overview & reusability](01_platform-overview-and-reusability.md) | The business idea, the core loop, 15 capabilities / 11 foundations, and the three pillars that make the platform reusable across organizations |
| 02 | [Organization hierarchy engine](02_organization-hierarchy-engine.md) | The N-level configurable tree, effective-dated vehicle/role assignments, scope resolution and roll-up, restructure-with-history, multi-org configuration |
| 03 | [Policy & rule engine](03_policy-rule-engine.md) | PAP/PDP/PEP separation, decision-table anatomy, versioning & governance, scope inheritance, caching, fail-safe, and how the UI connects to it |
| 04 | [Approval & workflow engine](04_approval-workflow-engine.md) | The shared workflow engine, policy-driven approval chains, delegation, escalation, SoD, and per-organization configuration |
| 05 | [Vehicle master & lifecycle](05_vehicle-master-and-lifecycle.md) | The vehicle master (6 field groups), lifecycle & operational state model, bookability, uniqueness, document vault |
| 06 | [Telematics, live tracking & yard](06_telematics-live-tracking-and-yard.md) | Simulator-first telematics, live map (MapLibre + Azure Maps), auto-odometer, trip auto-attach, device registry/health, yard/location, PDPL privacy |
| 07 | [Vehicle condition, handover & history](07_vehicle-condition-handover-and-history.md) | Handover/return condition capture, the Damage Map, reconciliation, and every layer of vehicle history + tamper-evident audit |

---

## Source of truth & status

These deep dives synthesize (and cite) the controlled documents; if they ever disagree, the source wins:

- `docs/startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md` — master PRD (capabilities C1–C15, foundations P1–P11, FRs).
- `docs/startup-doccs/03_Phase1_MVP_PRD_ADPorts.md` — Phase 1 scope.
- `docs/startup-doccs/08_Development_Approach_and_Implementation_Plan.md` + `10_AI_Agent_MetaPrompt_MasterBuild.md` — stack, architecture, ADRs, constitution.
- `docs/implementation-plan/02_Database_Design.md`, `03_Backend_Design.md`, `04_Frontend_Design.md`, `06_Phase_Plan_and_Delivery.md`.

> **Build status caveat.** These describe the *designed* behaviour. As of writing, the `app-api` foundation is complete but the business modules and database tables are **not yet implemented** (see [build-execution-plan.md](../../04-planning/build-execution-plan.md)). Where a capability is future-phase, it is tagged (Phase 1 / Phase 2 / Phase 3). Nothing here overrides the governance gates in the remediation tracker.

## Conventions used in these docs

- **FR-XXX** references point to functional requirements in the PRD.
- **Phase tags** (Phase 1/2/3) indicate when a behaviour ships.
- Mermaid diagrams render in the VS Code Markdown preview.
- Table/column names match `docs/implementation-plan/02_Database_Design.md`.
