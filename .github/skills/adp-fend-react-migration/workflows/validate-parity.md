# Workflow: Validate Migration Parity

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Migrated React slice is available behind a route/flag or review environment.
- [ ] Original Angular behavior evidence is available.
- [ ] Acceptance criteria, parity test cases, and approved behavior changes are known.
- [ ] Test commands and environments are available.
- [ ] QA owner and release gate owner are known.

## Goal

Produce evidence that the React slice is safe to release because it matches the Angular behavior that matters to users and the business.

## Steps

1. **Functional parity.** Run acceptance and regression cases for the migrated journey. Compare Angular vs React for happy path, validation failures, auth failures, empty/error/loading states, and edge cases.
2. **Visual and interaction parity.** Compare layout, responsive behavior, keyboard navigation, focus, modal/dropdown behavior, and approved design differences.
3. **Accessibility parity.** Run axe checks and manual keyboard/screen-reader smoke for critical controls.
4. **i18n/RTL parity.** Verify English and Arabic, formatting, logical layout, icon mirroring, and translation key coverage.
5. **Security parity.** Verify auth guards, token handling, sanitized rendering, URL safety, and no new client-side exposure.
6. **Analytics and telemetry parity.** Verify key events, page views, correlation IDs, error reporting, and no PII leakage.
7. **Performance parity.** Compare route load, interaction latency, bundle impact, and Lighthouse or agreed frontend performance signal.
8. **Decide readiness.** Pass, conditional pass, or fail. Conditional pass must name owners, deadlines, and non-release-blocking rationale.

## Anti-patterns

- Validating only the happy path.
- Treating screenshots as sufficient parity evidence.
- Skipping Arabic/RTL because the English page passed.
- Accepting a conditional pass with no owner or expiry.

## After you finish

- [ ] Parity report is saved and linked from the migration ticket.
- [ ] Release blockers and non-blockers are separated.
- [ ] Approved behavior changes are listed.
- [ ] Handoff prepared for `plan-cutover` or back to implementation if failed.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Traceability recorded: critical journey -> parity cases -> pass/fail evidence -> release decision.
- [ ] Functional, visual, accessibility, i18n/RTL, security, analytics, and performance parity checked.
- [ ] Approved behavior changes are documented.
- [ ] Release readiness verdict recorded with owner.
