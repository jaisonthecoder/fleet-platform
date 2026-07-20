# Component Library — Build Plan (Overview & Principles)

> **Goal.** Build the full set of **supportive, reusable UI components** for `app-ui` — feedback
> (toasts, alerts), overlays (dialogs, popovers, confirmations), **all form fields**, data-display,
> and **charts** — every one **shadcn/ui-based** and skinned to match the **Wayfinder** design
> pattern (see `../design-system.md`). This folder holds the **phase-by-phase plan**;
> one phase per file. Build in order; each phase has an exit checklist.

| Phase | File | Scope |
|---|---|---|
| 1 | `01_Feedback_and_Notifications.md` | Toast/Toaster, Alert (inline), Banner, Skeleton, Spinner, Progress, Empty state |
| 2 | `02_Overlays_and_Dialogs.md` | Dialog, **Confirmation dialog** (AlertDialog + `useConfirm`), Popover, Dropdown menu, Sheet, Tooltip, Hover card, Command palette |
| 3 | `03_Form_Fields_and_Validation.md` | Form (React Hook Form + Zod), Field, Input, Textarea, Select, Combobox, Multiselect, Checkbox, Radio, Switch, Slider, Date/Range/Time pickers, Number, File upload, Segmented control, Tag input |
| 4 | `04_Data_Display.md` | DataTable (TanStack Table), Tabs, Accordion, Avatar, Badge/StatusChip, Stat/KPI card, Description list, Pagination, Breadcrumb, Separator, ScrollArea |
| 5 | `05_Charts_and_Visualization.md` | Chart library selection + themed chart wrappers (bar/line/area/donut/stacked/sparkline/KPI) |
| 6 | `06_Testing_A11y_and_Rollout.md` | Test strategy, a11y audit, showcase, rollout order, Definition of Done |

---

## 1. Non-negotiable principles (every component)

1. **Tokens only.** Consume the design tokens from `src/index.css` (`--brand`, `--signal`, `--ink`,
   `--paper`, `--line #E0DACB`, `--ok/--warn/--danger/--info`, `--plum`, …) via Tailwind utilities
   (`bg-brand`, `text-muted-foreground`, `border-border`, …). **No raw hex / px** for colour, radius,
   or font in a component.
2. **One type family.** IBM Plex Sans everywhere; data uses `.font-data` (Sans + `tabular-nums`). No Mono.
3. **Radius 3px** default (`rounded-[3px]`/`rounded-md`), tiles 2–6px, avatars/dots full circle.
4. **Borders = the soft warm hairline** (`border-border` → `#E0DACB`). Never an unlayered
   `*{border-color}` (it falls back to `currentColor` = heavy dark border — see design-system §5).
5. **Both themes.** Light (paper) + dark (navy) must both look correct — verify each component in both.
6. **RTL parity.** Logical properties only (`ps/pe`, `ms/me`, `start/end`, `border-e`); mirrors under `dir="rtl"`.
7. **Status is never colour alone.** Icon + text (+ position) always accompany a status colour.
8. **Accessibility (WCAG 2.1 AA).** Semantic HTML, full keyboard path, visible `:focus-visible`
   (2px ring + offset, already global), labelled icons, correct ARIA roles. Radix primitives give us
   most of this for free — do not regress it.
9. **i18n.** Every user-facing string via `react-i18next` (`useTranslation`). No hardcoded copy in
   shared components; consumers pass translated strings. Locale-aware numbers/dates.
10. **Controlled + uncontrolled.** Follow Radix/shadcn conventions; support `asChild` where relevant.
    ⚠️ **Never pass a function `className`/children to a component wrapped by Radix `asChild`/Slot** —
    Slot stringifies it and styling silently breaks (see repo memory / design-system).

---

## 2. Where components live

```
src/components/
  ui/            # shadcn primitives (owned in-repo) — Button, Input, Dialog, Toast, …
  patterns/      # composed, domain-agnostic patterns — availability-strip, kpi-card, …
  charts/        # themed chart wrappers (Phase 5)
  form/          # Form + Field wiring (React Hook Form) (Phase 3)
src/hooks/       # useConfirm, useToast helpers, etc.
src/lib/         # utils (cn), chart-theme, date/number formatters
```

- **Extend, don't replace** the primitives that already exist: `button`, `badge`, `card`, `alert`,
  `input`, `label`, `select`, `textarea`, `dialog`, `sheet`, `tooltip`, `table`, `skeleton`,
  `status-chip`, `signal-card`, `page-header`, `availability-strip`.
- New shadcn primitives are added into `components/ui/` and **re-skinned to tokens** before use —
  the default shadcn palette (neutral/zinc) must be replaced with our token utilities.

---

## 3. Tech baseline

- **React 19 + TypeScript (strict)** on Vite; **Tailwind CSS v4** (CSS-first, `@theme inline`).
- **Radix UI** primitives under shadcn wrappers.
- **Forms:** React Hook Form + `@hookform/resolvers` + **Zod** (all already in `package.json`).
- **Tables:** `@tanstack/react-table` (already in the catalog).
- **Tests:** Vitest + Testing Library + MSW; run gates via `./node_modules/.bin/<tool>`.

### 3.1 Dependencies to add (per phase)

> ⚠️ **pnpm gotcha (repo memory):** the PATH `pnpm` is 10.15.1 but the repo pins `pnpm@11.13.1`.
> Install with the newer pnpm (`/c/Users/jaison.joseph/AppData/Roaming/npm/pnpm`) and expect the
> **lockfile + `pnpm-workspace.yaml` catalog** to change. Prefer adding to the workspace **catalog**
> and pin versions. Treat dependency additions as an explicit, reviewed step — do not let a stray
> install rewrite the lockfile. Confirm versions support **React 19**.

| Phase | Packages (proposed) |
|---|---|
| 1 | `sonner` (toasts) |
| 2 | `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `cmdk` |
| 3 | `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-switch`, `@radix-ui/react-slider`, `react-day-picker` + `date-fns` |
| 4 | `@radix-ui/react-tabs`, `@radix-ui/react-accordion`, `@radix-ui/react-avatar`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-progress` (react-table already present) |
| 5 | chart library — **decided in Phase 5** (Recharts primary; ECharts escalation) |

---

## 4. Definition of Done (applies to every component)

- [ ] Built on the correct Radix/shadcn base, re-skinned to **tokens** (light + dark verified).
- [ ] All relevant **states**: default · hover · focus-visible · active · disabled · loading · error · empty.
- [ ] **Keyboard** operable; correct roles/ARIA; `:focus-visible` ring intact.
- [ ] **RTL** verified (`/ar`); logical properties only.
- [ ] **i18n**: no hardcoded copy; strings come from props/`t()`.
- [ ] Rendered in the **design showcase** (`/:lang/design`) in both themes + RTL.
- [ ] **Unit/interaction test** (Vitest + RTL) for behaviour; a11y check where meaningful.
- [ ] Gate green: `tsc -b --noEmit`, `oxlint`, `vitest run`, `vite build`.
- [ ] `design-system.md` updated **before** a genuinely new pattern ships.

---

## 5. Sequencing rationale

Feedback + overlays (Phases 1–2) unblock every future screen (confirmations, errors, toasts). Form
fields (Phase 3) unblock the booking/handover/entitlement/policy screens. Data-display (Phase 4)
unblocks registries, inbox, fines. Charts (Phase 5) unblock the executive + command-console screens.
Phase 6 hardens quality and rolls the library into the existing screens.
