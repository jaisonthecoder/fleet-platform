# Workflow: Record Architecture Decisions


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (PRD, ACs, design, data, access, credentials — whichever apply).
- [ ] You know **who the output is for** (which downstream role or stakeholder consumes it).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Decisions captured in a way that survives team changes and explains "why" years later.

## Steps
1. **Use the standard template.** `/standards/adr.md`.
2. **Trigger an ADR for:** technology choice, architectural pattern, significant trade-off, deprecation, security control, contract decision.
3. **Write within 48h** of the decision while context is fresh.
4. **Number sequentially.** `docs/adr/0001-...md`, `0002-...md`. Never renumber.
5. **Status lifecycle.** Proposed → Accepted → (Superseded by ADR-N).
6. **Options matter.** At least 2 alternatives, each with pros/cons. "We picked X because nothing else was considered" is a smell.
7. **Link from the design doc** and from the code (top of relevant module's README).
8. **Review:** at least one other senior engineer + Security if relevant.

## Anti-patterns
- ADRs written months after the decision.
- "We picked X because it's the best." (Not an argument.)
- ADR with one option.
- Status stuck on "Proposed" for years.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The artifact is saved at its documented path and committed (or linked from the ticket/board).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): `platform-sre`, `security-engineer`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Within 48h of decision
- [ ] Template followed
- [ ] ≥2 options documented
- [ ] Reviewed + accepted
- [ ] Linked from design doc + code
