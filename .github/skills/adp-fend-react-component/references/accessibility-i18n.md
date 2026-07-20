# Accessibility And I18n For Charts

## Accessibility Baseline

Chart.js renders to canvas, so the surrounding UI must carry meaning:

- Provide a clear title and short text summary of the insight.
- Expose the underlying data through a table, export, details panel, or equivalent when the chart is used for decision-making.
- Do not rely on color alone. Pair color with labels, patterns, position, icons, or explicit threshold text.
- Keep contrast high enough for gridlines, labels, legend text, and status colors.
- Ensure keyboard users can reach chart controls such as range selectors, filters, export, and drilldown.
- Make tooltip-only information available elsewhere.

## I18n And Locale

- Format numbers, dates, currency, and percentages with the app's locale utilities.
- Respect RTL layout for surrounding UI, legend placement, labels, and reading order.
- Keep axis labels short, but do not abbreviate business-critical terms without a glossary.
- Use UAE/GCC business calendar expectations where relevant.
- State the time zone for operational time-series charts.

## Color And Status

- Use the project's design-system tokens when available.
- Keep series colors stable across dashboard widgets when they represent the same entity.
- Reserve red/amber/green for status and threshold semantics.
- Avoid more than 6-8 categorical colors in one chart; group or filter instead.

## Evidence Checklist

Include these in review notes for important charts:

- Metric definition checked with source owner.
- Chart type matches decision need.
- All states captured: loading, empty, error, partial, populated, no-permission.
- Screen-reader summary or alternate table exists.
- Tooltip, axis, and legend formatting use locale utilities.
- Color is not the only information channel.
- Responsive behavior checked at expected viewport sizes.
- Data volume and redraw behavior checked for realistic maximums.
