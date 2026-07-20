# Workflow: Validate Chart Quality

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Confirm requirements, data contract, and implementation path.
- [ ] Open `references/accessibility-i18n.md`.
- [ ] Identify available validation tools: unit tests, component tests, Playwright, Storybook, visual regression, accessibility checks, or manual evidence.
- [ ] Gather representative fixtures, including edge and maximum-size data.

## Goal

Prove the chart is correct, accessible, localized, responsive, and understandable for its intended business decision.

## Steps

1. Validate data correctness: labels, datasets, units, aggregation, sorting, rounding, thresholds, and time zone.
2. Validate state coverage: loading, empty, error, partial, stale, no-permission, and populated.
3. Validate accessibility: title, text summary, color contrast, non-color status encoding, keyboard-accessible controls, and alternate data access.
4. Validate i18n/RTL: number/date/currency formatting, labels, legend placement, reading order, and time-zone display.
5. Validate responsive behavior at expected desktop, tablet, and mobile widths.
6. Validate interaction behavior: tooltips, legend toggles, filters, drilldown, export, and table view.
7. Capture evidence: screenshots, test output, fixture references, and any manual checks.
8. Write review notes with pass/fail, risks, and follow-up tickets.

## Anti-patterns

- Approving a chart because the canvas appears visually plausible.
- Testing only the happy path fixture.
- Treating tooltip content as accessible enough.
- Ignoring RTL and locale formatting on dashboards used by mixed-language users.

## After you finish

- [ ] Validation notes map back to acceptance criteria.
- [ ] Failures are filed with reproducible fixtures and screenshots.
- [ ] Residual risks are explicit.
- [ ] QA and code-review handoff includes evidence, not only a summary.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Correctness, accessibility, i18n, responsiveness, and interaction checks are complete.
- [ ] Evidence is attached or linked.
- [ ] Any blocked validation has an owner and reason.
