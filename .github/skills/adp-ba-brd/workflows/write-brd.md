# Workflow: Write a Business Requirements Document (BRD)


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (`docs/01-discovery/demand-intake.md`, sponsor notes, stakeholder interviews, business constraints, telemetry/support evidence - whichever apply).
- [ ] You know **who the output is for** (`ai-product-manager`, `ai-solution-architect`, sponsor, or another named stakeholder).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] If writing to a repository, you are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Produce a BRD that a sponsor can sign off on and downstream FR/NFR owners can trace. The document must follow `../templates/brd-template.md.tmpl` exactly. Use BABOK v3 practice as the analysis method, then fit the content into the approved template without adding, renaming, removing, or reordering sections.

## Steps

1. **Start from the approved template.** Copy `../templates/brd-template.md.tmpl` as the draft structure before filling content. Preserve heading text, heading order, table columns, optional document-control block, annexes, and placeholder style. Do not add standalone sections such as AD Ports checks, PM handoff readiness, ISO supplements, evidence logs, template deviation logs, or approvals unless the user explicitly updates the template.

2. **Analyze the current state** (BABOK: Strategy Analysis — Analyze Current State). Capture into sections 1 and 2 (ask if missing):
   - Sponsoring business unit and named sponsor
   - Problem statement in one sentence
   - Current pain (quantified) and root causes
   - Why now — what changed to make this urgent
   - Drivers for Change (`DR-###` rows with source/evidence)
   - User and stakeholder scope

3. **Define the future state and business objectives** (BABOK: Define Future State). Describe the desired to-be condition in business terms and list the objectives it serves in sections 2.1 and 3. Every objective must map to at least one success metric ID.

4. **Define success metrics.** For each metric, capture linked objective, metric, baseline, target, timeframe, and owner using the exact section 2.1.2 table. If a baseline or source is missing, mark it `TBD` and list the gap as an open question.

5. **Set the solution scope** (BABOK: Define Change Strategy). State explicitly what is in scope, out of scope, release scope, and user/stakeholder scope using section 2.2. Out-of-scope items prevent downstream scope drift.

6. **Analyze stakeholders** (BABOK: Plan Stakeholder Engagement). Capture sponsor, users, approvers, informed parties, downstream product owner/PM, operations owner, and any cross-entity owner inside the approved template sections only, primarily document control, user/stakeholder scope, future process owner, dependencies, risks, open questions, and handoff notes.

7. **Elicit and classify requirements** (BABOK requirement classification scheme). Record each requirement in its own class inside section 4; do not blend them:
   - **Business requirements (`BR-###`):** "The business needs to ..." — outcome, impacted process/persona, rationale, source, MoSCoW priority.
   - **Stakeholder requirements (`SR-###`):** needs of a specific stakeholder group, each linked to one or more BR IDs.
   - **Transition requirements (`TR-###`):** migration, training, cutover, parallel-run, or decommission needs, each linked to BR IDs.
   - **Solution requirements (functional and non-functional) belong to downstream FR/NFR artifacts** — capture only handoff signals in section 7.2, not as BRD rows.

8. **Identify business rules, policies, constraints, assumptions, and dependencies.** Capture business rules in section 3.3 and assumptions, constraints, and dependencies in section 5. Include budget, timeline, regulatory (UAE PDPL, NESA, AD Ports security), organizational, operational windows, customs cut-offs, terminal constraints, and external dependency limits where applicable.

9. **Assess risks and open questions** (BABOK: Assess Risks). Capture each risk with likelihood, impact, mitigation, and owner in section 6.1. Capture unresolved questions with owner, needed-by date, and impact in section 6.2.

10. **Build traceability and handoff.** Complete section 7.1 with Driver ID, Objective ID, BR ID, SR/TR ID, and downstream FR/NFR placeholder. Complete section 7.2 with FR/NFR handoff notes only; do not create PM readiness, evidence, approval, or deviation sections.

11. **Build the glossary and references.** Define business terms a downstream reader could misread in Annex A, reusing the domain ubiquitous language where it exists. List the demand intake, interview notes, operational evidence, policy/regulation, telemetry/report, or other source material as `REF-###` rows in Annex B; use `TBD` when a required source is missing and carry the gap into open questions.

12. **Handle ISO/IEC/IEEE 29148 only as an explicit exception.** Do not add an ISO/BRS supplement by default. If the sponsor, a regulator, or `ai-solution-architect` explicitly requests ISO 29148 BRS conformance, ask whether the approved template should be changed before adding any new sections.

13. **Draft using the canonical template.** Use `../templates/brd-template.md.tmpl` exactly. Preserve heading text, heading order, table columns, status labels, and deterministic IDs. Fill unknown required facts as `TBD`; do not omit, rename, merge, reorder, or append sections.

14. **Review checklist** before handoff:
   - [ ] The BRD heading text, heading order, and table columns match `../templates/brd-template.md.tmpl`
   - [ ] No unapproved sections were added
   - [ ] Every requirement has a source/driver
   - [ ] Every requirement sits in the right class: BR (business outcome), SR (stakeholder need linked to BRs), TR (transition need linked to BRs)
   - [ ] No solution requirements (functional specs, UI, APIs) appear as BRD requirement rows
   - [ ] Every business objective maps to at least one metric ID
   - [ ] Success metrics are measurable (not "improve user experience")
   - [ ] Open questions have owner, needed-by date, and impact if unanswered
   - [ ] In-scope and out-of-scope are explicit
   - [ ] ISO/IEC/IEEE 29148 supplement was not added unless explicitly requested and approved as a template exception
   - [ ] Section 7 traceability and handoff notes are complete enough for downstream FR/NFR work
   - [ ] Sponsor's name is on it

## Anti-patterns

- Writing requirements as features ("Add a button that ..."). BRs describe outcomes, not UI.
- Merging multiple requirements into one sentence connected by "and".
- Blending requirement classes — stakeholder or transition needs hidden inside BR rows, or solution design written as requirements.
- Success metrics that can't be measured from data the business already has.
- Handing downstream roles a business narrative with no driver/objective/BR/SR/TR traceability, metric mapping, or open-question owners.
- Treating ISO/IEC/IEEE 29148 BRS supplement content as a default BRD completion gate.
- Replacing the approved BRD template with a narrative, generated, standards-derived, or older 23-section structure.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The artifact is saved at its documented path and committed (or linked from the ticket/board).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): `ai-product-manager`, `ai-solution-architect`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

If you changed repository files, run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Sponsor named and signed off
- [ ] Approved BRD template structure preserved exactly
- [ ] Requirements classified per BABOK: BR, SR, and TR rows each with ID, source/driver, and MoSCoW priority
- [ ] Every SR and TR row links to at least one BR ID
- [ ] Every business objective maps to at least one success metric
- [ ] Success metrics include the exact template columns: linked objective, metric, baseline, target, timeframe, and owner
- [ ] In-scope, out-of-scope, constraints, assumptions, open questions, and dependencies are explicit
- [ ] ISO/IEC/IEEE 29148 supplement not added unless explicitly requested and approved as a template exception
- [ ] Section 7 maps driver IDs, objective IDs, BR IDs, SR/TR IDs, and downstream FR/NFR placeholders
- [ ] No solution design has leaked into the BRD
- [ ] BRD committed at its documented path and linked from the intake ticket
