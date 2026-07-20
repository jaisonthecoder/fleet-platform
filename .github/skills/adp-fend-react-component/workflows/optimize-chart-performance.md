# Workflow: Optimize Chart Performance

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Confirm the chart has a measurable performance problem or a known high-volume requirement.
- [ ] Gather realistic maximum data volume, refresh cadence, and dashboard density.
- [ ] Open `references/chartjs-patterns.md`.
- [ ] Confirm whether backend/data aggregation can change.

## Goal

Keep Chart.js dashboards responsive and readable under realistic AD Ports data volumes without hiding important business signals.

## Steps

1. Measure the current behavior: load time, render time, interaction latency, redraw frequency, and memory pressure where tooling allows.
2. Identify the bottleneck: data fetch, transformation, object recreation, Chart.js redraw, plugin cost, animations, or excessive dashboard widgets.
3. Reduce input volume appropriately: server aggregation, time grain selection, pagination, filtering, sampling, or Chart.js decimation.
4. Control redraw behavior:
   - React: memoize chart data/options and stabilize callbacks.
   - Angular: avoid unnecessary data mutation and coordinate update strategy.
   - Live dashboards: batch updates and throttle refreshes.
5. Disable or reduce animations where they harm operational readability or refresh performance.
6. Review plugin cost and remove plugins that do not support a business workflow.
7. Re-test with maximum fixtures and document before/after evidence.

## Anti-patterns

- Rendering every raw operational event when the user needs an aggregate.
- Adding frontend sampling without confirming it does not change the decision.
- Optimizing by removing labels, summaries, or accessibility support.
- Running many live charts at independent refresh intervals without budget control.

## After you finish

- [ ] Before/after evidence is captured.
- [ ] Data-volume strategy is documented.
- [ ] Any backend/data-engineering dependency is handed off.
- [ ] Residual performance risk is visible in the PR or ticket.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Chart remains readable at realistic maximum data volume.
- [ ] Dashboard interactions remain responsive against agreed thresholds.
- [ ] Optimization does not change metric meaning or accessibility behavior.
