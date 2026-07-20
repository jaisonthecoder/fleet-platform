# Produce Functional Requirements

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Check the applicable shared standards: `/standards/prd.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Confirm the requested output is functional behavior owned by `ai-product-manager`.
- Identify upstream evidence: BRD, PRD, backlog item, stakeholder note, defect, incident, or business rule.
- Before generating the document, list the open questions that affect functional scope, behavior, acceptance, traceability, or ownership.
- Treat every unresolved `TBD` needed for useful FR generation as a question to ask before writing. If the requester cannot answer, carry it explicitly as an assumption, risk, blocker, or deferred open question with an owner and needed-by date.
- Ask the requester the blocking open questions first. Continue only after answers are provided, or explicitly record why each unanswered item can be carried as an assumption or risk.
- Primary artifact: `docs/02-product/FR/functional-requirements.md`.
- Per-FR package path pattern: `docs/02-product/FR/fr-<nnn>/`.

## Goal

Produce a traceable, testable functional requirements index plus one folder package per FR. Each package gives architecture, UX, QA, planning, and implementation roles the details, acceptance criteria, sequence, FR-level LLD handoff, and draft test cases needed to proceed.

## Steps

1. Confirm scope and source evidence.
2. Run the clarification and readiness gate:
   - Identify missing actors, triggers, preconditions, inputs, outputs, business rules, exception paths, priorities, source traces, backlog/story links, user story statements, story objectives, story acceptance criteria, test owners, test data needs, security/legal policy owners, data source owners, and approval owners.
   - Convert would-be `TBD` placeholders into concise questions for the requester before generation.
   - Ask only the open questions that block useful FR generation.
   - If the requester cannot answer, record each item as an assumption, risk, or deferred open question before generating the document.
3. Populate the Delivery Readiness Gate near the top of the artifact with backlog/ticket, sponsor/owner, security/legal policy, test owner, and ready-for-delivery status.
4. Populate Section 2 scope as a table with `SCOPE-IN-*` and `SCOPE-OUT-*` reference IDs, source trace links, related FR or business-rule links, and notes for each boundary.
5. Identify actors, triggers, preconditions, inputs, outputs, state transitions, validations, and exception paths.
6. Create stable FR IDs (`FR-001`, `FR-002`) and do not renumber existing requirements.
7. Create one package folder for each FR at `docs/02-product/FR/fr-<nnn>/`.
   - Create `fr-<nnn>-description.md` from `templates/fr-record-template.md.tmpl`.
   - Create `fr-<nnn>-test-cases.md` from `templates/fr-test-cases-template.md.tmpl`.
   - Create `sequence.mmd` from `templates/fr-sequence-template.mmd.tmpl` with Mermaid `sequenceDiagram` source, or record `Not required - single-step behavior` when no diagram is required.
   - Create `sequence.drawio` from `templates/fr-sequence-drawio-template.drawio.tmpl` when the sequence diagram is required.
   - Create `fr-<nnn>-lld.md` from `templates/fr-lld-template.md.tmpl`; seed it with trace links, constraints, open architecture questions, and status, then route architecture decisions to `ai-solution-architect` / `adp-arch-lld`.
8. Write each FR package description file as observable behavior with merged user story context, acceptance criteria, report/export notes, sensitive-data notes, evidence placeholders, and handoff.
   - Populate the User Story Context section from the linked story or backlog item: `As a / I want / So that`, feature objective, user or business value, primary scenario, story-derived constraints, and story-derived acceptance focus.
   - Translate story acceptance criteria into FR acceptance criteria where they describe functional behavior; keep the story as trace evidence, but do not leave feature description only in the story file.
   - If no user story exists, record `Not available - evidence gap recorded` in the story source and add an assumption, blocker, or open question in the index.
9. Populate each FR package readiness block: readiness status, blocking dependencies, policy/legal dependency, data source dependency, backlog/story link, test readiness, and `Cannot proceed until`.
10. For report/export FRs, populate the FR package report/export definition table with name, fields, filters, format, permission, audit rule, and evidence/test target. For privacy/security-heavy FRs, populate the FR package sensitive data handling table with data type, capture/storage allowance, retention, deletion, access roles, audit, and policy owner.
11. For every FR package, add or link the sequence diagram directly below the FR acceptance criteria in `fr-<nnn>-description.md`. Use `sequence.mmd` as the MermaidJS `sequenceDiagram` source and create the editable Draw.io companion file `docs/02-product/FR/fr-<nnn>/sequence.drawio` from `templates/fr-sequence-drawio-template.drawio.tmpl` when the behavior is multi-actor/system, integration-heavy, audit/security-relevant, report/export/handoff-oriented, or has material exception paths. Prefer rendering the Mermaid source to SVG and embedding it in the template's `mermaid-render` image cell. If rendering is unavailable, create an editable native Draw.io sequence diagram with participant headers, dashed lifelines, ordered message arrows, return arrows, `alt`/`opt` branch boxes, branch separators, audit interactions, outputs, and exception paths. The final Draw.io file must match `sequence.mmd` and must not contain note-box-only summaries, prose-only SVGs, cramped hand-built layouts, generic actors, or unresolved `{{...}}` placeholders. For simple single-step behavior, keep the sequence section and record `Not required - single-step behavior`.
   - Sanitize Mermaid sequence text before finalizing: do not use semicolons in message text, raw pipes, HTML-like angle brackets, or unmatched brackets/quotes. Use ` - ` or `,` instead of `;`, and quote participant labels that contain punctuation, slashes, parentheses, or leading punctuation.
12. Generate draft test cases in each FR package `fr-<nnn>-test-cases.md` from the acceptance criteria:
   - Create stable IDs such as `TC-FR-001-001`.
   - Cover happy path, edge/alternate path, and error/permission/exception path for each `Must` FR unless explicitly justified.
   - Include test type, priority, preconditions, steps, expected result, test data/fixtures, automation suitability, and owner.
   - For UI-capable cases, include a Playwright artifact handoff path under `output/playwright/fr-<nnn>/` so the `playwright` skill can read or write execution artifacts later. Do not embed Playwright CLI command flows unless explicitly requested.
   - Keep them as PM-owned QA-planning drafts; route final test design, automation, execution, and evidence to `ai-quality-engineer`.
13. Populate `docs/02-product/FR/functional-requirements.md` as the index: delivery readiness gate, scope, AD Ports checks, FR summary table, package links, traceability, routed items, assumptions/risks/open questions, change log, evidence, and handoff.
14. Add traceability from BRD/PRD/story to FR package, from FR to AC anchors, from AC to draft test cases in `fr-<nnn>-test-cases.md`, from FR to `sequence.mmd`, `sequence.drawio`, `fr-<nnn>-lld.md`, and validation targets. Render traceability IDs and output references as Markdown links to same-document anchors or relative artifact paths; if a link target is unknown, keep the ID visible and record the missing target as an evidence gap. Do not mark an FR `Ready for delivery` or `Approved` when its only story/backlog trace is an `FR-Q-*` blocker, open question, or `TBD`.
15. Separate NFRs, UX design decisions, architecture decisions, implementation tasks, and final QA execution into routing notes. Architecture decisions belong in the FR package `fr-<nnn>-lld.md` and require `adp-arch-lld` review before implementation.
16. Record AD Ports checks: tenancy, Arabic/RTL, data residency, NESA/PDPL, operational windows, vessel/customs, SAP/Oracle, and maritime SLA impact.
17. Prepare a handoff naming the downstream roles and open questions.

## Anti-patterns

- Writing broad capabilities such as "manage users" without actor, trigger, behavior, outcome, and exception paths.
- Linking a user story or backlog item without merging the story statement, objective, user value, scenario context, and relevant story acceptance criteria into the FR package description.
- Embedding performance, availability, resilience, or security-control targets that belong in `adp-arch-nfr`.
- Designing screens, APIs, database tables, or technical implementation inside the FR package description instead of routing architecture content to the package `fr-<nnn>-lld.md`.
- Creating FRs that do not trace to business value or cannot be tested.
- Creating acceptance criteria without a separate `fr-<nnn>-test-cases.md` file containing draft test cases, test data needs, or automation-suitability notes.
- Creating a flat `fr-<nnn>-sequence.drawio` outside the FR package folder instead of colocating `fr-<nnn>-description.md`, `fr-<nnn>-test-cases.md`, `sequence.mmd`, `sequence.drawio`, and `fr-<nnn>-lld.md`.
- Creating a Draw.io companion as a summary/prose image or low-quality generic lane diagram instead of matching `sequence.mmd` as rendered Mermaid or an editable native sequence diagram.
- Generating the FR document before asking scope-blocking open questions.
- Marking an FR `Ready for delivery` while backlog/story, policy/legal, data source, or test readiness still depends on an unresolved blocker.
- Leaving `TBD` in an approved or ready-for-delivery artifact outside the assumptions, risks, open questions, or deferred scope tables.

## After you finish

- [ ] `docs/02-product/FR/functional-requirements.md` exists or the explicit alternate target path is recorded.
- [ ] Every FR has a package folder at `docs/02-product/FR/fr-<nnn>/`.
- [ ] Every FR package contains `fr-<nnn>-description.md`, `fr-<nnn>-test-cases.md`, `sequence.mmd`, `sequence.drawio` when required, and `fr-<nnn>-lld.md`.
- [ ] The Delivery Readiness Gate is populated with backlog/ticket, sponsor/owner, security/legal policy, test owner, and ready-for-delivery status.
- [ ] Section 2 scope uses the table format with `SCOPE-IN-*` and `SCOPE-OUT-*` reference IDs.
- [ ] Each FR package description file has stable ID, source trace, actor, trigger, behavior, outcome, exceptions, acceptance criteria, priority, owner, readiness status, blocker/dependency state, backlog/story link, and test readiness.
- [ ] Each FR package description file includes User Story Context populated from the story/backlog evidence, or an explicit evidence gap/blocker when no story exists.
- [ ] Each FR package has `fr-<nnn>-test-cases.md` with draft test cases mapped to acceptance criteria, with test type, priority, preconditions, steps, expected result, test data, automation suitability, and owner.
- [ ] UI-capable draft test cases include Playwright artifact paths under `output/playwright/fr-<nnn>/` without embedding Playwright CLI command flows by default.
- [ ] Report/export and sensitive-data tables are populated when applicable, or explicitly marked `Not applicable` with rationale.
- [ ] No `Ready for delivery` or `Approved` FR uses only `FR-Q-*`, an open question, or `TBD` for its story/backlog or test target.
- [ ] Traceable IDs and output references are Markdown links to FR package description, AC anchors, business-rule, source, backlog, output, report/export, notification, audit, `fr-<nnn>-test-cases.md` draft test cases, sequence, Draw.io, LLD, evidence, or validation targets when targets exist.
- [ ] Every FR package includes a sequence diagram block with embedded or linked Mermaid and a Draw.io companion file under `docs/02-product/FR/fr-<nnn>/`, or explicitly states `Not required - single-step behavior`.
- [ ] Every FR package includes `fr-<nnn>-lld.md` with status, scope, trace links, contract notes, data/integration/security considerations, open architecture questions, and architecture review owner.
- [ ] Every Mermaid sequence uses parser-safe text: no semicolons in message text, no raw pipes, balanced brackets/quotes, and quoted labels for participants with punctuation.
- [ ] Every Draw.io companion either embeds its FR package's rendered Mermaid SVG in the `mermaid-render` image cell or uses editable native Draw.io sequence shapes with lifelines, messages, returns, branches, audit interactions, and outputs that match `sequence.mmd`.
- [ ] Blocking open questions were asked before generation, or explicitly carried as assumptions, risks, or deferred open questions.
- [ ] No unresolved `TBD` remains outside explicit assumptions, risks, blockers, deferred scope, or evidence gaps.
- [ ] FR/NFR/UX/architecture/implementation routing boundaries are explicit.
- [ ] AD Ports checks are recorded.
- [ ] Downstream roles are named: `ai-solution-architect`, `ai-ux-ui-designer`, `ai-quality-engineer`, `ai-delivery-planner`, and implementation role.
- [ ] Run `git status` and confirm only intended files changed.

## Definition of Done

- [ ] Every FR is atomic, observable, and testable.
- [ ] Every acceptance criterion maps to at least one draft test case or a documented QA-planning exception.
- [ ] Draft test cases live in each FR package `fr-<nnn>-test-cases.md`, not only inside the description file.
- [ ] Every FR traces through clickable source, acceptance, output, story/backlog, and test/evidence links where targets exist.
- [ ] Every delivery-ready FR has actual backlog/story and test/validation links, with no unresolved policy/legal/data blockers.
- [ ] Sequence diagram blocks appear directly below each FR package's acceptance criteria and use stable, polished Draw.io files in the same FR package folder that embed the rendered Mermaid SVG when a diagram is required.
- [ ] FR-level `fr-<nnn>-lld.md` files are present and clearly marked `Draft`, `Ready for architecture review`, or `Approved by architecture`.
- [ ] Mermaid diagrams parse cleanly in MermaidJS before the artifact is marked ready.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] The artifact can be reviewed without chat history.
