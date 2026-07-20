---
name: adp-ba-brd
description: "Produce the BRD using the approved template exactly, with BABOK v3 as the analysis lens for current state, future state, scope, and business/stakeholder/transition requirement classification. Use this skill when producing or updating docs/01-discovery/brd.md from demand intake, business problem, current state and pain, target outcome, stakeholders, success metrics, assumptions, risks, or constraints."
---

# adp-ba-brd

## Metadata

- **kind:** skill
- **version:** 1.2.8
- **stability:** stable
- **role:** ai-business-analyst
- **tiers:** advanced: baseline · enterprise: baseline
- **why_critical:** Prevents building the right feature for the wrong problem; feeds PRD and downstream roles with the approved business reason, target outcome, and delivery constraints.
- **default_prompt:** Use the adp-ba-brd skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** BRD following the approved template exactly

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/brd.md

## Why critical
Prevents building the right feature for the wrong problem; feeds PRD and downstream roles with the approved business reason, target outcome, and delivery constraints.

## Purpose
Business Requirements Document following the approved BRD template exactly. The template captures business context, objectives and scope, future state, classified requirements (business, stakeholder, transition), assumptions, constraints, dependencies, risks, traceability, handoff notes, glossary, and references.

## Reference frameworks

- **Primary: approved BRD template.** Preserve `templates/brd-template.md.tmpl` exactly: heading text, heading order, table columns, placeholder style, optional document-control block, annexes, and handoff notes.
- **BABOK v3 analysis lens.** Use BABOK practice to analyze current state, future state, objectives, scope, stakeholders, and requirement classification, but fit the output into the approved template instead of adding new sections.
- **ISO/IEC/IEEE 29148.** Do not add an ISO/BRS supplement to the BRD by default. If the sponsor, regulator, or `ai-solution-architect` explicitly requests ISO 29148 conformance, record that as a template exception and ask before adding sections outside the approved template.

## Abu Dhabi Ports Group context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. The role-specific AD Ports edges are sponsor accountability, measurable value, customs cut-offs, terminal operating windows, stakeholder ownership across entities, and explicit assumptions before PRD handoff. Keep outputs traceable to source evidence, tenant-aware, UAE-regulatory aware, operationally resilient, and ready for audit handoff.

## Mental model

- **Protects:** business accountability.
- **Optimizes for:** sponsor value and measurable outcomes.
- **Refuses to leave ambiguous:** unstated stakeholders, assumptions, or approval paths.
- **Primary artifact focus:** docs/01-discovery/brd.md.
- **Default stance:** keep the work small enough to verify, but explicit enough that the next role does not need to reconstruct intent.

## Hard rules

1. **Follow the approved template exactly.** Generate `docs/01-discovery/brd.md` from `templates/brd-template.md.tmpl` and preserve heading text, heading order, table columns, placeholder style, optional blocks, and annexes. Do not add standalone sections such as AD Ports checks, PM handoff readiness, ISO supplements, evidence logs, template deviation logs, or approvals unless the user explicitly changes the template.
2. **Trace every output to a driver.** Link the backlog item, defect, incident, ADR, interview, telemetry, or upstream artifact that justifies the work using the template's Drivers for Change, Traceability Matrix, and References sections.
3. **Use standards by reference.** Link `/standards/` files and bundled templates instead of copying their content into the artifact.
4. **Keep ownership visible.** The primary owner keeps the skill current, but downstream roles must be named whenever the artifact leaves this skill.
5. **Evidence beats assertion.** Prefer test output, screenshots, generated files, telemetry, review notes, or source links over claims that something was checked.
6. **Load references selectively.** Read only the reference file needed for the current request; do not load the whole folder by default.
7. **Protect handoff consistency.** Every BRD must give downstream FR/NFR owners traceable driver IDs, objective IDs, BR IDs, SR/TR IDs, metrics, open-question owners, and handoff notes inside section 7, not in an added PM handoff section.
8. **Name the AD Ports edge without changing the template.** Record tenancy, Arabic/RTL, data residency, NESA/PDPL, vessel/customs operations, SAP/Oracle windows, or maritime SLA implications in the approved sections: Background, Drivers for Change, Business Rules and Policies, Constraints, Risks, or Handoff Notes.
9. **Classify requirements per BABOK v3.** Keep business (`BR-###`), stakeholder (`SR-###`), and transition (`TR-###`) requirements in their existing template subsections with traceability from SR/TR to BR.

## Pitfalls

- **Generic output:** The artifact could apply to any company; add the AD Ports operational or regulatory constraint that changes the answer.
- **Hidden assumption:** A decision depends on missing input but the gap is buried in prose; list it under assumptions or open questions.
- **Broken handoff:** The next role is implied rather than named; use section 7.2 FR / NFR Handoff Notes to state what downstream roles should do next.
- **Template theater:** Sections are filled to look complete without evidence; remove noise and link proof.
- **Scope bleed:** The skill starts solving a neighboring role's artifact or adds sections from another template; split the request and route the other artifact to its owner.

## Evidence expectations

- **Minimum evidence:** source request, changed artifact path, key decisions, assumptions, open questions, and downstream role.
- **When code is touched:** include commands run, test results, relevant screenshots or logs, and residual risk.
- **When docs are touched:** include source artifacts reviewed, standards used, and reviewer or approver expected next.
- **When risk is found:** record owner, severity, mitigation, and whether delivery can proceed.
- **When using adp-ba-brd:** finish with the files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before producing `docs/01-discovery/brd.md`:** confirm the artifact is owned by this skill and the approved template has been copied before content is filled.
- **Before changing scope:** confirm the change still protects business accountability and does not dilute sponsor value and measurable outcomes.
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

- A reviewer should be able to compare the BRD headings and table columns against `templates/brd-template.md.tmpl` and see no unapproved structure drift.
- A reviewer should be able to see how this skill handled unstated stakeholders, assumptions, or approval paths.
- A reviewer should be able to locate source evidence without asking for chat history.
- A reviewer should be able to tell which AD Ports edge was considered and why it mattered or did not apply.
- A reviewer should be able to rerun, inspect, or challenge the evidence path.
- A reviewer should be able to route the next action to one named role.

## When to use
Trigger this skill when:
- A new instance of `docs/01-discovery/brd.md` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work.

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill.

## Inputs
- Business request, backlog item, incident, support trend, regulatory driver, or sponsor request that justifies the change.
- `docs/01-discovery/demand-intake.md` when available.
- Sponsor notes, stakeholder interviews, workshop notes, operational constraints, business constraints, telemetry, support tickets, or source evidence.
- Existing `docs/01-discovery/brd.md` when updating an approved or draft BRD, unless a capability-specific BRD path is recorded through `/standards/artifact-path-routing.md`.

Do not treat PRD, acceptance criteria, UX design, NFR, HLD, or LLD as normal upstream inputs for a new BRD. If those artifacts already exist, use them only as evidence to reconcile drift, and record the deviation.

## Outputs
- `docs/01-discovery/brd.md`
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

- `workflows/capture-discovery.md`
- `workflows/capture-risks.md`
- `workflows/define-success-metrics.md`
- `workflows/map-user-journey.md`
- `workflows/write-brd.md`

## Templates

Use these bundled templates when the request produces or updates the primary artifact:

- `templates/brd-template.md.tmpl` — Business Requirements Document. This file is the exact structure contract for generated BRDs.

## References

Load only when the request needs detailed guidance:

- `references/guidance.md`

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Repeatable draft-generation rules

When an AI agent generates a draft BRD from the same request, same source evidence, and same template, the output should be materially repeatable. Do not vary section order, heading text, table columns, requirement IDs, assumption IDs, status labels, or handoff roles just for wording variety.

- Use the bundled BRD template exactly. If the user asks for a different format, ask whether they want to update the template first; do not invent a deviation section.
- Keep deterministic IDs from the approved template: `DR-001`, `OBJ-001`, `M-001`, `BP-001`, `RULE-001`, `BR-001`, `SR-001`, `TR-001`, `A-001`, `C-001`, `D-001`, `R-001`, `Q-001`, and `REF-001`.
- Do not add an ISO/IEC/IEEE 29148 supplement unless explicitly requested and approved as a template exception.
- Use `TBD` for missing sponsor, owner, approver, baseline, target, date, ticket, or source values; do not invent placeholders that change across runs.
- Keep missing-input handling stable: list the same missing facts under assumptions, open questions, validation gaps, or blockers based on their role in the artifact.
- Keep traceability and handoff stable: section 7 must map driver IDs, objective IDs, BR IDs, SR/TR IDs, and downstream FR/NFR IDs or placeholders.
- If an existing draft BRD is present, update only facts that changed or gaps that were resolved; do not rewrite the whole artifact for style.
- If the user asks for a dry run, return the BRD content as markdown and do not write the artifact.
- If no new evidence is provided, repeated generation should not add new business claims, metrics, stakeholders, integrations, or AD Ports edges.

## Handoff contract

Before routing downstream, ensure the BRD includes the approved template fields:

- Driver IDs tied to business context and source evidence.
- Objective IDs tied to metrics and beneficiaries.
- BR IDs tied to business outcomes, with SR/TR rows traced to BR IDs.
- Open questions with owner, needed-by date, and impact.
- Section 7 traceability and FR/NFR handoff notes, without adding a separate PM handoff section.

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Discovery
- **Ordered by:** `Business sponsor`, `adp-ba-intake-demand`
- **Required inputs:** `docs/01-discovery/demand-intake.md`, `stakeholder notes`, `business constraints`
- **Generated artifact:** `docs/01-discovery/brd.md`
- **Next roles:** `ai-product-manager`, `ai-solution-architect`
- **Human gate:** `BRD approval`

## Handoff

- **Upstream:** Confirm the request, source evidence, and approved upstream artifacts before acting.
- **Downstream:** `ai-product-manager`, `ai-solution-architect`.
- **Evidence:** Summarize changed artifacts, key decisions, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-07-02

## Changelog

- **1.2.7 — 2026-07-02**
  - Restored the approved formal BRD template as the exact generation contract and tightened the workflow rules to prevent added sections, renamed headings, reordered content, or PM/AD Ports/ISO section drift.
- **1.2.3 — 2026-06-30**
  - Historical template policy update, superseded by 1.2.7 for exact-template generation.
- **1.2.0 — 2026-06-16**
  - Historical template policy update, superseded by 1.2.7 for exact-template generation.
- **1.1.x — earlier:** BABOK v3 made the primary BRD analysis lens; minor patch bumps.

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
