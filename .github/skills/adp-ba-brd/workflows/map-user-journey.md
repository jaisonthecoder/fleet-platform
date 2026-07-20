# Workflow: Map a User Journey


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (persona, scenario, discovery notes, observed process, touchpoints, pain evidence - whichever apply).
- [ ] You know **who the output is for** (`ai-business-analyst`, `ai-product-manager`, `ai-ux-ui-designer`, sponsor, or another named stakeholder).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] If writing to a repository, you are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Produce a stage-by-stage view of how a user (customer, operator, internal staff) experiences a process — to reveal pain points and redesign opportunities.

## Steps

1. **Pick one persona and one scenario.** Journeys fragment if you try to merge personas. Name the persona, goal, and entry trigger.

2. **List stages end-to-end.** Typical pattern: Trigger → Pre-action → Action → Waiting → Outcome → Follow-up. Use the stakeholder's language.

3. **For each stage, capture:**
   - What the user does
   - What system/touchpoint they use
   - What they think / feel (quotes if possible)
   - Pain points
   - Duration (minutes, hours, days)
   - Handoffs (to whom)

4. **Mark moments of truth.** The 2–3 stages where the experience is made or broken.

5. **As-is vs to-be.** Do an as-is first. Only sketch to-be once pain points are agreed.

6. **Produce visual.** Text table works; a swimlane diagram is better. Use mermaid if outputting for Claude/Copilot:

   ```mermaid
   journey
     title Vessel berth booking — as-is
     section Request
       Agent submits form: 3: Agent
       Waits for ops reply: 2: Agent
   ```

## Anti-patterns

- Journey map that's actually a system diagram — it must be from the user's POV.
- Pain points with no evidence. Cite the discovery notes.

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
- [ ] One named persona + one scenario, end-to-end
- [ ] Each stage records action, touchpoint, think/feel, pain, duration, and handoff
- [ ] Moments of truth marked (2–3)
- [ ] As-is captured before to-be
- [ ] Pain points cite discovery evidence (no anonymous claims)
- [ ] Visual (table or swimlane/mermaid) committed at the agreed path
