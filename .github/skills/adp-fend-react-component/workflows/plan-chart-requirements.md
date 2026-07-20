# Workflow: Plan Chart Requirements

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Confirm the business decision or operational action the chart supports.
- [ ] Identify the audience, workflow location, and host application.
- [ ] Confirm source metric owner, data freshness, and acceptance criteria.
- [ ] Open `references/accessibility-i18n.md` if accessibility, RTL, locale, or export behavior is in scope.

## Goal

Create a chart requirements note that defines why the visualization exists, what data it needs, how users interpret it, and what evidence will prove it is correct.

## Steps

1. State the decision: what user looks at this chart, what they decide, and what happens next.
2. Define the metric: name, formula, unit, time zone, aggregation, source system, owner, and refresh cadence.
3. Define chart consumers: desktop/mobile, control room, customer portal, leadership report, support view, or field workflow.
4. Capture states: loading, empty, error, partial data, stale data, no permission, and populated.
5. Capture interaction needs: filters, date range, drilldown, tooltip, legend toggle, export, table view, or threshold markers.
6. Capture accessibility and i18n expectations: text summary, alternate data view, color semantics, RTL, number/date formatting.
7. Write the traceability line: **business decision -> metric definition -> chart model -> implementation -> validation evidence**.

## Anti-patterns

- Accepting "make a dashboard chart" without a decision or metric owner.
- Treating chart type as fixed before understanding the business question.
- Ignoring empty, stale, or partial operational data.
- Deferring accessibility and locale behavior until after build.

## After you finish

- [ ] Requirements note includes decision, audience, metric definition, states, interactions, and evidence.
- [ ] Missing source data, ownership, or acceptance criteria are listed as blockers.
- [ ] Handoff goes to `ux-ui-designer`, `data-engineer`, and the relevant frontend role when needed.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Chart purpose is tied to a business decision.
- [ ] Metric definition and source owner are explicit.
- [ ] Accessibility, i18n, and state requirements are explicit.
- [ ] Downstream role has enough context to design or build without re-discovery.
