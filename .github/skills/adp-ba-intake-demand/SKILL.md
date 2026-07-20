---
name: adp-ba-intake-demand
description: "Intake for net-new needs, ideas, and features. Use when producing or updating docs/01-discovery/demand-intake.md for a new demand, including need or opportunity, target users or process, expected benefit, and initial priority. Owned by AI Business Analyst."
---

# adp-ba-intake-demand

## Metadata

- **kind:** skill
- **version:** 1.1.6
- **stability:** stable
- **role:** ai-business-analyst
- **tiers:** enterprise: baseline
- **why_critical:** Every project starts here; AI reads it before any other artifact exists, so the request must be accountable, sourced, and triaged before downstream work begins.
- **default_prompt:** Use the adp-ba-intake-demand skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Intake for net-new needs, ideas, and features

**Owner role:** AI Business Analyst (`ai-business-analyst`)
**Primary artifact:** docs/01-discovery/demand-intake.md

## Why critical
Every project starts here; AI reads it before any other artifact exists, so the request must be accountable, sourced, and triaged before downstream work begins.

## Purpose
Intake for net-new needs, ideas, and features. Capture the need or opportunity, target users or process, expected benefit, source evidence, sponsor accountability, and initial priority.

## Abu Dhabi Ports Group context

Apply this skill as AI Business Analyst delivery guidance for AD Ports work. The role-specific AD Ports edges are sponsor accountability, measurable value, customs cut-offs, terminal operating windows, stakeholder ownership across entities, and explicit assumptions before PRD handoff. Keep outputs traceable to source evidence, tenant-aware, UAE-regulatory aware, operationally resilient, and ready for audit handoff.

## Mental model

- **Protects:** business accountability.
- **Optimizes for:** sponsor value and measurable outcomes.
- **Refuses to leave ambiguous:** unstated stakeholders, assumptions, or approval paths.
- **Primary artifact focus:** docs/01-discovery/demand-intake.md.
- **Default stance:** keep the work small enough to verify, but explicit enough that the next role does not need to reconstruct intent.

## Hard rules

1. **Trace every output to a driver.** Link the backlog item, defect, incident, ADR, interview, telemetry, or upstream artifact that justifies the work.
2. **Name the AD Ports edge.** Record whether tenancy, Arabic/RTL, data residency, NESA/PDPL, vessel/customs operations, SAP/Oracle windows, or maritime SLAs apply.
3. **Use standards by reference.** Link `/standards/` files and bundled templates instead of copying their content into the artifact.
4. **Keep ownership visible.** The primary owner keeps the skill current, but downstream roles must be named whenever the artifact leaves this skill.
5. **Evidence beats assertion.** Prefer test output, screenshots, generated files, telemetry, review notes, or source links over claims that something was checked.
6. **Use the bundled intake template.** Generate `docs/01-discovery/demand-intake.md` from `templates/demand-intake-template.md.tmpl`; do not invent an alternate section structure. If the user asks for a different format, record the deviation in `## 12. Template deviation log`.
7. **Run the pre-document clarification loop.** Before creating a new `docs/01-discovery/demand-intake.md`, ask the user for missing requirements, constraints, sponsor details, success measures, and AD Ports edge cases. Create the document only after the user answers, confirms there is nothing else to add, or explicitly accepts documented assumptions.
8. **Ask for every `TBD` before finalizing.** Treat each `TBD` in the generated artifact as a user-fillable field. Ask concise grouped questions to replace them; leave a field unresolved only when the user explicitly accepts it as an open question, assumption, not applicable item, or pending business input.
9. **Separate assumptions from open questions.** Assumptions and open questions must use separate artifact sections. Open questions must be highlighted, owner-assigned, and tracked with needed-by date, blocker status, and latest-answer status.
10. **Use chat to close questions during generation.** While generating demand intake, keep a short conversational question-closure loop open with the user. Capture answers directly into the draft, convert answerable gaps into assumptions only with explicit acceptance, and leave unresolved items in the highlighted open-questions section.
11. **Load references selectively.** Read only the reference file needed for the current request; do not load the whole folder by default.

## Pitfalls

- **Generic output:** The artifact could apply to any company; add the AD Ports operational or regulatory constraint that changes the answer.
- **Hidden assumption:** A decision depends on missing input but the gap is buried in prose; list it under the dedicated assumptions section or the highlighted open-questions section.
- **Mixed question log:** Assumptions and open questions share a single table; split them so reviewers can see what is accepted versus what still needs an answer.
- **Broken handoff:** The next role is implied rather than named; add the downstream role and what they should do next.
- **Template theater:** Sections are filled to look complete without evidence; remove noise and link proof.
- **Scope bleed:** The skill starts solving a neighboring role's artifact; split the request and route the other artifact to its owner.

## Evidence expectations

- **Minimum evidence:** source request, changed artifact path, key decisions, assumptions, open questions, and downstream role.
- **When code is touched:** include commands run, test results, relevant screenshots or logs, and residual risk.
- **When docs are touched:** include source artifacts reviewed, standards used, and reviewer or approver expected next.
- **When risk is found:** record owner, severity, mitigation, and whether delivery can proceed.
- **When using adp-ba-intake-demand:** finish with the files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before producing docs/01-discovery/demand-intake.md:** confirm the artifact is owned by this skill and not a neighboring role.
- **Before creating a new document:** complete the pre-document clarification loop so user-provided requirements and constraints are captured before drafting.
- **Before finalizing a generated document:** review every `TBD`, ask the user for the missing business value in chat, and convert unresolved fields into explicit assumptions, highlighted open questions, not-applicable entries, or pending owner actions.
- **Before changing scope:** confirm the change still protects business accountability and does not dilute sponsor value and measurable outcomes.
- **Before marking done:** confirm standards, templates, references, and workflow handoff were actually used where applicable.
- **Before routing onward:** confirm the downstream role has a clear next action, not just a notification.
- **Before accepting missing input:** record whether the gap blocks work, creates risk, can be carried as an assumption, or remains a highlighted open question with owner and needed-by date.

## Escalation triggers

- **Security or privacy uncertainty:** involve `ai-security-engineer` before producing a final artifact.
- **Architecture or integration uncertainty:** involve `ai-solution-architect` or `ai-integration-engineer` before locking the decision.
- **Operational readiness uncertainty:** involve `ai-platform-engineer` or `ai-sre` before release-facing handoff.
- **Testability uncertainty:** involve `ai-quality-engineer` before accepting the artifact as implementation-ready.
- **Ownership uncertainty:** involve `ai-governance-lead` rather than leaving the skill, artifact, or exception owner implicit.

## Review lens

- A reviewer should be able to see how this skill handled unstated stakeholders, assumptions, or approval paths.
- A reviewer should be able to locate source evidence without asking for chat history.
- A reviewer should be able to tell which AD Ports edge was considered and why it mattered or did not apply.
- A reviewer should be able to rerun, inspect, or challenge the evidence path.
- A reviewer should be able to route the next action to one named role.

## When to use
Trigger this skill when:
- A new instance of `docs/01-discovery/demand-intake.md` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work.

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill.

## Inputs
- Backlog story / defect / ADR follow-up that justifies the change.
- Approved upstream artifacts the skill depends on (project context, BRD, PRD, NFR, HLD, etc., as relevant).
- Source evidence (interviews, telemetry, prior runs, support tickets) where applicable.

## Outputs
- docs/01-discovery/demand-intake.md
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

- `workflows/capture-sponsor-constraints.md`
- `workflows/frame-business-request.md`
- `workflows/prepare-discovery-handoff.md`
- `workflows/produce-artifact.md`
- `workflows/review-artifact.md`
- `workflows/size-business-value.md`
- `workflows/update-artifact.md`

## Merged Legacy Guidance

These references preserve guidance merged from older non-ADP source skill folders. Load only when maintaining legacy role or preset behavior, or when the active workflow needs the role-level detail. Treat legacy role names as archival; use current `ai-*` role names in live outputs.

- `references/merged-from-business-intake.md` — legacy `business-intake` guidance merged into this ADP task skill.

## Templates

Use these bundled templates when the request produces or updates the primary artifact:

- `templates/demand-intake-template.md.tmpl` — Demand Intake.

## References

Load only the references needed for the current request:

- No active reference is required by default. Use the merged legacy guidance above only for maintenance or comparison.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/brd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Intake
- **Ordered by:** `Business sponsor`, `adp-handoffs:start-here`
- **Required inputs:** `business request`, `sponsor/contact`, `problem statement`
- **Generated artifact:** `docs/01-discovery/demand-intake.md`
- **Next roles:** `ai-business-analyst`, `ai-product-manager`
- **Human gate:** `sponsor confirms ownership/value`

## Handoff

- **Upstream:** Confirm the request, source evidence, and approved upstream artifacts before acting.
- **Downstream:** `ai-product-manager`, `ai-solution-architect`.
- **Evidence:** Summarize changed artifacts, key decisions, assumptions, open questions, risks, and validation evidence before routing onward.

## Ownership

- **Primary owner:** `ai-business-analyst` (AI Business Analyst)
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
