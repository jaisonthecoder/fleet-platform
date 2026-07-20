---
name: adp-ba-intake-regulatory
description: "Intake for law, regulation, audit, or risk-driven demand. Use when producing or updating docs/01-discovery/demand-intake-regulatory.md, especially where obligation source, deadline and consequence, evidence expectation, and impacted data or controls must be captured."
---

# adp-ba-intake-regulatory

## Metadata

- **kind:** skill
- **version:** 0.1.128
- **stability:** alpha
- **role:** ai-business-analyst
- **tiers:** enterprise: baseline
- **why_critical:** Compliance-driven demand needs obligation traceability, evidence expectations, and deadline consequences before delivery work begins.
- **default_prompt:** Use the adp-ba-intake-regulatory skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Intake for law, regulation, audit, or risk-driven demand

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/demand-intake-regulatory.md

## Purpose
Capture regulatory, audit, risk, or compliance-driven demand: obligation source, deadline and consequence, evidence expectation, impacted data and controls, accountable owner, and downstream control handoff.

## Abu Dhabi Ports Group Context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. Keep regulatory claims grounded in source obligations, UAE regulatory expectations, AD Ports security and data-residency constraints, operational resilience, and auditable handoffs.

## Mental model

- **Protects:** compliance traceability.
- **Optimizes for:** obligation clarity and evidence readiness.
- **Refuses to leave ambiguous:** source obligation, deadline, consequence, control owner, or evidence expectation.
- **Primary artifact focus:** docs/01-discovery/demand-intake-regulatory.md.
- **Default stance:** capture the compliance driver before solution teams define controls or product scope.

## Hard rules

1. Name the obligation source: law, regulation, audit finding, risk, control gap, policy, contract, regulator instruction, or internal standard.
2. Capture deadline, consequence, evidence expectation, impacted data, impacted controls, accountable owner, and risk level.
3. Trace every compliance claim to source evidence; do not paraphrase obligations without a reference.
4. Route security, privacy, architecture, legal, or audit uncertainty to the owning role or human gate.
5. Keep solution design out of intake unless it is mandated by the obligation source.
6. Generate the artifact from `templates/demand-intake-regulatory-template.md.tmpl`; do not invent an alternate section structure. Record any deviation in the template deviation log.

## When to use

Trigger this skill when:
- Demand is driven by regulation, law, audit, risk acceptance, control deficiency, policy, or compliance deadline.
- A team needs intake before security, architecture, product, or implementation work can define controls.
- A regulator, auditor, risk owner, or governance owner requires traceable obligation intake.

Do not use this skill for net-new demand, business-case intake, change control, incident follow-up, or procurement-led demand unless compliance is the primary driver.

## Inputs

- Obligation source, policy, audit finding, risk record, regulator note, or compliance request.
- Deadline, consequence, owner, evidence expectation, and impacted controls.
- Impacted data, systems, users, entities, tenants, integrations, and operational processes.
- Legal, security, privacy, audit, or governance reviewer expectations.

## Outputs

- docs/01-discovery/demand-intake-regulatory.md
- Obligation source, deadline and consequence, evidence expectation, impacted data and controls, assumptions, risks, open questions, and downstream handoff.

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

- `templates/demand-intake-regulatory-template.md.tmpl` — Demand Intake (Regulatory).

## Standards

Use shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Intake
- **Ordered by:** `risk owner`, `audit owner`, `security owner`, `Business sponsor`
- **Required inputs:** `obligation source`, `deadline`, `evidence expectation`
- **Generated artifact:** `docs/01-discovery/demand-intake-regulatory.md`
- **Next roles:** `ai-business-analyst`, `ai-security-engineer`, `ai-solution-architect`
- **Human gate:** `risk, audit, legal, or compliance owner confirms obligation interpretation`

## Handoff

- **Upstream:** Confirm obligation source, deadline, consequence, evidence expectation, and owner before acting.
- **Downstream:** `ai-security-engineer`, `ai-business-analyst`, `ai-solution-architect`, `ai-product-manager`.
- **Evidence:** Summarize changed artifacts, obligation evidence, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-22

## Quality bar

- Obligation source and owner are linked.
- Deadline, consequence, and evidence expectation are explicit.
- Impacted data, controls, systems, and processes are named.
- Security, privacy, legal, audit, and governance uncertainties are routed.
- Next owner and decision gate are clear.
