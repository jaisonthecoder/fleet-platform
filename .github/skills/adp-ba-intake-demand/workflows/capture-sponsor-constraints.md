# Workflow: Capture Sponsor Constraints


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/brd.md`, `/standards/definition-of-done.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **sponsor is identified** (named person + business unit) and reachable.
- [ ] You have a slot for a short conversation with the sponsor — don't infer constraints from third parties.
- [ ] The **target destination** for the constraints list is decided (intake brief, ticket, board).

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Surface the hard limits before discovery — so the BA doesn't waste cycles on out-of-bounds options.

## Steps
1. **Direct from sponsor.** Constraints captured in their words; quoted with date.
2. **Categories to probe:**
   - Deadline (regulatory date, customer commitment, peak ops window)
   - Budget (envelope or cap)
   - Regulatory (NESA, customs, maritime, data residency)
   - Political (other BUs, executive visibility, partnerships)
   - Technical (must integrate with X, must avoid Y)
   - Organizational (training capacity, change appetite)
3. **Hard vs soft.** Hard = will-not-flex; soft = preference. Mark each.
4. **Implicit constraints.** Often unsaid — ask: "what would make you reject the solution outright?"
5. **Sign off.** Sponsor confirms the list before BA picks it up.

## Anti-patterns
- BA discovering the budget cap halfway through.
- Constraints written in BA's interpretation rather than sponsor's words.
- Hard/soft not distinguished.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The constraints list is saved at its documented destination and linked from the ticket/board.
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role: `ai-business-analyst`.
- [ ] If this workflow surfaced a **risk or policy gap** (e.g. regulatory exposure, compliance constraint), it is captured (risk register, governance update) rather than only mentioned in chat.
- [ ] Notify the downstream role(s): `ai-product-manager`, `ai-solution-architect`.

## Definition of Done
- [ ] Constraints quoted + dated
- [ ] Categories covered
- [ ] Hard vs soft marked
- [ ] Sponsor signed off
