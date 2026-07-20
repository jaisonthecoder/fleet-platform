# Phase 5 — Charts & Data Visualization

> **Status:** ✅ Implemented — engine decided (**Recharts**), `chart-theme.ts` + themed wrappers
> (KpiSparkline, BarChart, HBars, Donut) + `ChartFrame` a11y data-table fallback. Exec-dashboard
> chart set in `/:lang/design`. Follow-up: record the ADR; add StackedBar + ECharts escalation when the command console lands.

> **Goal.** Choose the right charting engine for the Carpool & Fleet product and ship a small set of
> **themed, reusable chart wrappers** that match the Wayfinder pattern and the executive / command-
> console screens. Charts are token-skinned, dark-mode + RTL aware, accessible (semantic fallback),
> and governed by a **data contract** (decision → metric → chart → validation).

Prereq: `00_Overview`. Governance: follow the AD Ports **`adp-data-chartjs`** discipline (business
alignment gate, metric definitions, canvas/SVG needs semantic support) **regardless of engine**.

---

## 5.1 What the business actually needs

From the executive dashboard + command console prototypes and the roadmap:

| Visualization | Type | Screen |
|---|---|---|
| Group utilisation vs target | Horizontal bar + target line | Executive |
| Cost per km, trailing 6 mo | Vertical bar trend (highlight current) | Executive |
| Fleet size / KPIs | Stat cards (Phase 4, not a chart) | Executive |
| ESG — EV / Hybrid / ICE | Stacked (100%) bar | Executive |
| Utilisation / attention sparklines | Sparkline / mini line | Command console |
| Live ops map | **maplibre-gl** (already a dep) — not a chart lib | Command console |
| Spend composition | Donut / pie | Executive |
| Telemetry replay, behaviour trends | Line/area, potentially large/real-time | Phase 2/3 roadmap |

So: mostly **standard business charts** now, with a **future need for large-series / real-time**.

## 5.2 Library decision

| Library | Render | Theming to our tokens | React DX | Large / real-time | Bundle | Verdict |
|---|---|---|---|---|---|---|
| **Recharts** | SVG | Easy (props + CSS vars) | Declarative, React-first | OK to ~2–5k pts | Medium | **Primary** ✅ |
| Apache ECharts | Canvas/SVG | Medium (theme object) | Imperative wrapper | Excellent (real-time, big) | Larger (tree-shakeable) | **Escalation** for command-console/telemetry |
| Chart.js (react-chartjs-2) | Canvas | Medium (options) | Imperative | Good | Small–medium | Org default (skill) — acceptable alt |
| Tremor | SVG (Recharts) | Fights our exact tokens/3px | Fast blocks | OK | Medium | ❌ opinionated styling |
| visx | SVG | Full control | Low-level, more code | Good | Small | ❌ too much effort for MVP |

### Decision (record as an ADR)
- **Primary = Recharts.** Best React-idiomatic composition and the easiest to theme with our CSS
  variables (colours, IBM Plex Sans, `tabular-nums`, 3px), right-sized for the exec dashboard. Verify
  the installed version supports **React 19** (Recharts ≥ 2.13 / 3.x).
- **Escalation = Apache ECharts** (`echarts` core, tree-shaken) — introduce **only** when we build
  the command console / telemetry replay (high-density, streaming, geo/heatmap beyond maplibre).
- Keep our wrapper API **engine-agnostic** (`<BarChart data cols … />`) so a future swap is contained.
- Chart.js remains the org's documented tool (`adp-data-chartjs`); the ADR justifies Recharts for this
  SPA (theming + DX + MVP fit). If governance mandates Chart.js, the wrapper layer localises the change.

## 5.3 Themed wrapper layer — `components/charts/`

- **`chart-theme.ts`** — reads design tokens at runtime (`getComputedStyle` on `:root`/`.dark`, or a
  hook `useChartTheme()`) → palette `[--brand, --signal, --info, --ok, --warn, --danger, --plum]`,
  grid/axis = `--line`/`--ink-2`, font = IBM Plex Sans, tabular figures. Re-reads on theme change.
- **Wrappers** (thin, typed, token-injecting):
  - `<KpiSparkline>` — tiny line/area, no axes.
  - `<BarChart>` — vertical/horizontal, optional **target/reference line**, current-item highlight.
  - `<TrendChart>` — line/area, multi-series, legend.
  - `<DonutChart>` / `<StackedBar>` — composition (spend, ESG 100%).
- **Shared config:** responsive container, tooltip skinned to `bg-popover`/`border-border`/3px,
  legend using status-safe labels + swatches, number/date formatters (locale-aware), `--ease-standard`
  animation that **disables under `prefers-reduced-motion`**.
- **RTL:** mirror category axis + legend under `dir="rtl"`; keep numerals LTR.

## 5.4 Accessibility & governance (mandatory)

- Charts are decorative to SR by default → provide a **visually-hidden data table** (or `<figure>` +
  `<figcaption>` + `aria-describedby`) so every chart has a semantic equivalent (per `adp-data-chartjs`).
- Colour is never the only signal: pair legends with labels/patterns; verify contrast in both themes.
- Each chart ships a **data contract**: metric definition, unit, time grain, null handling, source,
  and the **business decision** it supports. No chart without a decision + metric owner.
- States: loading (skeleton), empty ("no data for this period"), error (retry).

## 5.5 Performance

- Recharts: memoise data, cap animated points, use `ResponsiveContainer`, avoid re-render storms.
- If a view needs >5k points, streaming, or many simultaneous charts → escalate that view to ECharts.
- `content-visibility:auto` on below-the-fold dashboard sections (design-system §11).

## Tasks

- [ ] Write the **ADR** (chart engine: Recharts primary, ECharts escalation) under `docs/03-architecture/ADR/`.
- [ ] Add the chosen dep(s); create `components/charts/chart-theme.ts` (+ `useChartTheme`).
- [ ] Build `KpiSparkline`, `BarChart` (+ target line + highlight), `TrendChart`, `DonutChart`, `StackedBar`.
- [ ] Loading / empty / error states + the a11y data-table fallback pattern.
- [ ] Rebuild the **executive-dashboard** visuals (utilisation bars, cost-per-km trend, ESG stacked, spend donut) with the wrappers as the showcase, both themes + RTL.
- [ ] Tests: renders with mock data, theme swap re-colours, reduced-motion disables animation, data-table fallback present.

## Exit checklist

- [ ] The 4 exec-dashboard chart types render on-brand in light **and** dark, mirror in RTL, and each has a semantic data-table fallback + data contract.
- [ ] Theme toggle recolours charts from tokens (no hardcoded chart colours).
- [ ] ADR recorded; wrapper API engine-agnostic. Gate green.
