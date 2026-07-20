# Workflow: Review UX Critique


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask. Do not fabricate.

- [ ] You can state the interface goal and primary user task in one sentence.
- [ ] The artifact or live UI is available: design file, screenshot, source files, local URL, or deployed URL.
- [ ] The intended audience, PRD, acceptance criteria, persona, journey, or design goal is available, or the gap is recorded as a risk.
- [ ] The output destination is known: ticket comment, review record, design handoff, PR comment, or artifact path.
- [ ] You have checked `/standards/prd.md`, `/standards/definition-of-done.md`, and `/standards/test-plan.md` when they apply.
- [ ] Optional tools are identified: browser automation, screenshots, `npx impeccable`, accessibility scanner, or subagents.

If a required design goal, artifact, or primary task is missing, write a short "waiting on" note and stop. Missing optional detector tooling does not block the review; record it in the evidence section.

## Goal
Produce an evidence-backed UX critique that identifies usability, accessibility, visual, and handoff risks before frontend, mobile, QA, or release work depends on the design.

## Steps
1. **Frame the review.** Record the artifact path or URL, source request, primary task, audience, target platform, and AD Ports edge: Arabic/RTL, accessibility, dense operational workflow, approvals, tenant boundary, field/mobile use, or maritime SLA.
2. **Gather context.** Read the PRD, personas, journey, design-system guidance, acceptance criteria, and existing product patterns. If context is missing, decide whether the gap blocks the review or becomes an assumption.
3. **Run the UX review.** Evaluate visual hierarchy, information architecture, cognitive load, discoverability, states, microcopy, design-system fit, responsive behavior, RTL readiness, accessibility, and emotional risk at high-stakes moments.
4. **Score heuristics.** Score Nielsen's 10 heuristics from 0-4 and report a total out of 40. Be strict: a 4 means excellent, not merely adequate.
5. **Check cognitive load.** Count visible options at key decision points, flag any decision point with more than four peer options, and verify progressive disclosure.
6. **Use automation when available.** For markup files, run `npx impeccable --json [--fast] <target>` when installed. For URLs, use browser visualization only when browser automation is available. Record command output or explain why automation was not run.
7. **Walk personas through the task.** Select 2-3 relevant personas, including AD Ports operational, Arabic/RTL, first-time, power-user, or field/mobile personas when applicable. Name the exact UI moments that break each persona.
8. **Map findings to SDLC risk.** Identify release blockers, accessibility exceptions, brand/design-system deviations, QA test impacts, frontend/mobile implementation needs, and product decisions requiring owner approval.
9. **Write the critique package.** Include health score, anti-pattern verdict, what works, priority findings, persona red flags, evidence, assumptions, open questions, owner, downstream role, and final decision: `accepted`, `accepted with follow-ups`, or `rework required`.

## Anti-patterns
- Reviewing only how the screen looks and ignoring the task, state model, accessibility, RTL, or downstream implementation.
- Presenting detector output without human judgment, false-positive handling, or severity.
- Asking generic persona questions after the critique instead of tying questions to actual findings.
- Reporting problems without owner, evidence, suggested fix, and downstream role.
- Blocking on missing optional tools instead of recording the gap and continuing with manual review.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The critique is saved or linked from the agreed destination.
- [ ] Evidence is attached: artifact path or URL, screenshots if used, detector output if run, standards checked, assumptions, and open questions.
- [ ] Priority findings have severity, location, owner, suggested fix, and downstream role.
- [ ] Notify the downstream role(s): `ai-ux-ui-designer`, relevant frontend/mobile role, `ai-quality-engineer`, and `ai-delivery-planner` when backlog work is needed.
- [ ] Accessibility exceptions, release blockers, or risk acceptances are routed to the human gate named in `SKILL.md`.

Run `git status` to confirm nothing unintended was changed. If you touched code or test assets, run the relevant checks before declaring done.

## Definition of Done
- [ ] Interface goal, artifact, source request, and primary user task are recorded.
- [ ] Nielsen score, cognitive load check, persona walkthrough, AD Ports edge check, and accessibility/RTL review are complete.
- [ ] Optional automation was run or the not-run reason is documented.
- [ ] Findings are prioritized by severity and tied to evidence, owner, fix, and downstream role.
- [ ] Final decision and handoff are explicit.
