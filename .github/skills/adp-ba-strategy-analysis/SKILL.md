---
name: adp-ba-strategy-analysis
description: "BABOK v3 strategy analysis for current state, future state, risk, and change strategy. Use when producing or updating docs/01-discovery/strategy-analysis.md, including brownfield gap analysis, Wave or E-Pass change strategy, transition risks, and readiness for BRD or roadmap work."
---

# adp-ba-strategy-analysis

## Metadata

- **kind:** skill
- **version:** 0.1.127
- **stability:** alpha
- **role:** ai-business-analyst
- **tiers:** enterprise: should-have
- **why_critical:** Strategy analysis turns ambiguous brownfield change into traceable current-state, future-state, risk, and change-strategy decisions before requirements are written.
- **default_prompt:** Use the adp-ba-strategy-analysis skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** BABOK strategy analysis for current state and change strategy

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/strategy-analysis.md

## Purpose
Produce BABOK v3 Strategy Analysis: analyze current state, define future state, assess risks, define change strategy, and use gap analysis as the core technique for brownfield, Wave, E-Pass, or similar transformation work.

## Abu Dhabi Ports Group Context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. Keep strategy claims grounded in operational evidence, sponsor strategy, port and logistics constraints, entity boundaries, UAE regulatory expectations, data and integration realities, operational resilience, and auditable handoffs.

## Mental model

- **Protects:** strategic alignment before requirements.
- **Optimizes for:** gap clarity, transition risk visibility, and practical change sequencing.
- **Refuses to leave ambiguous:** current state, future state, capability gap, risk, or change strategy.
- **Primary artifact focus:** docs/01-discovery/strategy-analysis.md.
- **Default stance:** analyze the change enough to guide BRD, PRD, roadmap, architecture, and delivery decisions without replacing those artifacts.

## Hard rules

1. Capture current state using evidence: processes, systems, users, pain points, metrics, constraints, policies, integrations, data, and operational windows.
2. Define future state as outcomes and capabilities, not only solution features.
3. Make gap analysis explicit: capability gaps, process gaps, data gaps, people gaps, technology gaps, control gaps, and decision gaps.
4. Assess risks across business, operational, regulatory, security, data, vendor, adoption, delivery, and dependency dimensions.
5. Define change strategy with sequencing, transition approach, stakeholder impact, readiness needs, assumptions, decision gates, and downstream handoffs.

## When to use

Trigger this skill when:
- A request needs current-state, future-state, gap, risk, or change-strategy analysis before a BRD, PRD, roadmap, or architecture decision.
- Brownfield transformation, Wave, E-Pass, process change, system replacement, migration, or operating-model change is being shaped.
- A sponsor asks for strategy analysis, gap analysis, transition planning, or change strategy.

Do not use this skill to write the BRD, PRD, architecture, roadmap, or implementation plan. Route those artifacts to their owning skills after strategy analysis is complete.

## Inputs

- Demand intake, sponsor strategy, business objectives, stakeholder notes, operational evidence, current-state artifacts, telemetry, support trends, incidents, audits, or regulatory drivers.
- Existing processes, systems, integrations, data sources, controls, policies, contracts, and constraints.
- Target outcomes, deadlines, strategic themes, dependency constraints, and known risks.

## Outputs

- docs/01-discovery/strategy-analysis.md
- Current-state analysis, future-state definition, gap analysis, risk assessment, change strategy, assumptions, open questions, decision gates, and downstream handoff.

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

- `workflows/analyze-current-state.md`
- `workflows/define-future-state.md`
- `workflows/assess-risks.md`
- `workflows/define-change-strategy.md`
- `workflows/produce-artifact.md`
- `workflows/update-artifact.md`
- `workflows/review-artifact.md`

## Standards

Use shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Discovery
- **Ordered by:** `Business sponsor`, `adp-ba-intake-demand`, `ai-business-analyst`, `ai-product-manager`
- **Required inputs:** `demand intake or strategy driver`, `current-state evidence`, `target outcome`
- **Generated artifact:** `docs/01-discovery/strategy-analysis.md`
- **Next roles:** `ai-business-analyst`, `ai-product-manager`, `ai-solution-architect`, `ai-delivery-planner`
- **Human gate:** `sponsor confirms future-state direction and change strategy`

## Handoff

- **Upstream:** Confirm strategy driver, current-state evidence, target outcomes, constraints, and sponsor before acting.
- **Downstream:** `ai-business-analyst`, `ai-product-manager`, `ai-solution-architect`, `ai-delivery-planner`, `ai-ux-ui-designer`.
- **Evidence:** Summarize changed artifacts, current-state evidence, future-state decisions, gap analysis, risks, assumptions, open questions, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-22

## Quality bar

- Current-state claims are evidence-backed.
- Future-state outcomes and capabilities are explicit.
- Gap analysis is visible and categorized.
- Risks include owner, severity, mitigation, and downstream impact.
- Change strategy includes sequencing, readiness, decision gates, and handoff owners.
