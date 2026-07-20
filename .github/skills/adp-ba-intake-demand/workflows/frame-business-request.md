# Workflow: Frame a Business Request


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** are available (requestor message, sponsor identity, any prior tickets or emails).
- [ ] The **target destination** for the intake brief is decided (intake board, shared doc, ticket).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Turn a vague ask into a one-page intake brief a decision-maker can act on.

## Steps
1. **Capture the ask in one sentence** using the requestor's words.
2. **Name the sponsor.** A specific person + business unit. "The business" is not a sponsor.
3. **Why now.** What changed (regulation, customer demand, incident, opportunity)? If "why now" can't be answered, the request isn't time-sensitive — note that.
4. **Outcomes.** 1–3 things the sponsor would point to as success in 6–12 months.
5. **Users + scope.** Who's affected, where (port/terminal/HQ), how many.
6. **Existing evidence.** Tickets, incidents, complaints, manual workarounds.
7. **No solutioning.** If the requestor describes a solution, ask "what would that let you do that you can't today?"

## Anti-patterns
- "The business needs a dashboard." (What for?)
- Solution masquerading as a request.
- Sponsor = "everyone".

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The intake brief is saved at its documented destination and linked from the ticket/board.
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role: `ai-business-analyst`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, governance update) rather than only mentioned in chat.
- [ ] Notify the downstream role(s): `ai-product-manager`, `ai-solution-architect`.

## Definition of Done
- [ ] One-sentence ask
- [ ] Sponsor named
- [ ] Why-now answered
- [ ] Outcomes listed
- [ ] No solution language
