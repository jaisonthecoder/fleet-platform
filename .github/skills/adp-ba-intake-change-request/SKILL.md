---
name: adp-ba-intake-change-request
description: "Intake for changes to an approved baseline. Use when producing or updating docs/01-discovery/demand-intake-change-request.md, especially where affected baseline, requested change, change impact, and change control evidence must be captured before re-planning."
---

# adp-ba-intake-change-request

## Metadata

- **kind:** skill
- **version:** 0.1.128
- **stability:** alpha
- **role:** ai-business-analyst
- **tiers:** enterprise: baseline
- **why_critical:** Approved baselines should only change with visible impact, ownership, and change-control evidence.
- **default_prompt:** Use the adp-ba-intake-change-request skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Intake for changes to an approved baseline

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/demand-intake-change-request.md

## Purpose
Capture changes to an approved baseline: affected baseline, requested change, change impact, change-control route, source evidence, sponsor accountability, and downstream rework.

## Abu Dhabi Ports Group Context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. Keep baseline changes traceable, tenant-aware, operationally resilient, and clear about impact to port operations, regulatory commitments, approved scope, timeline, cost, risk, and auditable handoffs.

## Mental model

- **Protects:** approved baseline integrity.
- **Optimizes for:** impact clarity and controlled change.
- **Refuses to leave ambiguous:** changed baseline, impact owner, or approval route.
- **Primary artifact focus:** docs/01-discovery/demand-intake-change-request.md.
- **Default stance:** capture the change-control facts before downstream teams re-scope.

## Hard rules

1. Name the affected baseline: BRD, PRD, HLD, LLD, contract, release plan, budget, scope, schedule, or operational commitment.
2. Capture requested change, rationale, impacted stakeholders, cost, schedule, risk, benefit, and operational impact.
3. Trace the request to change-control evidence such as an approved ticket, steering decision, sponsor note, defect, incident, or audit finding.
4. Separate impact analysis from approval; record whether the change is proposed, accepted, rejected, or pending.
5. Route security, architecture, product, or release impacts to the owning role.
6. Generate the artifact from `templates/demand-intake-change-request-template.md.tmpl`; do not invent an alternate section structure. Record any deviation in the template deviation log.

## When to use

Trigger this skill when:
- A user asks to change an approved requirement, scope item, design, schedule, budget, or release baseline.
- A downstream role needs intake before re-planning or re-estimation.
- A change-control board, sponsor, or project owner requires a structured change request.

Do not use this skill for net-new demand, business-case intake, regulatory demand, incident follow-up, or procurement-led demand unless the primary issue is a baseline change.

## Inputs

- Existing approved baseline and baseline owner.
- Requested change, source evidence, requester, sponsor, and reason.
- Impact evidence across scope, cost, time, risk, operations, security, data, procurement, and downstream artifacts.
- Change-control route and decision deadline.

## Outputs

- docs/01-discovery/demand-intake-change-request.md
- Affected baseline, requested change, impact analysis, change-control route, assumptions, risks, open questions, and downstream handoff.

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

- `templates/demand-intake-change-request-template.md.tmpl` — Demand Intake (Change Request).

## Standards

Use shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Intake
- **Ordered by:** `Business sponsor`, `project owner`, `change-control board`
- **Required inputs:** `approved baseline`, `requested change`, `source evidence`
- **Generated artifact:** `docs/01-discovery/demand-intake-change-request.md`
- **Next roles:** `ai-business-analyst`, `ai-product-manager`, `ai-delivery-planner`
- **Human gate:** `baseline owner confirms change-control route`

## Handoff

- **Upstream:** Confirm affected baseline, owner, requested change, and evidence before acting.
- **Downstream:** `ai-business-analyst`, `ai-product-manager`, `ai-solution-architect`, `ai-delivery-planner`.
- **Evidence:** Summarize changed artifacts, baseline impact, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-22

## Quality bar

- Approved baseline and owner are named.
- Requested change and rationale are traceable to evidence.
- Scope, timeline, cost, risk, operational, and downstream impacts are explicit.
- Change-control route and decision status are visible.
- Next owner and decision gate are clear.
