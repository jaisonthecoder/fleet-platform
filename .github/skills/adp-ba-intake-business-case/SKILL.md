---
name: adp-ba-intake-business-case
description: "Intake for investment or funding-driven demand. Use when producing or updating docs/01-discovery/demand-intake-business-case.md, especially where investment rationale, funding and approval path, benefit measures, and source business case must be captured before BRD or PRD work."
---

# adp-ba-intake-business-case

## Metadata

- **kind:** skill
- **version:** 0.1.128
- **stability:** alpha
- **role:** ai-business-analyst
- **tiers:** enterprise: baseline
- **why_critical:** Funding-backed demand needs accountable investment rationale before downstream teams convert it into requirements or delivery scope.
- **default_prompt:** Use the adp-ba-intake-business-case skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Intake for investment or funding-driven demand

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/demand-intake-business-case.md

## Purpose
Capture investment or funding-driven demand: investment rationale, funding and approval path, benefit measures, source business case, sponsor accountability, and decision readiness.

## Abu Dhabi Ports Group Context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. Keep investment claims grounded in source evidence, accountable sponsor ownership, measurable benefit, UAE regulatory expectations, operational resilience, and auditable handoffs.

## Mental model

- **Protects:** investment accountability.
- **Optimizes for:** funding clarity and measurable benefit.
- **Refuses to leave ambiguous:** business case source, approval path, or benefit owner.
- **Primary artifact focus:** docs/01-discovery/demand-intake-business-case.md.
- **Default stance:** capture enough to decide whether discovery should proceed without turning the intake into a BRD.

## Hard rules

1. Trace every investment claim to a source business case, sponsor note, budget item, steering decision, or approved planning artifact.
2. Record funding owner, approval forum, expected benefit, benefit measure, and decision deadline.
3. Separate requested investment from solution design; route solution scope to BRD or PRD after intake approval.
4. Name the AD Ports operational, regulatory, tenant, data, integration, or procurement constraint that changes the decision.
5. List missing financial, benefit, approval, or evidence inputs as blockers, assumptions, or open questions.
6. Generate the artifact from `templates/demand-intake-business-case-template.md.tmpl`; do not invent an alternate section structure. Record any deviation in the template deviation log.

## When to use

Trigger this skill when:
- Demand is justified by investment, funding, budget cycle, portfolio planning, business case, or capital approval.
- A sponsor asks to convert a business case into an intake artifact.
- A BRD or PRD is blocked because investment rationale or funding approval is unclear.

Do not use this skill for net-new idea intake, change control, regulatory demand, incident follow-up, or procurement-led demand unless funding is the primary driver.

## Inputs

- Source business case, budget request, portfolio item, or sponsor request.
- Sponsor, funder, approver, and approval forum.
- Benefit model, baseline, target, measurement owner, and date.
- Constraints, dependencies, risks, and source evidence.

## Outputs

- docs/01-discovery/demand-intake-business-case.md
- Investment rationale, funding and approval path, benefit measures, source evidence, assumptions, risks, open questions, and downstream handoff.

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
- `workflows/update-artifact.md`
- `workflows/review-artifact.md`

## Templates

Use these bundled templates when the request produces or updates the primary artifact:

- `templates/demand-intake-business-case-template.md.tmpl` — Demand Intake (Business Case).

## Standards

Use shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Intake
- **Ordered by:** `Business sponsor`, `portfolio owner`, `adp-handoffs:start-here`
- **Required inputs:** `source business case`, `sponsor/contact`, `investment rationale`
- **Generated artifact:** `docs/01-discovery/demand-intake-business-case.md`
- **Next roles:** `ai-business-analyst`, `ai-product-manager`
- **Human gate:** `funding or portfolio owner confirms investment rationale`

## Handoff

- **Upstream:** Confirm source business case, sponsor, benefit owner, and approval path before acting.
- **Downstream:** `ai-business-analyst`, `ai-product-manager`, `ai-solution-architect`.
- **Evidence:** Summarize changed artifacts, investment decision evidence, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-22

## Quality bar

- Source business case or investment evidence is linked.
- Funding and approval path are named.
- Benefit measures include owner, baseline or current estimate, target, and evidence source.
- Open questions and blockers are explicit.
- Next owner and decision gate are clear.
