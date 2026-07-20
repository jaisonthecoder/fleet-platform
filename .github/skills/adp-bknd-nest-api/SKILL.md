---
name: adp-bknd-nest-api
description: "Sync slice: REST/gRPC/GraphQL controller, service, DTOs (class-validator), guards, errors, Supertest coverage. Use when producing or updating \\\"backend Nest source, backend tests, lld-api-spec.md\\\". Owned by AI Backend Engineer (NestJS)."
---

# adp-bknd-nest-api

## Metadata

- **kind:** skill
- **version:** 0.2.148
- **stability:** alpha
- **role:** ai-backend-nestjs
- **tiers:** essentials: baseline · advanced: baseline · enterprise: baseline
- **why_critical:** Produces a complete callable feature slice with executable proof, not a partial controller or handler.
- **default_prompt:** Use the adp-bknd-nest-api skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Sync slice: REST/gRPC/GraphQL controller, service, DTOs

**Owner role:** AI Backend Engineer (NestJS) (`ai-backend-nestjs`)
**Primary artifact:** backend Nest source, backend tests, lld-api-spec.md

## Why critical
Produces a complete callable feature slice with executable proof, not a partial controller or handler.

## Purpose
Sync slice: REST/gRPC/GraphQL controller, service, DTOs (class-validator), guards, errors, Supertest coverage.

## Abu Dhabi Ports Group context

Apply this skill as AI Backend Engineer (NestJS) delivery guidance for AD Ports work. The role-specific AD Ports edges are tenant isolation, Entra ID or partner-token authorization, idempotent queue consumers, SAP/Oracle integration windows, Application Insights correlation, and UAE data residency. Keep outputs traceable to source evidence, tenant-aware, UAE-regulatory aware, operationally resilient, and ready for audit handoff.

## Mental model

- **Protects:** callable backend behavior.
- **Optimizes for:** module boundaries with tests and telemetry.
- **Refuses to leave ambiguous:** authorization, tenancy, integration, or queue ambiguity.
- **Primary artifact focus:** backend Nest source, backend tests, lld-api-spec.md.
- **Default stance:** keep the work small enough to verify, but explicit enough that the next role does not need to reconstruct intent.

## Hard rules

1. **Trace every output to a driver.** Link the backlog item, defect, incident, ADR, interview, telemetry, or upstream artifact that justifies the work.
2. **Name the AD Ports edge.** Record whether tenancy, Arabic/RTL, data residency, NESA/PDPL, vessel/customs operations, SAP/Oracle windows, or maritime SLAs apply.
3. **Use standards by reference.** Link `/standards/` files and bundled templates instead of copying their content into the artifact.
4. **Keep ownership visible.** The primary owner keeps the skill current, but downstream roles must be named whenever the artifact leaves this skill.
5. **Evidence beats assertion.** Prefer test output, screenshots, generated files, telemetry, review notes, or source links over claims that something was checked.
6. **Start from the bundled template.** If the template does not fit, state why before deviating.
7. **Load references selectively.** Read only the reference file needed for the current request; do not load the whole folder by default.
8. **Comment every new method.** Add a brief JSDoc `/** ... */` comment on every new method describing its purpose in one sentence.

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
- **Broken handoff:** The next role is implied rather than named; add the downstream role and what they should do next.
- **Template theater:** Sections are filled to look complete without evidence; remove noise and link proof.
- **Scope bleed:** The skill starts solving a neighboring role's artifact; split the request and route the other artifact to its owner.

## Evidence expectations

- **Minimum evidence:** source request, changed artifact path, key decisions, assumptions, open questions, and downstream role.
- **When code is touched:** include commands run, test results, relevant screenshots or logs, and residual risk.
- **When docs are touched:** include source artifacts reviewed, standards used, and reviewer or approver expected next.
- **When risk is found:** record owner, severity, mitigation, and whether delivery can proceed.
- **When using adp-bknd-nest-api:** finish with the files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before producing backend Nest source, backend tests, lld-api-spec.md:** confirm the artifact is owned by this skill and not a neighboring role.
- **Before changing scope:** confirm the change still protects callable backend behavior and does not dilute module boundaries with tests and telemetry.
- **Before marking done:** confirm standards, templates, references, and workflow handoff were actually used where applicable.
- **Before routing onward:** confirm the downstream role has a clear next action, not just a notification.
- **Before accepting missing input:** record whether the gap blocks work, creates risk, or can be carried as an assumption.

## Escalation triggers

- **Security or privacy uncertainty:** involve `ai-security-engineer` before producing a final artifact.
- **Architecture or integration uncertainty:** involve `ai-solution-architect` or `ai-integration-engineer` before locking the decision.
- **Operational readiness uncertainty:** involve `ai-platform-engineer` or `ai-sre` before release-facing handoff.
- **Testability uncertainty:** involve `ai-quality-engineer` before accepting the artifact as implementation-ready.
- **Ownership uncertainty:** involve `ai-governance-lead` rather than leaving the skill, artifact, or exception owner implicit.

## Review lens

- A reviewer should be able to see how this skill handled authorization, tenancy, integration, or queue ambiguity.
- A reviewer should be able to locate source evidence without asking for chat history.
- A reviewer should be able to tell which AD Ports edge was considered and why it mattered or did not apply.
- A reviewer should be able to rerun, inspect, or challenge the evidence path.
- A reviewer should be able to route the next action to one named role.

## When to use
Trigger this skill when:
- A new instance of `backend Nest source, backend tests, lld-api-spec.md` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work.

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill.

## Inputs
- Backlog story / defect / ADR follow-up that justifies the change.
- Approved upstream artifacts the skill depends on (project context, BRD, PRD, NFR, HLD, etc., as relevant).
- Source evidence (interviews, telemetry, prior runs, support tickets) where applicable.

## Outputs
- backend Nest source, backend tests, lld-api-spec.md
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

- `workflows/define-api.md`
- `workflows/build-backend.md`
- `workflows/design-backend.md`
- `workflows/test-backend.md`

## References

Load only the references needed for the current request:
- `references/anti-patterns.md` — supporting guidance.
- `references/api-conventions.md` — supporting guidance.
- `references/module-boundaries.md` — mandatory NestJS module folder structure and dependency-boundary standard for any source layout change.
- `references/nest-architecture.md` — supporting guidance.
- `references/security-baseline.md` — supporting guidance.

## Templates

Use these bundled templates when the request produces or updates the primary artifact:

- `templates/nestjs-api-slice.ts.tmpl` — NestJS API Slice Skeleton.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/definition-of-done.md`
- `/standards/code-review-checklist.md`

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Backend build
- **Ordered by:** `ai-delivery-planner`, `ai-solution-architect`
- **Required inputs:** `backlog item`, `approved LLD`, `repo standards`, `test strategy`
- **Generated artifact:** `backend Nest source`, `backend tests`, `lld-api-spec.md`
- **Next roles:** `ai-quality-engineer`, `ai-reviewer`, `ai-sre`
- **Human gate:** `security-sensitive change`, `production data access`, `API contract break`

## Handoff

- **Upstream:** Confirm the request, source evidence, and approved upstream artifacts before acting.
- **Downstream:** `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.
- **Evidence:** Summarize changed artifacts, key decisions, assumptions, open questions, risks, and validation evidence before routing onward.

## Security shift-left (Checkmarx)

After this skill ships a change, hand off to the `adp-sec-checkmarx` skill and run `adp-sec-checkmarx/workflows/post-implementation-review.md` against the diff. It catches Checkmarx-style SAST/IaC/Secrets/SCA findings — NoSQL/SQL injection, SSRF, prototype pollution, command injection, `Use_Of_Hardcoded_Password`, weak crypto, missing guards/`@UseGuards`, insecure deserialisation, log forging — before Checkmarx One scans in CI. Bootstrap the guardrails once via `adp-sec-checkmarx/workflows/bootstrap-copilot-guardrails.md`, which writes `.github/instructions/typescript-security.instructions.md` (`applyTo: **/*.ts,**/*.tsx,**/*.html,**/*.js,**/*.jsx`) and the repo-wide `.github/copilot-instructions.md`. The Checkmarx skill is owned by `ai-devsecops`; this skill only references it.

## Ownership

- **Primary owner:** `ai-backend-nestjs` (AI Backend Engineer (NestJS))
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
