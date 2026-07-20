# Workflow: Size Business Value


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/brd.md`, `/standards/definition-of-done.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **framed request** from `frame-business-request` is available (ask, sponsor, why-now, outcomes).
- [ ] You have rough volume/throughput numbers or can ask the sponsor for them.
- [ ] The **target destination** for the sizing note is decided (intake board, brief, ticket).

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
A T-shirt-sized value estimate that triages the request — not a full business case.

## Steps
1. **Pick the value lens** that fits: revenue (AED uplift / protected), cost (AED saved, hours reclaimed), risk (regulatory penalty avoided, incident reduced), customer (NPS, SLA met).
2. **Order-of-magnitude estimate.** Rough is fine. State assumptions.
3. **T-shirt size.**
   - **S:** < AED 100k value or < 100 hours/year
   - **M:** AED 100k–1M or up to 1k hours/year
   - **L:** AED 1M–10M or 1k–10k hours/year
   - **XL:** > AED 10M or > 10k hours/year, or strategic
4. **One-line rationale.** "M because saves 30 min × 200 ops per day × 250 days × AED 50/hr ≈ AED 1.25M".
5. **Confidence.** Low/Med/High. Low confidence → flag for full business case before pursuing.
6. **Compare** against current backlog priorities so the requestor sees relative weight.

## Anti-patterns
- 4-week business case at intake.
- Value claimed with no math.
- "Strategic" used to hide that nobody's done the math.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The sizing note is saved at its documented destination and linked from the ticket/board.
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role: `ai-business-analyst`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, governance update) rather than only mentioned in chat.
- [ ] Notify the downstream role(s): `ai-product-manager`, `ai-solution-architect`.

## Definition of Done
- [ ] Value lens named
- [ ] Estimate with assumptions
- [ ] T-shirt size + 1-line rationale
- [ ] Confidence stated
