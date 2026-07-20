# Workflow: Prepare Discovery Handoff


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/brd.md`, `/standards/definition-of-done.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] Outputs from `frame-business-request`, `size-business-value`, and `capture-sponsor-constraints` are complete.
- [ ] A **Business Analyst** with available capacity has been identified.
- [ ] The **target destination** for the intake brief is decided (intake board, shared doc, ticket).

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
A clean handoff that lets the BA start without re-doing intake.

## Steps
1. **Package the intake brief.** One page: ask, sponsor, why-now, outcomes, T-shirt value, constraints, open questions.
2. **Assign the BA.** Named person, capacity confirmed.
3. **Schedule kickoff.** BA + sponsor + Intake. Within 1 week of handoff.
4. **List open questions** the BA should resolve early. With owner + needed-by date.
5. **Flag risks** already visible (tight deadline, hostile stakeholder, unproven assumption).
6. **Hand over related artifacts.** Tickets, prior docs, sponsor emails (linked, not pasted).

## Anti-patterns
- Handoff = "FYI, talk to John."
- Kickoff scheduled "when there's time".
- Open questions left for the BA to discover.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The intake brief is saved at its documented destination and linked from the ticket/board.
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role: `ai-business-analyst` (handoff confirmed, kickoff on the calendar).
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, governance update) rather than only mentioned in chat.
- [ ] Notify the downstream role(s): `ai-product-manager`, `ai-solution-architect`.

## Definition of Done
- [ ] Brief packaged
- [ ] BA assigned + accepted
- [ ] Kickoff scheduled
- [ ] Open questions + risks listed
- [ ] Artifacts linked
