---
name: adp-arch-lld
description: "Technology-agnostic LLD scope and design packs: foundational engineering rules plus one or more module/service/capability/FR-level LLDs with components, flows, backend/frontend contract matrix, APIs/events, data, validation, config, observability, rollout notes. Use when producing or updating \\\"foundation-lld.md, module-lld-*.md, lld.md, docs/02-product/FR/fr-001/fr-001-lld.md, lld-*.drawio\\\" or defining stack-neutral backend/frontend contracts before Angular/React/Vue implementation. Owned by AI Solution Architect."
---

# adp-arch-lld

## Metadata

- **kind:** skill
- **version:** 0.2.151
- **stability:** alpha
- **role:** ai-solution-architect
- **tiers:** advanced: baseline · enterprise: baseline
- **why_critical:** Prevents implementation by improvisation.
- **default_prompt:** Use the adp-arch-lld skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Foundation LLD with backend/frontend contracts

**Owner role:** AI Solution Architect (`ai-solution-architect`)
**Primary artifact:** foundation-lld.md, module-lld-*.md, lld.md, docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md, lld-*.drawio

## Why critical
Prevents implementation by improvisation.

## Purpose
Define low-level design scope for all technologies without fragmenting architecture into separate technology-only LLD documents. Produce either a foundational LLD for shared engineering rules, one or more module LLD packs for specific services/modules/capabilities/integrations, or an FR-level LLD inside a functional requirement package when product has created `docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md`. Own the first stack-neutral Backend/Frontend Contract Matrix before frontend-specific skills specialize it into Angular, React, Vue, or other implementation wiring. Keep delivery specs, user stories, acceptance criteria, test cases, and AI/developer task breakdowns in their owning planning and delivery artifacts.

## Abu Dhabi Ports Group context

Apply this skill as AI Solution Architect delivery guidance for AD Ports work. The role-specific AD Ports edges are multi-terminal tenancy, integration boundaries, data residency, NESA/PDPL controls, operational resilience, and ADR-backed decisions. Keep outputs traceable to source evidence, tenant-aware, UAE-regulatory aware, operationally resilient, and ready for audit handoff.

## Mental model

- **Protects:** system coherence.
- **Optimizes for:** bounded decisions backed by ADRs.
- **Refuses to leave ambiguous:** integration, tenancy, data, or resilience assumptions.
- **Primary artifact focus:** foundation-lld.md, module-lld-*.md, lld.md, lld-*.drawio.
- **Default stance:** keep the work small enough to verify, but explicit enough that the next role does not need to reconstruct intent.

## LLD scope model

Use this model to decide what the skill should create:

| Artifact type | Created by this skill? | Purpose | Answers | Typical path |
| --- | --- | --- | --- | --- |
| HLD | No; route to `adp-arch-hld` | One architecture story covering drivers, scope, context, conceptual/logical/physical views, NFRs, ADRs, and risks. | Why this architecture? | `docs/03-architecture/HLD/hld.md` |
| Foundational LLD | Yes | One document for shared engineering rules only: cross-cutting design conventions, technology guardrails, module contract rules, validation, security, observability, deployment, testing, and handoff rules. It must not contain business-module detail. | What rules must every module follow? | `docs/03-architecture/LLD/foundation-lld.md` |
| Module LLD Pack | Yes | One pack per module, service, capability, integration, or bounded component. Include module design, APIs, data, workflow, integrations, security, errors, tests, rollout, and operational notes. More than one Module LLD may be required when scope spans multiple modules or technologies. | How does this module work? | `docs/03-architecture/LLD/module-lld-<module>.md` |
| FR-level LLD | Yes, when product has created an FR package | One colocated design handoff for a single FR package. Include only the architecture needed to implement that FR and link back to FR details, acceptance criteria, draft test cases, sequence, ADRs, and module/foundation LLDs. | How will this FR be implemented safely? | `docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md` |
| Delivery Specs | No; route to product/planning/QA/developer-owner skills | User stories, acceptance criteria, test cases, implementation tasks, AI/developer task prompts, sequencing, and sprint/release scope. | What will be built now? | `docs/04-planning/`, `docs/05-implementation/`, `docs/06-verification/` |

When scope is broad, split output into one Foundational LLD plus multiple Module LLD packs instead of forcing everything into a single long LLD. When scope is narrow and already tied to one FR package, update that FR-level LLD file and link any broader architecture decisions to module/foundation LLDs or ADRs.

## Hard rules

1. **Trace every output to a driver.** Link the backlog item, defect, incident, ADR, interview, telemetry, or upstream artifact that justifies the work.
2. **Name the AD Ports edge.** Record whether tenancy, Arabic/RTL, data residency, NESA/PDPL, vessel/customs operations, SAP/Oracle windows, or maritime SLAs apply.
3. **Use standards by reference.** Link `/standards/` files and bundled templates instead of copying their content into the artifact.
4. **Keep ownership visible.** The primary owner keeps the skill current, but downstream roles must be named whenever the artifact leaves this skill.
5. **Evidence beats assertion.** Prefer test output, screenshots, generated files, telemetry, review notes, or source links over claims that something was checked.
6. **Start from the bundled template.** If the template does not fit, state why before deviating.
7. **Load references selectively.** Read only the reference file needed for the current request; do not load the whole folder by default.
8. **Choose the LLD artifact type before writing.** Decide whether the request needs a Foundational LLD, one Module LLD, multiple Module LLD packs, or routing to HLD/delivery specs.
9. **Do not mix foundation and module detail.** Shared rules belong in the Foundational LLD; business-module specifics belong in Module LLD packs.
10. **Keep build-now scope out of LLD.** Stories, acceptance criteria, test cases, sprint tasks, and AI/developer execution prompts belong in delivery specs unless included only as trace links.
11. **Ask before carrying TBC/missing-value.** Before generating or updating the LLD, identify required fields that would otherwise be `TBC`, `unknown`, or `[placeholder]`, ask the user to provide the missing values, and only keep unresolved items when they are explicitly recorded as open questions with owner, due date, and impact.
12. **Clarify the technology stack before LLD.** When a user asks to "call LLD", produce an LLD, or update an LLD and the stack is not already explicit in upstream artifacts, ask a concise stack-clarification question before drafting. Capture backend technology (`.NET`, Python, NestJS, etc.), frontend technology (Angular, Vue, React Vite, etc.), database engine, data-access/ORM choice (EF Core, SQLAlchemy, TypeORM, Prisma, raw SQL, etc.), connection/integration style, and deployment/runtime constraints where relevant.
13. **Own the first backend/frontend contract.** Before routing to Angular, React, Vue, backend, UX, or QA implementation skills, define the stack-neutral Backend/Frontend Contract Matrix for every feature or workflow that crosses the UI/API boundary.

## Entity Completion Contract

Use this contract whenever the request mentions an ERD, data model, schema, backend entity implementation, persistence model, or required entities.

Hard rules:
- Inspect the repository before assuming a store. Detect persistence from project files, packages, ORM/config, connection strings, migrations, Docker compose, repository classes, and infrastructure modules.
- Supported targets include SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, and In-memory/test repositories where used by the project.
- If multiple stores exist, produce a per-store entity map. If the target store is ambiguous, ask one concise clarification before implementation.
- Never hardcode MongoDB as the default.
- If an entity appears in BRD/PRD/domain-model/ERD but is missing from implementation, implement it or list it as an explicit blocker/residual risk.
- Backend/data work is complete only after the narrowest relevant tests for the affected entity slice pass.

Entity Completion Matrix:
| Entity | Source Requirement | Domain Model | Storage Mapping | Keys/Identity | Relationships | Indexes/Constraints | Data Access | Service/Use Case | API Contract | API Endpoint | Tests | Frontend Model | Status | Residual Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Persistence-specific checks:
- Relational stores: table name, primary key, foreign keys, unique constraints, check constraints, indexes, migrations, ORM mapping/configuration, transaction boundaries, seed/reference data if required.
- MongoDB/document stores: collection name, document identity, embedded vs referenced relationship decision, indexes, repository/query methods, consistency handling for cross-document references.
- Event-sourced or hybrid stores: aggregate root, events, snapshots if any, projection/read model, idempotency and replay behavior.

## Pitfalls

- **Generic output:** The artifact could apply to any company; add the AD Ports operational or regulatory constraint that changes the answer.
- **Hidden assumption:** A decision depends on missing input but the gap is buried in prose; list it under assumptions or open questions.
- **Unasked TBC/missing-value:** Required information is left as `TBC` without first asking the user; ask before generation, then record unresolved gaps with owner/date.
- **Unconfirmed stack:** An LLD assumes `.NET`, Python, NestJS, Angular, Vue, React Vite, a database, ORM, or connection pattern without user confirmation or upstream artifact evidence; ask for the stack first and record the answer as a design input.
- **Frontend-specific contract first:** Angular, React, Vue, or mockup work invents API operations, DTOs, permissions, errors, or audit events before the LLD owns a stack-neutral Backend/Frontend Contract Matrix.
- **Broken handoff:** The next role is implied rather than named; add the downstream role and what they should do next.
- **Template theater:** Sections are filled to look complete without evidence; remove noise and link proof.
- **Single-document overload:** A broad initiative is forced into one `lld.md`; split it into a Foundational LLD and multiple Module LLD packs where needed.
- **Foundation leakage:** Shared engineering rules include business-module logic; move that logic into the relevant Module LLD pack.
- **Delivery-spec leakage:** Stories, acceptance criteria, test cases, and task prompts are authored inside the LLD; route them to delivery specs and keep only trace links.
- **Scope bleed:** The skill starts solving a neighboring role's artifact; split the request and route the other artifact to its owner.

## Evidence expectations

- **Minimum evidence:** source request, changed artifact path, key decisions, assumptions, open questions, and downstream role.
- **When code is touched:** include commands run, test results, relevant screenshots or logs, and residual risk.
- **When docs are touched:** include source artifacts reviewed, standards used, and reviewer or approver expected next.
- **When risk is found:** record owner, severity, mitigation, and whether delivery can proceed.
- **When using adp-arch-lld:** finish with the files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before producing foundation-lld.md, module-lld-*.md, lld.md, lld-*.drawio:** confirm the artifact type is owned by this skill and not a neighboring role.
- **Before using a single LLD:** confirm the scope is truly single-module or intentionally small; otherwise split into a Foundational LLD and Module LLD packs.
- **Before changing scope:** confirm the change still protects system coherence and does not dilute bounded decisions backed by ADRs.
- **Before marking done:** confirm standards, templates, references, and workflow handoff were actually used where applicable.
- **Before routing onward:** confirm the downstream role has a clear next action, not just a notification.
- **Before accepting missing input:** record whether the gap blocks work, creates risk, or can be carried as an assumption.
- **Before writing placeholders:** ask the user for required missing values; do not silently generate `TBC` into the artifact.
- **Before drafting an LLD with unclear stack:** ask what backend, frontend, database, ORM/data-access, connection/integration, and runtime technologies should be used, or ask whether the user wants a general technology-stack recommendation instead.
- **Before routing to frontend/backend implementation:** confirm the Backend/Frontend Contract Matrix exists, has owners, and marks unresolved operations as `draft` or `blocked` instead of silently letting downstream skills invent contracts.

## Escalation triggers

- **Security or privacy uncertainty:** involve `ai-security-engineer` before producing a final artifact.
- **Architecture or integration uncertainty:** involve `ai-solution-architect` or `ai-integration-engineer` before locking the decision.
- **Operational readiness uncertainty:** involve `ai-platform-engineer` or `ai-sre` before release-facing handoff.
- **Testability uncertainty:** involve `ai-quality-engineer` before accepting the artifact as implementation-ready.
- **Ownership uncertainty:** involve `ai-governance-lead` rather than leaving the skill, artifact, or exception owner implicit.

## Review lens

- A reviewer should be able to see whether the output is a Foundational LLD, one Module LLD, or a multi-module LLD pack and why that shape was chosen.
- A reviewer should be able to see the Backend/Frontend Contract Matrix before any stack-specific frontend API wiring, UX screen, backend endpoint, or contract test is accepted.
- A reviewer should be able to see how this skill handled integration, tenancy, data, or resilience assumptions.
- A reviewer should be able to locate source evidence without asking for chat history.
- A reviewer should be able to tell which AD Ports edge was considered and why it mattered or did not apply.
- A reviewer should be able to rerun, inspect, or challenge the evidence path.
- A reviewer should be able to route the next action to one named role.

## When to use
Trigger this skill when:
- A new instance of `foundation-lld.md`, `module-lld-*.md`, `lld.md`, `docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md`, or `lld-*.drawio` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work.

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill.

## Inputs
- Backlog story / defect / ADR follow-up that justifies the change.
- Approved upstream artifacts the skill depends on (project context, BRD, PRD, NFR, HLD, etc., as relevant).
- FR/NFR, domain model, API/integration assumptions, UX constraints, and selected or candidate technology stack when backend/frontend wiring is in scope.
- Source evidence (interviews, telemetry, prior runs, support tickets) where applicable.

## Outputs
- foundation-lld.md for shared engineering rules when needed.
- module-lld-*.md for one or more module/service/capability LLD packs when needed.
- `docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md` for an FR-level LLD when product has created an FR package.
- lld.md only when the repository already uses that single-file convention or the scope is intentionally small.
- lld-*.drawio
- Backend/Frontend Contract Matrix when any UI/API boundary, screen/API wiring, backend endpoint, or contract test is in scope.
- Evidence linked from the artifact (test runs, screenshots, metrics, references).
- Handoff note to downstream roles when relevant.

## Artifact path routing

When this skill creates or updates documentation artifacts, resolve the target path through `/standards/artifact-path-routing.md` before writing files. Write documentation output relative to the target repository root, using the numbered SDLC folders under `docs/`:

- `docs/00-governance/` for governance, repo instructions, catalog docs, workflow diagrams, and tutorials.
- `docs/01-discovery/` for demand intake, BRD, discovery notes, sponsor constraints, and business risks.
- `docs/02-product/` for PRD and product-definition artifacts.
- `docs/03-architecture/` for architecture and design artifacts, using typed subfolders: `DOMAIN/`, `HLD/`, `LLD/`, `NFR/`, `ADR/`, and `SECURITY/` as defined in `/standards/artifact-path-routing.md`.
- `docs/04-planning/` for backlog, roadmap, iteration, rollout, and planning artifacts.
- `docs/05-implementation/` for implementation notes, handoffs, and code-facing delivery notes.
- `docs/06-verification/` for tests, reviews, security assessment, audits, and dry-run evidence.
- `docs/07-release/` for release plans, release notes, runbooks, support, versioning, publishing, and deprecation docs.

Do not create new documentation artifacts inside skill or catalog folders such as `.agents/skills/`, `.claude/skills/`, `catalog/source/skills/`, or plugin cache. Do not create new documentation artifacts at legacy flat paths such as `docs/brd.md`, `docs/prd.md`, `docs/lld.md`, `docs/adrs/`, `docs/dry-runs/`, or `docs/runbooks/`. If the user gives a conflicting path, record it as an explicit path exception. Source code, tests, infrastructure, and app config stay in the repository's application structure, not under `docs/`.

## Workflows

Load only the workflow file that matches the current request:

- `workflows/produce-artifact.md`
- `workflows/review-artifact.md`
- `workflows/update-artifact.md`

## References

Load only when the request needs detailed guidance:

- `references/guidance.md` — role-specific guidance and AD Ports edge checks.

## Templates

Use these bundled templates when the request produces or updates the primary artifact:

- `templates/lld-template.md.tmpl` — Low-Level Design scope selector, foundational LLD outline, and module LLD outline.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/adr.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Architecture
- **Ordered by:** `ai-product-manager`, `ai-business-analyst`
- **Required inputs:** `prd.md`, `nfrs`, `business constraints`, `domain context`
- **Generated artifact:** `foundation-lld.md`, `module-lld-*.md`, `lld.md`, `lld-*.drawio`, `Backend/Frontend Contract Matrix`
- **Next roles:** `ai-security-engineer`, `ai-ux-ui-designer`, `ai-delivery-planner`, `ai-backend-dotnet`, `ai-backend-nestjs`, `ai-backend-python`, `ai-frontend-react`, `ai-frontend-angular`, `ai-mobile-rn`, `ai-mobile-ios`, `ai-mobile-android`, `ai-mobile-flutter`, `ai-integration-engineer`, `ai-data-engineer`, `ai-database-engineer`, `ai-ml-engineer`
- **Human gate:** `architecture decision approval`, `integration or data-risk approval`

## Handoff

- **Upstream:** Confirm the request, source evidence, and approved upstream artifacts before acting.
- **Downstream:** `ai-backend-dotnet`, `ai-backend-nestjs`, `ai-backend-python`, `ai-frontend-react`, `ai-frontend-angular`, `ai-mobile-rn`, `ai-mobile-ios`, `ai-mobile-android`, `ai-mobile-flutter`, `ai-integration-engineer`, `ai-data-engineer`, `ai-database-engineer`, `ai-platform-engineer`, `ai-sre`, `ai-security-engineer`, `ai-quality-engineer`, `ai-delivery-planner`.
- **Evidence:** Summarize changed artifacts, key decisions, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-solution-architect` (AI Solution Architect)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-07

## Quality bar
- Trace to backlog story / defect / ADR.
- Smallest viable artifact for the product tier and change risk.
- Evidence attached, not claimed.
- Reviewed by the owning role and any required cross-role reviewer.
- Stored at the target-repository-root-relative numbered SDLC repo path from `/standards/artifact-path-routing.md` for documentation artifacts.

## Tier guidance
Per the AI Role Skills Tier Application Guide:
- Tier 1: include this skill only if it is in the Tier 1 baseline or its should-have trigger fires.
- Tier 2: include if listed as Tier 2 baseline or its should-have trigger fires.
- Tier 3: included by default if listed in Tier 3 baseline.

If unsure, default to producing the artifact at the depth required by the change's blast radius.
