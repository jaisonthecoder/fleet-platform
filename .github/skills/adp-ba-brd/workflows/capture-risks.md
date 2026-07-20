# Workflow: Capture Business-Side Risks


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (`docs/01-discovery/demand-intake.md`, draft/existing `docs/01-discovery/brd.md`, discovery notes, business constraints, operational constraints, stakeholder risk notes - whichever apply).
- [ ] You know **who the output is for** (`ai-business-analyst`, `ai-product-manager`, `ai-solution-architect`, sponsor, or another named stakeholder).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] If writing to a repository, you are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Identify and log risks that could block or reduce the business value of the initiative.

## Steps

1. **Risk categories to probe:**
   - Regulatory / compliance (UAE NESA, data residency, customs, maritime)
   - Operational (vessel ops, terminal ops, customer SLAs)
   - Organizational (change adoption, training, union/labour)
   - Commercial (contract terms, SLA penalties, revenue recognition)
   - Dependency (external system, vendor, approval body)

2. **For each risk, log:**
   - ID, title, description
   - Probability (Low / Med / High) with rationale
   - Impact (Low / Med / High) with rationale
   - Mitigation (what we'll do proactively)
   - Contingency (what we'll do if it materializes)
   - Owner
   - Trigger (the observable event that escalates the risk)

3. **Score and rank.** Probability × impact. Surface the top 5 to the sponsor.

4. **Review cadence.** Risks decay — set a review date on every entry.

## Anti-patterns

- "Risk: project may fail." Not actionable. Decompose into specific failure modes.
- Mitigations that are really the project itself ("we'll build it carefully").
- Risks with no owner.

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
- [ ] Risks cover all five categories (regulatory, operational, organizational, commercial, dependency) or "none" justified per category
- [ ] Each risk has ID, probability + impact with rationale, mitigation, contingency, owner, and trigger
- [ ] Top 5 risks ranked and surfaced to the sponsor
- [ ] Review date set on every risk
- [ ] Risk register committed and linked from the BRD / intake ticket
