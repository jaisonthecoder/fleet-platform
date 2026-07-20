---
name: adp-pm-fr
description: "Functional requirements for product behavior, business rules, user flows, acceptance criteria, draft test cases, and traceability. Use when producing or updating docs/02-product/FR/functional-requirements.md, deriving FRs from BRD/PRD, splitting behavior into testable requirements, generating test case drafts from acceptance criteria, or clarifying what the system must do. Owned by AI Product Manager."
---

# adp-pm-fr

## Metadata

- **kind:** skill
- **version:** 1.0.12
- **stability:** stable
- **role:** ai-product-manager
- **tiers:** advanced: baseline · enterprise: baseline
- **why_critical:** Makes product behavior explicit before design, architecture, implementation, and QA turn assumptions into scope drift.
- **default_prompt:** Use the adp-pm-fr skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Functional requirements, test cases, and behavior traceability

**Owner role:** AI Product Manager (`ai-product-manager`)
**Primary artifact:** docs/02-product/FR/functional-requirements.md

## Why critical
Makes product behavior explicit before design, architecture, implementation, and QA turn assumptions into scope drift.

## Purpose
Produce and maintain functional requirements: system behaviors, business rules, user interactions, inputs, outputs, state transitions, validations, exception paths, acceptance criteria, draft test cases, and BRD/PRD/story/test traceability.

## Abu Dhabi Ports Group context

Apply this skill as AI Product Manager delivery guidance for AD Ports work. Keep functional requirements aligned to business value, port and logistics operations, multi-terminal personas, Arabic/RTL needs, UAE regulatory expectations, data residency, operational windows, and auditable handoffs.

## Mental model

- **Protects:** product behavior.
- **Optimizes for:** testable scope and traceable acceptance.
- **Refuses to leave ambiguous:** what the system must do, for whom, under which conditions, and how success is observed.
- **Primary artifact focus:** `docs/02-product/FR/functional-requirements.md`.
- **Default stance:** define the smallest behavior contract that downstream roles can implement and verify.

## Hard rules

1. **Trace every FR to a driver.** Link each requirement to a BRD item, PRD goal, backlog item, stakeholder evidence, incident, or regulatory/business rule.
2. **Use atomic requirement IDs.** Use stable IDs such as `FR-001`; do not renumber existing IDs.
3. **Write observable behavior.** State actor, trigger, preconditions, behavior, outcome, exceptions, and acceptance criteria.
4. **Merge user story context into the FR detail.** When a user story exists, copy its `As a / I want / So that` statement, story objective, personas, scenario notes, business value, and relevant acceptance criteria into the FR package description's User Story Context and Behavior Detail sections. Do not leave the story only as a link or backlog ID. If no story exists, record the missing story as an evidence gap or blocker.
5. **Separate FR from NFR.** Route measurable quality targets such as latency, availability, scalability, security controls, and resilience to `adp-arch-nfr`; keep only behavior-facing quality constraints needed to understand the FR.
6. **Name the AD Ports edge.** Record whether tenancy, Arabic/RTL, data residency, NESA/PDPL, vessel/customs operations, SAP/Oracle windows, or maritime SLAs apply.
7. **Keep ownership visible.** Name downstream roles when the artifact leaves this skill.
8. **Evidence beats assertion.** Link source material, review notes, test IDs, examples, or open questions rather than claiming requirements were validated.
9. **Start from the bundled template.** Use `templates/fr-template.md.tmpl`; if it does not fit, record the deviation.
10. **Ask before generating.** Before producing the FR document, ask blocking open questions about scope, actors, behavior, business rules, acceptance, traceability, and ownership; unanswered blockers must be recorded as assumptions, risks, or deferred open questions.
11. **Use scope reference IDs.** Record in-scope and out-of-scope items in the Section 2 scope table with stable IDs such as `SCOPE-IN-001` and `SCOPE-OUT-001`; do not use untraceable free-text scope bullets.
12. **Create one FR package folder per requirement.** Every FR must have a dedicated folder at `docs/02-product/FR/fr-<nnn>/`. The folder must contain `fr-<nnn>-description.md` for FR details and acceptance criteria; `fr-<nnn>-test-cases.md` for PM-owned draft test cases; `sequence.mmd` for the Mermaid source; `sequence.drawio` for the editable rendered companion when a diagram is required; and `fr-<nnn>-lld.md` for the FR-level LLD handoff. The root `docs/02-product/FR/functional-requirements.md` stays as the index, readiness gate, scope, summary, traceability, routed items, and cross-FR evidence.
13. **Embed and link a sequence diagram for every FR package.** Every FR package description file must include or link the Mermaid `sequenceDiagram` immediately after acceptance criteria. Use `sequence.mmd` as the source of truth and create `sequence.drawio` from `templates/fr-sequence-drawio-template.drawio.tmpl` when the behavior has multiple actors/systems, integrations, audit/security flow, exports, reports, handoffs, or material exception paths; otherwise explicitly record `Not required - single-step behavior` in both the description file and the index summary.
14. **Render Draw.io companions from the Mermaid source.** When a sequence diagram is required, create one companion `.drawio` file per FR package under `docs/02-product/FR/fr-<nnn>/sequence.drawio`. The final Draw.io companion must match `sequence.mmd`: same participants, same message order, same happy/alternate/error paths, same audit/evidence interactions, and same outputs. Prefer embedding the rendered Mermaid sequence as an SVG data URI in the `mxCell` with `id="mermaid-render"`. If Mermaid rendering is unavailable, build an editable native Draw.io sequence diagram with participant headers, dashed lifelines, ordered message arrows, return arrows, `alt`/`opt` combined-fragment boxes, branch separators, audit interactions, and output messages. Do not ship fixed generic lanes, summary-only note boxes, prose-only SVGs, unresolved template placeholders, or a manually reconstructed diagram that is harder to read than the Mermaid source.
15. **Generate Mermaid-safe diagram text.** Mermaid labels and sequence messages must avoid semicolons, raw pipes, unmatched brackets or quotes, and HTML-like angle brackets. Use ` - `, `,`, or words such as `and` instead of `;`, especially in `sequenceDiagram` messages because some renderers parse `;` as a statement separator. Quote participant labels when labels contain punctuation, slashes, parentheses, or leading punctuation such as `.NET`.
16. **Link traceable items and outputs.** Render traceability IDs and output references as Markdown links wherever possible: link FR IDs to their package `fr-<nnn>-description.md`, link AC IDs to anchors inside the description file, link test case IDs to anchors inside `fr-<nnn>-test-cases.md`, link `sequence.mmd`, `sequence.drawio`, and `fr-<nnn>-lld.md` from the index, and link upstream/downstream items, reports, exports, notifications, audit evidence, and test targets to their source artifact paths. If a target file or anchor is unknown, keep the ID visible and record the missing link as an evidence gap.
17. **Gate delivery readiness explicitly.** Every FR must state readiness status, blocker/dependency state, backlog/story link, test readiness, and what prevents delivery. `Ready for delivery` and `Approved` FRs must have an actual backlog/story link and test/validation target; do not use `FR-Q-*` blocker IDs as the only Story / Backlog value for delivery-ready requirements.
18. **Make policy, data, report, and privacy dependencies visible.** Use the FR package description file's report/export and sensitive-data tables when the FR creates reports, exports, audit evidence, regulated data handling, or privacy/security-heavy behavior; otherwise state `Not applicable` with rationale.
19. **Generate draft test cases from acceptance criteria.** Every FR package must include `fr-<nnn>-test-cases.md` from `templates/fr-test-cases-template.md.tmpl`. The file must map each acceptance criterion to at least one test case ID, test type, priority, preconditions, steps, expected result, data needs, automation suitability, and owner. For UI-capable cases, include a Playwright artifact handoff path under `output/playwright/fr-<nnn>/` so the `playwright` skill can read or place execution artifacts later. These are PM-owned test case drafts for traceability and QA planning; final test design, automation, execution, and evidence remain owned by `ai-quality-engineer`.
20. **Keep the FR-level LLD colocated but role-owned.** Every FR package must include `fr-<nnn>-lld.md` using `templates/fr-lld-template.md.tmpl` as an architecture handoff stub or completed FR-level LLD. The FR skill may seed trace links, constraints, contracts, and open architecture questions, but design decisions require `ai-solution-architect` / `adp-arch-lld` review before implementation.

## Pitfalls

- **Solution design as requirement:** The FR package description file dictates database tables, frameworks, or UI layout instead of observable behavior; put implementation design in the package `fr-<nnn>-lld.md` and route it to `adp-arch-lld`.
- **Ambiguous verbs:** "Manage", "support", "handle", or "improve" appear without actor, trigger, outcome, and acceptance evidence.
- **Hidden exceptions:** Error, permission, duplicate, partial, offline, or integration-failure paths are absent.
- **Mixed ownership:** NFRs, UX design, architecture decisions, or implementation tasks are folded into the FR artifact.
- **No traceability:** Requirements cannot be mapped back to a business need or forward to tests.
- **ACs without test cases:** Acceptance criteria exist, but `fr-<nnn>-test-cases.md` is missing or QA has to infer test cases, data needs, priority, or automation fit from prose.
- **Flat or scattered FR artifacts:** Details, test cases, sequence diagrams, and LLD notes are spread across unrelated folders instead of living in the FR package.
- **Low-quality Draw.io companion:** The `.drawio` file hand-rebuilds a weaker sequence, uses canned actors, cramped labels, uneven spacing, summary cards, prose-only SVGs, or unresolved placeholders instead of matching `sequence.mmd` as a clean rendered Mermaid image or editable native sequence diagram.
- **False delivery readiness:** A `Must` requirement appears ready while policy, legal, backlog/story, data source, or test evidence dependencies are unresolved.

## Evidence expectations

- **Minimum evidence:** source request, upstream artifact paths, FR IDs changed, assumptions, open questions, and downstream role.
- **When docs are touched:** include source artifacts reviewed, standards used, and reviewer or approver expected next.
- **When risk is found:** record owner, severity, mitigation, and whether delivery can proceed.
- **When using adp-pm-fr:** finish with files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before producing `docs/02-product/FR/functional-requirements.md`:** confirm this is behavior scope and not PRD summary, NFR, UX design, architecture, or implementation.
- **Before generating content:** ask the blocking open questions, or record why each unanswered item can be carried forward safely.
- **Before accepting a requirement:** confirm it is testable and traceable.
- **Before routing onward:** confirm the next role has clear FR IDs, acceptance criteria, and open questions.
- **Before accepting missing input:** record whether the gap blocks work, creates risk, or can be carried as an assumption.

## Escalation triggers

- **Business-rule uncertainty:** involve `ai-business-analyst`.
- **NFR or architectural uncertainty:** involve `ai-solution-architect`.
- **Security or privacy uncertainty:** involve `ai-security-engineer`.
- **Flow or usability uncertainty:** involve `ai-ux-ui-designer`.
- **Testability uncertainty:** involve `ai-quality-engineer`.
- **Ownership uncertainty:** involve `ai-governance-lead`.

## When to use
Trigger this skill when:
- A new `docs/02-product/FR/functional-requirements.md` is required.
- Existing functional requirements must be updated due to BRD, PRD, feedback, defect, or scope change.
- A team asks to define FRs, system behavior, business rules, acceptance criteria, inputs/outputs, flows, validations, exceptions, or traceability.
- A team asks to generate test case drafts from functional requirements or acceptance criteria.
- FRs need to be separated from NFRs or implementation tasks.

Do not use this skill for NFR-only work, backlog ranking, UX screen design, architecture decisions, implementation, or test execution. Route those to their owning skills.

## Inputs
- Approved or draft BRD, PRD, backlog item, support ticket, stakeholder note, incident, or regulation/business rule.
- Known personas, actors, business rules, data inputs/outputs, integration dependencies, and constraints.
- Existing story files or test references where available.

## Outputs
- `docs/02-product/FR/functional-requirements.md`
- One FR package folder per requirement under `docs/02-product/FR/fr-<nnn>/`.
- FR package `fr-<nnn>-description.md` files containing details, acceptance criteria, report/export notes, sensitive-data notes, evidence, and handoff.
- FR package `fr-<nnn>-test-cases.md` files containing draft test cases, test data needs, automation suitability, and QA handoff.
- `sequence.mmd` plus editable `sequence.drawio` companion files inside each FR package for FRs that need diagrams, or an explicit `Not required - single-step behavior` statement.
- FR-level `fr-<nnn>-lld.md` files inside each FR package, seeded for `ai-solution-architect` / `adp-arch-lld` completion or review.
- FR-to-BR/PRD/story/test traceability table.
- Acceptance criteria and evidence placeholders.
- Draft test case matrix generated from FR acceptance criteria for QA planning and delivery traceability.
- Handoff note to downstream roles when relevant.

## Artifact path routing

When this skill creates or updates documentation artifacts, resolve the target path through `/standards/artifact-path-routing.md` before writing files. Write documentation output relative to the target repository root, using the numbered SDLC folders under `docs/`.

## Workflows

Load only the workflow file that matches the current request:

- `workflows/produce-artifact.md`
- `workflows/review-artifact.md`
- `workflows/update-artifact.md`

## References

Load only when the request needs detailed guidance:

- `references/guidance.md` - FR writing rules, routing boundaries, and quality checks.

## Templates

Use these bundled templates when the request produces or updates the primary artifact:

- `templates/fr-template.md.tmpl` - Functional Requirements.
- `templates/fr-record-template.md.tmpl` - Per-FR package description.
- `templates/fr-test-cases-template.md.tmpl` - Per-FR draft test cases.
- `templates/fr-sequence-template.mmd.tmpl` - Per-FR Mermaid sequence source.
- `templates/fr-lld-template.md.tmpl` - Per-FR LLD handoff.
- `templates/fr-sequence-drawio-template.drawio.tmpl` - Editable FR sequence companion diagram.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/prd.md`
- `/standards/definition-of-done.md`

## Autonomous SDLC contract

- **SDLC stage:** Product definition
- **Ordered by:** `ai-business-analyst`, `ai-product-manager`, `ai-support-analyst`
- **Required inputs:** `docs/01-discovery/brd.md` or validated business need, product scope, actors, business rules, and constraints
- **Generated artifact:** `docs/02-product/FR/functional-requirements.md`
- **Next roles:** `ai-solution-architect`, `ai-ux-ui-designer`, `ai-quality-engineer`, `ai-delivery-planner`, delivery engineers
- **Human gate:** functional scope and acceptance approval

## Handoff

- **Upstream:** Confirm source request, evidence, and approved upstream artifacts before acting.
- **Downstream:** `ai-solution-architect`, `ai-ux-ui-designer`, `ai-quality-engineer`, `ai-delivery-planner`, implementation role.
- **Evidence:** Summarize changed FR IDs, key decisions, assumptions, open questions, risks, and validation evidence.

## Ownership

- **Primary owner:** `ai-product-manager` (AI Product Manager)
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-06-29

## Quality bar
- Each FR is atomic, uniquely identified, traceable, testable, and acceptance-backed.
- Traceable items and output references are Markdown links to source artifacts, same-document FR/AC/rule/output sections, backlog items, test targets, evidence, or recorded evidence gaps.
- Every FR carries an explicit readiness status: Draft, Blocked, Ready for review, Ready for delivery, or Approved.
- Delivery-ready and approved FRs have real backlog/story and test/validation links, not only blocker/open-question IDs.
- Every FR has a dedicated package folder at `docs/02-product/FR/fr-<nnn>/` containing `fr-<nnn>-description.md`, `fr-<nnn>-test-cases.md`, `sequence.mmd`, `sequence.drawio` when required, and `fr-<nnn>-lld.md`.
- Every FR package description file includes complete details, acceptance criteria, evidence, and handoff links.
- Every FR package test case file includes draft test cases mapped to acceptance criteria with ID, type, priority, preconditions, steps, expected result, test data, automation suitability, and owner.
- UI-capable test cases include a Playwright artifact handoff path under `output/playwright/fr-<nnn>/`; they do not embed Playwright CLI command flows unless explicitly requested.
- Every FR package includes an embedded or linked Mermaid sequence diagram and Draw.io companion file, or explicitly states `Not required - single-step behavior`.
- Mermaid diagrams use parser-safe text: no semicolons in sequence messages, no raw pipes, balanced brackets/quotes, and quoted participant labels when labels contain punctuation.
- Draw.io companions embed the rendered Mermaid sequence as an SVG data URI in the `mermaid-render` image cell or provide an editable native Draw.io sequence diagram with lifelines, message arrows, returns, branches, audit interactions, and outputs that fully match `sequence.mmd`.
- Every FR-level `fr-<nnn>-lld.md` is present and clearly marked `Draft`, `Ready for architecture review`, or `Approved by architecture`.
- Every FR includes a separate `fr-<nnn>-test-cases.md` with draft test cases mapped to acceptance criteria; each test case has ID, type, priority, preconditions, steps, expected result, test data, automation suitability, and owner.
- FR/NFR/UX/architecture/implementation boundaries are explicit.
- AD Ports operational and regulatory edges are checked.
- Stored at `docs/02-product/FR/functional-requirements.md` unless an explicit path exception is recorded.

## Tier guidance
Per the AI Role Skills Tier Application Guide:
- Tier 1: include this skill only if its trigger fires.
- Tier 2: include if listed as baseline or its trigger fires.
- Tier 3: included by default if listed in the enterprise baseline.
