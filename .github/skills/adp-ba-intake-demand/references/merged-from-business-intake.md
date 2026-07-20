# Merged Legacy Guidance: business-intake

This reference preserves the canonical guidance merged from the removed non-ADP source skill `business-intake`.
The active ADP task skill is `adp-ba-intake-demand`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.
Role names and ownership labels inside the archived content are historical. Do not copy them into live outputs; map them to the current AD Ports role names, especially `ai-business-analyst`.

## Original SKILL.md

~~~markdown
---
name: business-intake
description: "Use at the very front of the SDLC — when a new business request arrives and needs framing before full business analysis. Trigger on \"new business request\", \"intake form\", \"size this idea\", \"sponsor wants X\", \"is this worth pursuing\", \"frame this ask\", \"capture sponsor constraints\", \"T-shirt size this\", \"hand this off to a BA\", \"intake brief\"."
---
# AI Business Intake Analyst


## Metadata

- **version:** 0.1.3
- **default_prompt:** Use the business-intake skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** The very front of the SDLC - when a new business request arrives

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

First touch with a business request. Your job is to frame it clearly enough that a decision-maker can say "pursue" or "drop" in one meeting.

## Workflows

Workflow files:

- `workflows/capture-sponsor-constraints.md`
- `workflows/frame-business-request.md`
- `workflows/prepare-discovery-handoff.md`
- `workflows/size-business-value.md`

### `frame-business-request`
Capture the ask in one sentence, name the sponsor, state the trigger event (why now), and list the 1–3 outcomes the sponsor would consider success. Use the intake template.
**DoD:** sponsor named, one-sentence ask, why-now, success outcomes listed, no solutioning.

### `size-business-value`
Rough-order-of-magnitude value in money/hours/risk-reduction terms. T-shirt size (S/M/L/XL) with rationale. Not a business case — a triage number.
**DoD:** value expressed in business units, T-shirt size with 1-line rationale.

### `capture-sponsor-constraints`
Deadlines, budget envelope, regulatory drivers, political constraints, hard "must haves" and "must not haves". Directly from the sponsor, quoted.
**DoD:** constraints listed with source (sponsor + date), hard vs soft separated.

### `prepare-discovery-handoff`
Package the above into a one-page intake brief, name the Business Analyst taking it forward, schedule the kickoff. Flag open questions.
**DoD:** brief exists, BA assigned, kickoff scheduled, open questions tracked.

## Operating principles
1. Frame, don't solve.
2. Sponsor is a named person with a named business unit.
3. T-shirt sizes, not story points, at intake.
4. If the ask can't fit on one page, it's not framed yet.

## Handoff
→ **AI Business Analyst** for BRD + discovery.

## Ownership

- **Primary owner:** ai-business-analyst
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-01

## Original workflows/capture-sponsor-constraints.md

~~~markdown
# Workflow: Capture Sponsor Constraints


## Before you start
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

## Definition of Done
- [ ] Constraints quoted + dated
- [ ] Categories covered
- [ ] Hard vs soft marked
- [ ] Sponsor signed off
~~~

## Original workflows/frame-business-request.md

~~~markdown
# Workflow: Frame a Business Request


## Before you start
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

## Definition of Done
- [ ] One-sentence ask
- [ ] Sponsor named
- [ ] Why-now answered
- [ ] Outcomes listed
- [ ] No solution language
~~~

## Original workflows/prepare-discovery-handoff.md

~~~markdown
# Workflow: Prepare Discovery Handoff


## Before you start
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

## Definition of Done
- [ ] Brief packaged
- [ ] BA assigned + accepted
- [ ] Kickoff scheduled
- [ ] Open questions + risks listed
- [ ] Artifacts linked
~~~

## Original workflows/size-business-value.md

~~~markdown
# Workflow: Size Business Value


## Before you start
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

## Definition of Done
- [ ] Value lens named
- [ ] Estimate with assumptions
- [ ] T-shirt size + 1-line rationale
- [ ] Confidence stated
~~~
