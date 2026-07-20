# Workflow: Design Chart Data

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Confirm chart requirements exist or run `plan-chart-requirements`.
- [ ] Confirm host framework and data source shape.
- [ ] Open `references/chartjs-patterns.md`.
- [ ] Confirm whether the chart handles operational, personal, commercial, or security-sensitive data.

## Goal

Design the Chart.js data contract, chart type, options, and transformation approach before implementation starts.

## Steps

1. Choose the chart type from the decision need, not preference. Record why line, bar, doughnut, scatter, or another type is appropriate.
2. Define the input contract: source fields, expected types, nullability, unit, time grain, category keys, and sort order.
3. Define the output contract for Chart.js: labels, datasets, scales, legends, tooltips, thresholds, colors, and plugin needs.
4. Define data transformation ownership: server aggregation, frontend mapper, shared utility, or data-engineering model.
5. Define edge behavior for zero, null, missing, delayed, duplicate, outlier, and stale values.
6. Define test fixtures with realistic small, empty, edge, and maximum-size samples.
7. Write the design note and hand it to the implementing frontend role.

## Anti-patterns

- Passing raw API rows directly into Chart.js.
- Encoding metric calculations inside tooltip callbacks or render functions.
- Hiding missing values by converting them to zero without business approval.
- Adding plugins without explaining the user behavior they enable.

## After you finish

- [ ] Chart data contract is documented.
- [ ] Chart type and plugin choices are justified.
- [ ] Test fixtures cover normal and edge data.
- [ ] Data ownership and transformation location are explicit.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] A frontend engineer can implement the chart from the contract.
- [ ] A QA engineer can derive test cases from the fixtures.
- [ ] The metric owner can verify the chart definition without reading code.
