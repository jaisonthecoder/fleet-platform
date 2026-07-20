# Workflow: Plan Angular To React Migration Strategy

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Angular assessment report exists.
- [ ] Business driver, sponsor, target outcomes, timeline, and risk tolerance are known.
- [ ] Target React standards are known from `frontend-react`.
- [ ] Hosting/routing constraints are known from `platform-sre` or `solution-architect`.
- [ ] Cutover and rollback expectations are agreed at a high level.

## Goal

Create a migration strategy that defines slice order, target architecture, coexistence model, verification gates, and rollback before any feature migration starts.

## Steps

1. **Choose migration model.** Strangler-by-route, micro frontend, parallel app, or big-bang. Default to strangler-by-route unless the app is small and low-risk.
2. **Define target React architecture.** Feature modules, routing, design-system usage, state-by-kind, API client generation, i18n/RTL, tests, telemetry, and build pipeline.
3. **Define coexistence.** How Angular and React route together, share auth/session, share navigation, share design tokens, and avoid duplicate analytics.
4. **Sequence slices.** Order by business priority, dependency risk, learning value, and rollback ease. Avoid migrating core shell/shared components first unless required for coexistence.
5. **Define parity gates.** Functional, visual, accessibility, i18n/RTL, security, analytics, performance, and support-readiness evidence required per slice.
6. **Define team plan.** Owners, review path, pairing between Angular and React engineers, QA involvement, and release cadence.
7. **Define decommission model.** How old Angular routes, modules, dependencies, tests, and deployment paths will be removed after cutover.

## Anti-patterns

- "Rewrite everything in React" with no slice order or rollback.
- Mixing migration with broad UX redesign without product approval.
- Choosing micro frontends because they are fashionable, not because deployment boundaries require them.
- Leaving QA, support, or platform out until the final release.

## After you finish

- [ ] Strategy is documented and linked from the migration epic.
- [ ] Slice order and gates are reviewed by PM, architecture, QA, release, and platform.
- [ ] First migration slice is selected.
- [ ] Handoff prepared for `migrate-feature-slice`.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Traceability recorded: business driver -> migration model -> slice order -> release gates.
- [ ] Migration model and target architecture documented.
- [ ] Coexistence and routing approach documented.
- [ ] Slice order, owners, and gate evidence defined.
- [ ] Rollback and Angular decommission approach documented.
