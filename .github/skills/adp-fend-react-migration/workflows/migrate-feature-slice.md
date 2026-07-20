# Workflow: Migrate Feature Slice

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Migration strategy and slice order are approved.
- [ ] Slice has PRD/story acceptance criteria and current Angular behavior evidence.
- [ ] Angular route/component/service inventory for this slice is complete.
- [ ] Target React feature module plan exists or will be produced with `frontend-react/workflows/plan-feature.md`.
- [ ] Parity test cases and rollback path are known.

## Goal

Migrate one business-validatable Angular route or feature slice to React while preserving behavior, contracts, accessibility, i18n/RTL, telemetry, and rollback.

## Steps

1. **Freeze the scope.** Identify exact route(s), user journey, Angular components/services/forms, APIs, guards, analytics, and acceptance criteria in scope.
2. **Capture current behavior.** Screenshots, journey recordings, existing tests, network calls, validation messages, error states, permissions, and analytics events.
3. **Plan React module.** Use `frontend-react/workflows/plan-feature.md` for route, state, data, forms, UI states, i18n/RTL, and test approach.
4. **Build React implementation.** Use `frontend-react/workflows/start-new-feature.md`, `implement-component.md`, and `wire-data.md` as needed. Reuse design-system primitives.
5. **Preserve contracts.** Keep API requests/responses, auth behavior, error mapping, and analytics event meaning stable unless product explicitly approves a change.
6. **Bridge routing safely.** Route traffic to React behind a flag, path mapping, or shell configuration that supports rollback to Angular.
7. **Document parity gaps.** Any intentional behavior change needs PM/UX approval; any unintentional gap blocks cutover.

## Anti-patterns

- Migrating by copying templates line-for-line instead of preserving user behavior.
- Changing API contracts to suit React without backend/product approval.
- Treating parity gaps as polish.
- Removing Angular code before React is validated and rollback-safe.

## After you finish

- [ ] React feature slice is implemented and linked to the migration ticket.
- [ ] Parity gaps and approved behavior changes are documented.
- [ ] Feature flag/routing rollback is documented.
- [ ] Handoff prepared for `validate-parity`.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Traceability recorded: business journey -> Angular behavior -> React implementation -> parity tests.
- [ ] React feature module matches approved route and acceptance scope.
- [ ] API, auth, error, analytics, accessibility, and i18n/RTL behavior are preserved or approved as changed.
- [ ] Rollback to Angular route remains possible.
- [ ] Known gaps are documented with owner and decision.
