# Workflow: Plan Cutover And Angular Decommission

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Parity validation report is complete.
- [ ] Release owner, support owner, and rollback owner are named.
- [ ] Routing/flag/hosting mechanism for cutover is known.
- [ ] Monitoring, support, and incident response expectations are known.
- [ ] Angular cleanup scope is identified.

## Goal

Cut over a migrated React slice safely, monitor production behavior, and remove Angular code only after the business and support gates are satisfied.

## Steps

1. **Choose release pattern.** Internal preview, canary, percentage rollout, tenant/location rollout, or full cutover. Match business risk.
2. **Define go/no-go gates.** Parity pass, test pass, accessibility pass, performance signal, security review, support readiness, and rollback rehearsal.
3. **Prepare rollback.** Exact route/flag/config change that returns users to Angular, with owner and expected time to restore.
4. **Prepare monitoring.** Error rate, route traffic, page load, key user action completion, support tickets, analytics events, and user feedback.
5. **Prepare support.** KB notes, known differences, escalation path, support analyst handoff, and incident labels.
6. **Execute cutover.** Record time, version, owner, gates, and observations.
7. **Stabilize before removal.** Keep Angular route/code until agreed observation window passes.
8. **Decommission Angular.** Remove old route, module/component/service/tests/dependencies/build config only after rollback window closes and support confirms no active issues.

## Anti-patterns

- Deleting Angular code during the same release that first enables React.
- No tested rollback path.
- Cutover without support readiness.
- Declaring success before observing real production traffic.

## After you finish

- [ ] Cutover plan and release record are saved.
- [ ] Monitoring links and support notes are available.
- [ ] Rollback path is tested or explicitly blocked with owner.
- [ ] Angular decommission tasks are created with timing.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Traceability recorded: parity evidence -> cutover gate -> production observation -> decommission decision.
- [ ] Go/no-go gates and owners documented.
- [ ] Rollback path rehearsed or blocker escalated.
- [ ] Support and monitoring ready before cutover.
- [ ] Angular removal happens only after observation window passes.
