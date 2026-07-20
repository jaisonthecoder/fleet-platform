# Phase 4 — Data Display

> **Status:** ✅ Implemented (core) — DataTable (TanStack: sort/filter/paginate), Tabs, Accordion,
> Avatar, Separator, ScrollArea, StatCard, DescriptionList. Shown in `/:lang/design`. Follow-ups:
> standalone Breadcrumb + Pagination components, row-selection/row-actions on DataTable.

> **Goal.** Ship the components that present structured data: a real **DataTable** (sorting,
> filtering, pagination, row actions), **Tabs**, **Accordion**, **Avatar**, **Badge/StatusChip**,
> **Stat/KPI card**, **description list**, **pagination**, **breadcrumb**, **separator**, **scroll
> area**. These power the Approval inbox, Fleet registry, Fines register, Policy tables, and the
> KPI rows of the dashboards.

Prereq: `00_Overview`. Deps: `@tanstack/react-table` (present), `@radix-ui/react-tabs`,
`@radix-ui/react-accordion`, `@radix-ui/react-avatar`, `@radix-ui/react-scroll-area`,
`@radix-ui/react-separator`.

---

## Components

### 1. DataTable — `components/ui/data-table.tsx` (on `@tanstack/react-table`)
- Wrap the existing token-styled `table.tsx` primitives with TanStack Table: **column defs**,
  **sorting**, **column filtering + global filter**, **pagination**, **row selection**, **row
  actions** (via DropdownMenu), **sticky header**, empty + loading (skeleton rows) states.
- Density variants (comfortable / compact) for calm vs operational registers.
- Server-ready: accept controlled state so it can later drive off API pagination/sort.
- **a11y:** real `<table>` semantics (already), sortable headers announce state, keyboard nav.

### 2. Tabs — `components/ui/tabs.tsx` (Radix)
- Underline or segmented style; active = `--brand`/signal indicator; RTL-correct; keyboard arrows.
  Used for register filters (All / Unresolved), detail sections.

### 3. Accordion — `components/ui/accordion.tsx` (Radix)
- Single/multiple; token chevron; used for FAQ/policy detail/collapsible sections.

### 4. Avatar — `components/ui/avatar.tsx` (Radix)
- Image + initials fallback (navy `--brand` bg, white text) — matches the header/sidebar "AK".
  Sizes; optional status dot.

### 5. Badge / StatusChip — extend existing
- `badge.tsx` (exists) + `status-chip.tsx` (exists). Ensure tone parity with alerts/toasts
  (ok/warn/danger/info/neutral), icon + label, `.font-data` for IDs. Add a `count` badge.

### 6. Stat / KPI card — `components/patterns/stat-card.tsx`
- The executive-dashboard KPI cell: label (eyebrow) + big value (`.font-data`, tabular) + delta
  (▲/▼ with `--ok`/`--danger`) + sublabel. Optional leading icon tile (tinted). Signal-bar variant.

### 7. Description list — `components/patterns/description-list.tsx`
- Label→value rows (trip summary, vehicle facts). `--ink-2` label, `--ink` value, `.font-data` for data.

### 8. Pagination — `components/ui/pagination.tsx`
- Prev/next + page numbers + page-size; RTL-aware arrows; drives DataTable.

### 9. Breadcrumb — `components/ui/breadcrumb.tsx`
- Formalise the header eyebrow trail into a reusable Breadcrumb (separator, current page `aria-current`).

### 10. Separator + ScrollArea — `components/ui/separator.tsx`, `ui/scroll-area.tsx` (Radix)
- Token hairline separator; styled scroll area for panels/menus/long lists.

---

## Design / token mapping

| Element | Tokens |
|---|---|
| Table header | `text-muted-foreground` uppercase; row hover `bg-muted/50`; divide `border-border` |
| Active tab indicator | `--brand` (or `--signal` accent bar) |
| Avatar | `bg-brand text-brand-foreground` initials |
| KPI value / delta | `.font-data`; ▲ `--ok`, ▼ `--danger`, flat `--ink-2` |
| Badges/chips | tone tints (`/10` fill, `/30` border) + icon; never colour alone |

---

## Tasks

- [ ] `ui/data-table.tsx` (TanStack Table) with sort/filter/paginate/select/row-actions + empty/loading.
- [ ] Add Radix deps; build `tabs`, `accordion`, `avatar`, `scroll-area`, `separator`, `pagination`, `breadcrumb`.
- [ ] `patterns/stat-card.tsx`, `patterns/description-list.tsx`; extend `badge`/`status-chip` (count + tone parity).
- [ ] Replace the header avatar placeholder + breadcrumb with the new Avatar + Breadcrumb components.
- [ ] Showcase: a sortable/filterable/paginated demo table + tabs + KPI row (both themes, RTL).
- [ ] Tests: sort/filter/paginate/select behaviour; tabs keyboard; avatar fallback; pagination bounds.

## Exit checklist

- [ ] DataTable sorts, filters, paginates, selects rows, shows row actions, and has empty + loading states; RTL correct.
- [ ] Tabs/accordion/avatar/KPI card/description list themed in light + dark, keyboard + RTL correct.
- [ ] Gate green.
