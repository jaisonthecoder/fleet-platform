# Sections Catalog

The `/ui-kit` showcase page renders 10 sections in this order. Every section maps to one or more shadcn primitives from the live catalog at https://ui.shadcn.com/docs/components.

shadcn ships 57 components (as of catalog snapshot 2026-05-01). This catalog assigns each one to a section and notes the install command.

CLI install syntax (use the project's package manager — pnpm shown):

```bash
pnpm dlx shadcn@latest add <component>
```

`shadcn add` writes the component file into `components/ui/` and adds any required deps to `package.json`. **Re-running `shadcn add` overwrites the file** — always inventory first.

---

## Section 1 — Foundations

No shadcn primitives. Hand-authored in `app/ui-kit/sections/foundations.tsx`.

What renders:
- Color swatches: brand (primary, secondary, accent), neutrals (50–950), semantic (success, warning, destructive, info) — each with hex value, token name, and WCAG contrast ratio against `--background` and `--card`.
- Typography scale: every level (display, h1–h6, lead, body, body-bold, body-small, caption, code) with the resolved font family and weight rendered live.
- Spacing scale: 0–24 stops shown as horizontal bars at the actual pixel width.
- Radius scale: sm / md / lg / xl / full as solid color squares.
- Shadow scale: sm / md / lg / xl as cards.
- Motion: each duration + easing demoed on a Toggle button.
- Iconography: 12 representative Lucide icons in 4 sizes.

This section is the "did the tokens land correctly?" smoke test. If Foundations looks wrong, nothing else will look right.

---

## Section 2 — Forms & Controls

| shadcn component | Install | Notes |
|---|---|---|
| Input | `add input` | Base text input |
| Input Group | `add input-group` | Compound input with addons |
| Input OTP | `add input-otp` | OTP / verification code input |
| Native Select | `add native-select` | HTML `<select>` with shadcn styling |
| Select | `add select` | Radix Select; replaces native for searchable / styled lists |
| Combobox | `add combobox` | Combobox built on `command` |
| Textarea | `add textarea` | Resizable text area |
| Checkbox | `add checkbox` | Single checkbox |
| Radio Group | `add radio-group` | Grouped radios |
| Switch | `add switch` | Toggle on/off |
| Slider | `add slider` | Range slider |
| Calendar | `add calendar` | Calendar primitive (under-the-hood for Date Picker) |
| Date Picker | `add date-picker` | Calendar + Popover composition |
| Field | `add field` | Field wrapper — label + control + description + error |
| Label | `add label` | Standalone label |
| Form *(legacy alias of Field)* | — | Use `Field` for new code |

Showcase requirements: every control rendered in default / hover / focus / disabled / error / loading-where-applicable states. Field renders all four slots filled.

---

## Section 3 — Buttons & Actions

| shadcn component | Install | Notes |
|---|---|---|
| Button | `add button` | Variants: default, outline, ghost, destructive, secondary, link. Sizes: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg. |
| Button Group | `add button-group` | Segmented / connected buttons |
| Toggle | `add toggle` | Pressable two-state button |
| Toggle Group | `add toggle-group` | Single or multi-select group of toggles |
| Kbd | `add kbd` | Keyboard shortcut chip |

Showcase requirements: Button rendered in **all 6 variants × all 8 sizes × all 5 states** (default / hover / focus / disabled / loading) — that's the matrix. Toggle and ToggleGroup shown with both `single` and `multiple` selectionType.

---

## Section 4 — Data Display

| shadcn component | Install | Notes |
|---|---|---|
| Avatar | `add avatar` | Image + fallback |
| Badge | `add badge` | Status / category pill. Variants: default, secondary, destructive, outline. |
| Card | `add card` | Header / content / footer slots |
| Separator | `add separator` | Horizontal / vertical divider |
| Item | `add item` | Compound list-row primitive (icon + content + actions) |
| Table | `add table` | Base HTML table primitive |
| Data Table | `add data-table` | Composed with TanStack Table — sortable, filterable, paginated |
| Chart | `add chart` | Recharts wrapper with token-aware styling |

Patterns shown in showcase:
- Stat card (Card + large number + Badge for delta + Separator)
- DataList (Item × N)
- Tag pile (Badge × N with `variant="outline"`)
- Table with pagination + sort
- One representative bar chart, one line chart, one pie chart

---

## Section 5 — Feedback

| shadcn component | Install | Notes |
|---|---|---|
| Alert | `add alert` | Inline banner. Variants: default, destructive. |
| Sonner | `add sonner` | Toast system (replaces deprecated `toast`) |
| Progress | `add progress` | Determinate progress bar |
| Skeleton | `add skeleton` | Loading placeholder |
| Spinner | `add spinner` | Indeterminate spinner |
| Empty | `add empty` | Empty-state compound (icon + title + description + action) |

Patterns shown: success / warning / destructive / info Alert; Sonner toast triggered by button; Progress at 0/30/70/100; three Skeleton layouts (text block, card, table row); Spinner at all sizes; Empty with and without action.

---

## Section 6 — Overlays

| shadcn component | Install | Notes |
|---|---|---|
| Dialog | `add dialog` | Modal dialog |
| Alert Dialog | `add alert-dialog` | Confirm / destructive dialog with required acknowledgement |
| Sheet | `add sheet` | Side-drawer (top, right, bottom, left) |
| Drawer | `add drawer` | Vaul-based drawer (mobile-first slide-up) |
| Popover | `add popover` | Anchored floating panel |
| Hover Card | `add hover-card` | Hover-triggered popover |
| Tooltip | `add tooltip` | Short text on hover |
| Dropdown Menu | `add dropdown-menu` | Menu with nested items, checkboxes, radios |
| Context Menu | `add context-menu` | Right-click menu |
| Menubar | `add menubar` | App-style menu bar (File / Edit / View) |
| Command | `add command` | Command palette (powers Combobox) |

Showcase requirements: each rendered with a trigger button and at least one nested item / action. Tooltip and HoverCard demoed with both keyboard-focus and mouse-hover entry.

---

## Section 7 — Navigation

| shadcn component | Install | Notes |
|---|---|---|
| Tabs | `add tabs` | Horizontal or vertical tabs |
| Breadcrumb | `add breadcrumb` | Page-path crumbs |
| Pagination | `add pagination` | Page-number nav with prev/next |
| Navigation Menu | `add navigation-menu` | Top-bar nav with mega-menu support |
| Sidebar | `add sidebar` | Full sidebar primitive (collapsible, mobile sheet) |
| Direction | `add direction` | LTR/RTL provider |

Showcase requirements: Tabs in both orientations; Breadcrumb with 3 levels; Pagination at page 1, 5, last; NavigationMenu with at least one mega-menu trigger; Sidebar in expanded + collapsed state. The Direction provider wraps the whole `/ui-kit` page when RTL is enabled.

---

## Section 8 — Disclosure

| shadcn component | Install | Notes |
|---|---|---|
| Accordion | `add accordion` | Single or multiple expanded panels |
| Collapsible | `add collapsible` | Single show/hide region |

Showcase requirements: Accordion in `single` (default) and `multiple` modes; Collapsible with text content + nested controls.

---

## Section 9 — Layout

| shadcn component | Install | Notes |
|---|---|---|
| Aspect Ratio | `add aspect-ratio` | Fixed-ratio container |
| Scroll Area | `add scroll-area` | Custom-styled scroll container |
| Resizable | `add resizable` | Resizable panel groups (PanelGroup / Panel / Handle) |
| Carousel | `add carousel` | Embla-based slide carousel |

Hand-authored layout primitives in `components/ui/` (no shadcn equivalent — keep simple):
- `Container` — width-capped wrapper using `--space-*` tokens
- `Stack` — vertical or horizontal flex with token-driven gap
- `Grid` — CSS grid wrapper with column / gap props

Showcase requirements: AspectRatio at 16:9 / 4:3 / 1:1; ScrollArea with both horizontal and vertical overflow; Resizable two-pane and three-pane horizontal; Carousel with 4 slides and dots.

---

## Section 10 — Patterns (composed)

No shadcn primitives — these are *compositions* the kit ships so feature work has a starting point. Each lives at `components/ui/patterns/<name>.tsx`.

| Pattern | Composed from | Use case |
|---|---|---|
| **PageHeader** | Typography + Breadcrumb + Button | Top of every detail page |
| **Toolbar** | Button + Separator + ToggleGroup + DropdownMenu | Action strip above tables / lists |
| **ConfirmDialog** | AlertDialog + Button | "Are you sure?" with destructive variant |
| **FilterBar** | Input + Select + Button + Badge | Table / list filters with active-filter chips |
| **EmptyResults** | Empty + Button | Search / filter returned nothing |
| **AppShell** | Sidebar + NavigationMenu + slot | App-level layout with collapsible sidebar |
| **DataTablePage** | PageHeader + Toolbar + DataTable + Pagination | Full table-page composition |
| **FormPage** | PageHeader + Card + Field × N + Button | Standard create / edit form |

Showcase requirements: each pattern rendered with realistic placeholder data so a developer can see "this is what it looks like wired up."

---

## Section count discipline

- **Always 10 sections, always in this order.** A `/ui-kit` page that re-orders or omits a section confuses every developer using it.
- **A new shadcn component goes into the right section, not a new section.** If a future shadcn release adds (say) a `MultiSelect`, it joins Section 2 — the section count stays at 10.
- **Patterns grow over time.** Section 10 is the only section that can have new entries added without spec change.

---

## Component count audit

| Section | Component count |
|---|---|
| 1. Foundations | 0 (hand-authored) |
| 2. Forms & Controls | 16 |
| 3. Buttons & Actions | 5 |
| 4. Data Display | 8 |
| 5. Feedback | 6 |
| 6. Overlays | 11 |
| 7. Navigation | 6 |
| 8. Disclosure | 2 |
| 9. Layout | 4 (+ 3 hand-authored) |
| 10. Patterns | 8 (composed) |
| **Total shadcn components covered** | **58** |

Note: total exceeds the live catalog's 57 because `Form` is treated as a legacy alias of `Field` and not separately installed. Audit against the live catalog quarterly — when the count drifts, update this catalog.
