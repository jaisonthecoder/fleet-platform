---
applyTo: "apps/noatum-customer-portal-ui/src/design-system/**"
description: The one place raw brand values are allowed
---

# Design system rules (apps/noatum-customer-portal-ui/src/design-system)

This is the **only** package where a hex colour, a `font-family` or a `border-radius`
may appear. Everything else in the repo references these tokens.

## Tokens are copied verbatim and are not ours to change

`src/styles/tokens.css` is a verbatim copy of the token block in
`docs/noatum-designsystem.md`. Do not rename a custom property, do not "improve" a value,
do not add a colour outside the brand set. Token changes flow from the brand team
(PRD section 2 non-goals: this project does not redesign the brand).

The `noatum-designsystem` skill carries the same content, including the component
recipes. Read it before adding or changing a component.

## Component rules

- **Button**: primary solid red, outline variant. **No other variants.**
- **Cards and sections are square** (`--radius-none: 0`). Only buttons and inputs get 4px.
- **SectionHeading** carries the 40x3px red rule, aligned with the heading.
- **Tabs** are folder-style: active tab white and merged into the panel, inactive
  `#E5E5E5` with a hairline bottom border.
- **StatCounter**: 56px red thin-line icon, red stat figure, 32x2px red divider, bold
  17px red label. Used in a 6-up row.
- No feature logic, no API calls, no router imports. A component here must work on any
  screen. Anything used on exactly one screen belongs in that feature folder instead.

## What may be added

App patterns the brand recipes do not cover — tables, status badges, wizards, timelines,
drawers, the Grid/Detail/Card `DataView` — built under the same rules and exported from
`src/index.ts`.

Icons: Lucide at stroke 1.5 in `var(--color-primary)` until the brand team supplies the
original SVG set (OQ-13). **Never redraw the logo** — use the supplied assets, or plain
type as a placeholder.

## Governance

Core components carry visual regression snapshots. A deviation from the design system
needs brand-team sign-off, recorded as an ADR.
