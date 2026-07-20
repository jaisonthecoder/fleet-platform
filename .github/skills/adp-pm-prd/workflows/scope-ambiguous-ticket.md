# Workflow: Scope an Ambiguous Ticket

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/prd.md`, `/standards/definition-of-done.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You have the ticket link and can read its current state (title, description, comments, attachments).
- [ ] If the ticket is not created yet, you have asked for Title, Description, and Reporter Email before submission.
- [ ] If Reporter Email is invalid or unavailable, you asked once for a correction before falling back to system-created.
- [ ] You know who raised it (sponsor, ops, customer support, auto-generated).
- [ ] You can reach the requester for clarification (Slack/email/ticket comment).
- [ ] You know the product's North-Star metric or current OKR so you can judge priority.

## Goal
Turn a vague request — "make search faster," "fix the dashboard," "add export" — into a scoped, measurable, acceptance-testable statement that a developer can estimate and ship, or an explicit rejection with a reason.

## Steps

0. **Capture required intake fields before submission.**
   - Ask for **Title** and put it in the ticket title.
   - Ask for **Reporter Email** and put it in **Created By**.
   - Ask for **Description** and put it in the ticket description.
   - If **Reporter Email** is invalid or unavailable, ask once for a corrected email.
   - If no valid reporter email can be confirmed, create the ticket under the system/automation identity, record the supplied reporter value in the description, and mark the ticket as needing reporter confirmation.
   - Do not submit the ticket while Title or Description is missing.
1. **Write the ticket's implicit question out loud.** "Faster" → faster than what, for whom, on which query, measured how. If you can't write it, you don't understand it yet.
2. **Ask the 5 W-questions, in this order, in the ticket (not DM):**
   - **Who** is the user? (segment, role, volume)
   - **What** is the observable behavior today vs desired?
   - **When** does it happen? (always, peak hours, specific flow)
   - **Where** — which screen, endpoint, report?
   - **Why now** — what changed to make this urgent?
3. **Force a metric.** "Search p95 < 500ms for queries under 3 terms on the customs dataset" beats "faster." Pick the cheapest measurable proxy. If there's no metric, there's no success.
4. **Get a counter-example.** "What would make this ticket NOT done?" Forces the requester to name the boundary.
5. **Size at three levels.** Smallest viable fix (1d), preferred fix (3d), full solution (2w). Each with its own AC. This is the trade-off menu.
6. **Identify hidden constraints.** Compliance, SLAs, downstream consumers, data residency, accessibility. Ambiguous tickets often hide these.
7. **Reject early if needed.** If after 24h the requester can't answer Q3 (metric) or Q4 (counter-example), send it back with "need metric + counter-example to proceed." Not a refusal — a block on the requester.
8. **Write the resulting story** in its dedicated file under `docs/02-product/PRD/user-stories/` using the product-manager `define-acceptance` rules. Link the story file from the original ticket and the PRD story index.
9. **Record the conversation** in the ticket, not Slack. Future-you will need it.

## Anti-patterns
- Starting implementation on a ticket you can't summarize in one sentence.
- "I'll figure it out as I go" — that's how scope creep is born.
- Asking clarifications in DM so the answer is lost.
- Accepting "make it better" as an AC.
- Sizing one option only — the requester has no trade-off to choose from.
- Waiting silently for clarification for days; either block the ticket or escalate.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] The ticket now has a one-sentence goal, a measurable AC, a counter-example, and a chosen size (S/M/L).
- [ ] Title, Description, and Reporter Email were captured before submission.
- [ ] Ticket title uses Title; Created By uses valid Reporter Email or the system/automation identity; ticket description uses Description.
- [ ] If system-created, the invalid/missing reporter value is recorded in the description and follow-up is flagged.
- [ ] Requester explicitly agreed in the ticket (not assumed).
- [ ] Hidden constraints (compliance, a11y, downstream) are named or explicitly out of scope.
- [ ] Linked PRD entry and dedicated story file exist.
- [ ] Notify the delivery planner + owning engineer role.
- [ ] Notify the downstream role(s): `ai-solution-architect`, `ai-ux-ui-designer`, `ai-quality-engineer`.

## Definition of Done
- [ ] Goal: one sentence
- [ ] Required intake fields captured and mapped correctly, or system-created fallback documented
- [ ] Metric-based acceptance criterion
- [ ] Counter-example ("not done if…")
- [ ] 3-level size with trade-off noted
- [ ] Hidden constraints listed
- [ ] Requester agreement in-ticket
- [ ] Dedicated story file linked from the ticket and PRD story index
