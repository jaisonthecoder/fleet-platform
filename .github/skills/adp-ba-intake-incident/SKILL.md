---
name: adp-ba-intake-incident
description: "Intake for production incident or support-pain follow-up demand. Use when producing or updating docs/01-discovery/demand-intake-incident.md, especially where incident or problem source, impact and root cause, corrective action, and validation expectation must be captured."
---

# adp-ba-intake-incident

## Metadata

- **kind:** skill
- **version:** 0.1.128
- **stability:** alpha
- **role:** ai-business-analyst
- **tiers:** enterprise: baseline
- **why_critical:** Incident follow-up demand must connect operational pain to root cause, corrective action, and validation evidence before it becomes delivery scope.
- **default_prompt:** Use the adp-ba-intake-incident skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Intake for production incident or support-pain follow-up

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/demand-intake-incident.md

## Purpose
Capture production incident, problem, or support-pain follow-up demand: incident or problem source, impact and root cause, corrective action, validation expectation, accountable owner, and operational readiness handoff.

## Abu Dhabi Ports Group Context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. Keep incident follow-up grounded in operational impact, customer or user pain, root cause evidence, port and logistics continuity, service levels, security and data implications, and auditable handoffs.

## Mental model

- **Protects:** operational accountability.
- **Optimizes for:** corrective action clarity and validation evidence.
- **Refuses to leave ambiguous:** incident source, impact, root cause, corrective action, or validation expectation.
- **Primary artifact focus:** docs/01-discovery/demand-intake-incident.md.
- **Default stance:** capture the operational driver before converting follow-up work into requirements or backlog scope.

## Hard rules

1. Name the incident, problem, support trend, service request cluster, postmortem action, or operational pain source.
2. Capture impact, severity, affected users or process, root cause status, corrective action, validation expectation, and owner.
3. Trace every claim to incident records, postmortems, support tickets, telemetry, customer complaints, or operational evidence.
4. Separate immediate remediation from durable corrective action.
5. Route SRE, support, security, architecture, product, or quality uncertainty to the owning role.
6. Generate the artifact from `templates/demand-intake-incident-template.md.tmpl`; do not invent an alternate section structure. Record any deviation in the template deviation log.

## When to use

Trigger this skill when:
- Demand follows a production incident, problem record, support trend, postmortem action, recurring operational pain, or corrective action plan.
- A team needs intake before turning incident follow-up into BRD, PRD, architecture, test, or delivery work.
- Support, SRE, operations, or a business sponsor asks for structured follow-up.

Do not use this skill for net-new demand, business-case intake, change control, regulatory demand, or procurement-led demand unless operational incident follow-up is the primary driver.

## Inputs

- Incident, problem, support ticket trend, postmortem, telemetry, complaint, or corrective action source.
- Impact, severity, affected users, affected process, root cause status, and owner.
- Proposed corrective action, validation expectation, due date, and operational constraints.
- Existing workaround, escalation notes, service level, and risk evidence.

## Outputs

- docs/01-discovery/demand-intake-incident.md
- Incident or problem source, impact and root cause, corrective action, validation expectation, assumptions, risks, open questions, and downstream handoff.

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

- `templates/demand-intake-incident-template.md.tmpl` — Demand Intake (Incident).

## Standards

Use shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Intake
- **Ordered by:** `ai-support-analyst`, `ai-sre`, `Business sponsor`, `operations owner`
- **Required inputs:** `incident or problem source`, `impact`, `corrective action need`
- **Generated artifact:** `docs/01-discovery/demand-intake-incident.md`
- **Next roles:** `ai-business-analyst`, `ai-product-manager`, `ai-sre`, `ai-quality-engineer`
- **Human gate:** `operations or incident owner confirms follow-up priority`

## Handoff

- **Upstream:** Confirm incident source, impact, root cause status, corrective action, validation expectation, and owner before acting.
- **Downstream:** `ai-business-analyst`, `ai-product-manager`, `ai-sre`, `ai-quality-engineer`, `ai-support-analyst`.
- **Evidence:** Summarize changed artifacts, incident evidence, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-22

## Quality bar

- Incident or problem source is linked.
- Impact, root cause status, corrective action, owner, and validation expectation are explicit.
- Immediate remediation and durable follow-up are separated.
- Operational, support, quality, security, and SRE handoffs are routed when needed.
- Next owner and decision gate are clear.
