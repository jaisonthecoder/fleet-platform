---
name: adp-ba-intake-procurement
description: "Intake for vendor or procurement-driven demand. Use when producing or updating docs/01-discovery/demand-intake-procurement.md, especially where procurement need, commercial context, vendor and security impact, and source procurement record must be captured."
---

# adp-ba-intake-procurement

## Metadata

- **kind:** skill
- **version:** 0.1.128
- **stability:** alpha
- **role:** ai-business-analyst
- **tiers:** enterprise: baseline
- **why_critical:** Vendor-driven demand needs commercial, security, data, and procurement traceability before delivery teams depend on a third party.
- **default_prompt:** Use the adp-ba-intake-procurement skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Intake for vendor or procurement-driven demand

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/demand-intake-procurement.md

## Purpose
Capture vendor or procurement-driven demand: procurement need, commercial context, vendor and security impact, source procurement record, accountable owner, and downstream sourcing or delivery handoff.

## Abu Dhabi Ports Group Context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. Keep vendor demand grounded in procurement records, commercial context, security and privacy constraints, data residency, integration risk, operational continuity, and auditable handoffs.

## Mental model

- **Protects:** procurement and vendor accountability.
- **Optimizes for:** commercial clarity and third-party risk visibility.
- **Refuses to leave ambiguous:** procurement source, vendor role, commercial constraint, security impact, or approval path.
- **Primary artifact focus:** docs/01-discovery/demand-intake-procurement.md.
- **Default stance:** capture procurement facts before turning vendor need into product, architecture, or implementation scope.

## Hard rules

1. Name the procurement need, source procurement record, vendor or market context, commercial constraint, security impact, and procurement owner.
2. Capture whether the demand is vendor selection, renewal, replacement, integration, onboarding, license expansion, or contract-driven change.
3. Trace every vendor or commercial claim to procurement records, contracts, sourcing notes, sponsor evidence, or vendor material.
4. Route security, privacy, architecture, integration, legal, or procurement uncertainty to the owning role or human gate.
5. Keep vendor solution detail separate from business need unless the procurement record mandates the vendor or product.
6. Generate the artifact from `templates/demand-intake-procurement-template.md.tmpl`; do not invent an alternate section structure. Record any deviation in the template deviation log.

## When to use

Trigger this skill when:
- Demand is driven by vendor selection, procurement, renewal, contract, license, sourcing, third-party integration, or supplier onboarding.
- A team needs intake before BRD, PRD, security assessment, architecture, or implementation work can proceed.
- Procurement, legal, security, or a sponsor requires structured vendor-demand intake.

Do not use this skill for net-new demand, business-case intake, change control, regulatory demand, or incident follow-up unless procurement is the primary driver.

## Inputs

- Procurement request, sourcing record, vendor proposal, contract, renewal notice, license request, or sponsor note.
- Procurement owner, business sponsor, vendor contact, commercial constraints, approval path, and target date.
- Security, privacy, data residency, integration, operational, legal, and support impact evidence.
- Existing systems, contracts, vendors, dependencies, and risk records.

## Outputs

- docs/01-discovery/demand-intake-procurement.md
- Procurement need, commercial context, vendor and security impact, source procurement record, assumptions, risks, open questions, and downstream handoff.

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

- `templates/demand-intake-procurement-template.md.tmpl` — Demand Intake (Procurement).

## Standards

Use shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Intake
- **Ordered by:** `procurement owner`, `Business sponsor`, `security owner`, `vendor manager`
- **Required inputs:** `source procurement record`, `procurement need`, `commercial context`
- **Generated artifact:** `docs/01-discovery/demand-intake-procurement.md`
- **Next roles:** `ai-business-analyst`, `ai-security-engineer`, `ai-solution-architect`, `ai-integration-engineer`
- **Human gate:** `procurement or vendor owner confirms sourcing route`

## Handoff

- **Upstream:** Confirm procurement source, need, commercial context, vendor role, security impact, and owner before acting.
- **Downstream:** `ai-security-engineer`, `ai-business-analyst`, `ai-solution-architect`, `ai-integration-engineer`, `ai-product-manager`.
- **Evidence:** Summarize changed artifacts, procurement evidence, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-22

## Quality bar

- Source procurement record and owner are linked.
- Procurement need, commercial context, vendor role, and approval path are explicit.
- Security, privacy, data, integration, legal, operational, and support impacts are named.
- Third-party risk handoffs are routed when needed.
- Next owner and decision gate are clear.
