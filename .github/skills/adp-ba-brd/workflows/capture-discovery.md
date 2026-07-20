# Workflow: Capture Discovery Session Notes


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (source request, sponsor context, attendee list, session objective, existing notes/transcript, business constraints - whichever apply).
- [ ] You know **who the output is for** (`ai-business-analyst`, `ai-product-manager`, sponsor, or another named stakeholder).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] If writing to a repository, you are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Produce structured, reusable notes from a stakeholder interview or workshop.

## Steps

1. **Pre-session.** Confirm: attendees, objective, 3–5 prepared questions, timebox.

2. **Structure notes under these headings** (use `../templates/discovery-notes-template.md`):
   - Context: who, when, why
   - Current state: how things work today, pain points, workarounds
   - Desired state: what "better" looks like in the stakeholder's words
   - Constraints: regulatory, organizational, technical
   - Open questions: anything you couldn't answer in-session
   - Action items: owner + due date

3. **Quote directly where possible.** Exact stakeholder wording is evidence. Paraphrasing loses nuance.

4. **Separate facts from interpretations.** Tag your own analysis as `[BA note]`.

5. **Circulate within 24h** for stakeholders to correct.

## Anti-patterns

- Jumping to solutions in the notes. Capture the problem space first.
- Compressing multiple stakeholders into one voice — note disagreements.

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
- [ ] Notes follow the discovery template (Context, Current state, Desired state, Constraints, Open questions, Action items)
- [ ] Direct quotes captured for at least the key pain points
- [ ] Facts vs `[BA note]` interpretations clearly separated
- [ ] Action items have owner + due date
- [ ] Circulated to attendees within 24 hours for correction
- [ ] Notes committed at the agreed path and linked from the intake ticket
