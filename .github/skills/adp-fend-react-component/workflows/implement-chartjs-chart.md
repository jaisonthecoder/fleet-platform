# Workflow: Implement Chart.js Chart

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Confirm chart requirements and data contract are available.
- [ ] Identify host framework: React, Angular, or direct Chart.js.
- [ ] Open `references/chartjs-patterns.md`.
- [ ] Inspect existing chart conventions in the repository before adding new wrappers, tokens, or plugins.

## Goal

Build a Chart.js visualization that follows the host application's architecture, renders all expected states, and keeps chart logic testable.

## Steps

1. Install or reuse the approved packages: `chart.js` plus the host wrapper (`react-chartjs-2`, `ng2-charts`, or existing project standard).
2. Register only required Chart.js controllers, elements, scales, and plugins unless the repo already centralizes registration.
3. Create a typed mapper from source data to Chart.js labels, datasets, and options.
4. Render the chart inside a stable responsive container with explicit height or aspect behavior.
5. Render loading, empty, error, stale, no-permission, and partial-data states outside the canvas.
6. Add title, summary, legend behavior, tooltip formatting, and alternate data access as required.
7. Wire framework-specific lifecycle correctly:
   - React: memoize data/options and avoid recreating large objects on every render.
   - Angular: follow existing change detection and avoid mutation surprises.
8. Add focused tests for mapping, state rendering, tooltip/legend formatting, and edge fixtures.
9. Capture implementation evidence and residual risks in the handoff.

## Anti-patterns

- Building a chart as a one-off component with embedded fetching, mapping, formatting, and business math.
- Letting Chart.js own layout around the canvas instead of using the app's layout system.
- Recreating chart options every render for large or live datasets.
- Adding decorative gradients or animations that reduce readability or performance.

## After you finish

- [ ] Component/directive is implemented in the host framework's existing style.
- [ ] Data mapping is testable outside the canvas.
- [ ] All states render outside the canvas.
- [ ] Accessibility and i18n hooks are present.
- [ ] Handoff includes chart contract, files changed, tests run, and known risks.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Chart renders with realistic data and edge fixtures.
- [ ] Tests cover mapper and state behavior.
- [ ] No raw API shape leaks directly into Chart.js rendering.
- [ ] The chart is ready for QA, review, and accessibility validation.
