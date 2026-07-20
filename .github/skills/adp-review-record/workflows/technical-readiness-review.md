# Workflow: Technical Readiness Review (Pre-Go-Live)


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/code-review-checklist.md`, `/standards/definition-of-done.md`.
- [ ] Goal stated in one sentence — which release, which scope, which date.
- [ ] PRD + AC + NFR + architecture doc accessible.
- [ ] Test results, security review, runbooks, dashboards accessible.
- [ ] All role leads available for the review.
- [ ] Right branch.

## Goal
A go/no-go technical decision with named risks, named owners, and either a "go" with the rollout plan or a "no-go" with the smallest path to ready.

## Steps
1. **Functional readiness.** AC met, QA sign-off, UAT sign-off if required. Defects: open count by severity, plan for any P1/P2 left.
2. **Non-functional readiness.** Load test result, latency p95 vs target, error budget headroom, capacity for expected traffic ×2.
3. **Security + compliance.** Threat model addressed, security findings closed or accepted, secrets scanned, IAM reviewed.
4. **Operational readiness.** Runbooks for top failure modes, alerts wired with owners, dashboards live, on-call rotation aware.
5. **Data readiness.** Migrations rehearsed in non-prod, rollback tested, data quality checks passing on prod-shape data.
6. **Release plan.** Deployment strategy (blue/green, canary, rolling), feature flags, rollback steps, comms plan.
7. **Decision.** Go / Conditional Go / No-Go. Conditional is allowed only with named conditions and an owner per condition.
8. **Sign-offs.** Tech-lead, solution-architect, security, QA, release-engineer, support — each named, each says yes/no/conditional.

## Anti-patterns
- "We'll fix it after launch" without an owner + date — never gets done before the next launch.
- One person says "go" for the whole team — no shared accountability.
- Missing runbooks because "the team knows" — fine until that person is on PTO during the incident.
- Skipping load test because "it's similar to the last release" — until it isn't.

## After you finish
- [ ] DoD met.
- [ ] Decision document committed.
- [ ] Conditions + owners + dates captured.
- [ ] Open questions logged.
- [ ] Notify: `release-engineer`, `support-analyst`, `platform-sre`, `product-manager`, `governance-lead`.
- [ ] Risks captured (in the risk register, not just in chat).
- [ ] Notify the downstream role(s): `ai-delivery-planner`, `ai-quality-engineer`.

## Definition of Done
- [ ] Each readiness dimension has a yes/no answer with evidence
- [ ] Decision recorded with named sign-offs
- [ ] Conditions (if any) have owners + dates
- [ ] Rollback path tested and documented
- [ ] Comms plan agreed
