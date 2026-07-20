# Chart.js Patterns

## Package Choice

- React projects usually use `chart.js` plus `react-chartjs-2`.
- Angular projects usually use `chart.js` plus `ng2-charts`.
- Plain web components can use `chart.js` directly, but the host framework still owns lifecycle, data fetching, and state.
- Register only the Chart.js controllers, elements, scales, and plugins the chart uses. Avoid broad auto-registration in bundle-sensitive apps unless the project already standardizes on it.

## Chart Type Selection

| Decision need | Prefer | Avoid |
|---|---|---|
| Trend over time | Line chart, area chart with restrained fill | Pie/doughnut |
| Compare categories | Bar chart | Radar |
| Part-to-whole with few categories | Doughnut or stacked bar | Pie with many slices |
| Distribution | Histogram-like bar, boxplot plugin if approved | Line chart |
| SLA/threshold status | Bar/line with annotation plugin or explicit threshold line | Color-only encoding |
| Many dense points | Aggregated line with decimation | Raw scatter with thousands of points |

## Data Contract

Every chart needs a small contract:

- Metric name and business definition.
- Unit, scale, precision, and rounding rule.
- Time zone and date grain for time-series charts.
- Dataset keys and labels.
- Sort order and grouping rules.
- Null, zero, missing, and delayed data behavior.
- Thresholds, targets, and warning levels.
- Source endpoint/table/report and owner.

## Implementation Defaults

- Keep chart options typed and close to the chart component.
- Keep data transformation outside the render path when possible.
- Memoize chart data/options in React; avoid rebuilding large objects on every render.
- In Angular, use `OnPush` where the host component supports it and avoid mutating chart data without a deliberate update strategy.
- Use responsive containers with defined height. Canvas charts can collapse or stretch badly when height is implicit.
- Render empty, loading, error, no-permission, and partial-data states outside the canvas.
- Prefer source-system aggregation for large datasets; the frontend should not summarize large operational histories repeatedly.

## Plugins

Use plugins only when they earn their cost:

- `chartjs-plugin-annotation` for thresholds, targets, and release markers.
- `chartjs-plugin-zoom` only when the workflow needs inspection of dense data and the interaction is discoverable.
- Datalabel plugins only for small charts where labels remain legible.

Record any plugin in the chart design note with the behavior it enables.

## Test Strategy

- Unit-test data mapping: source rows -> labels/datasets/options.
- Component-test state rendering: loading, empty, error, populated, partial data.
- Validate tooltip and legend formatting with deterministic input.
- Use visual regression or screenshot checks for critical dashboards when the repo supports it.
- For accessibility, test the semantic summary and table/alternative content, not only the canvas.

## Anti-Patterns

- Building charts directly from raw API shape without a mapping layer.
- Putting business metric calculations inside tooltip callbacks.
- Depending on color alone for status or category meaning.
- Rendering 20+ charts on a dashboard without redraw and data-volume budgets.
- Hiding data quality issues by silently converting null to zero.
- Using chart type as a preference instead of matching the user's decision.
