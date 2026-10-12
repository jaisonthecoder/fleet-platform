# Component library

Everything exported from `src/design-system`, with exact props.

**Import from the barrel**, not the file:

```ts
import { Button, DataGrid, StatePanel } from '@/design-system';
```

---

## 1. Layout of the package

```
src/design-system/
├── index.ts          the public surface — import from here
├── utils.ts          cn(...inputs) = twMerge(clsx(inputs))
├── components/       15 .tsx + 11 .module.css — the Noatum components
├── primitives/       12 .tsx — shadcn/Radix wrappers, mostly unstyled
└── styles/           tokens.css, base.css, foundation.css, fonts.css (dead)
```

Two styling strategies coexist:

- **CSS Modules** — `Button`, `Code`, `DateValue`, `Footer`, `Header`,
  `InfoRibbon`, `Input`, `NewsCard`, `SectionHeading`, `Select`, `StatCounter`,
  `Tabs`. `Input` and `Select` share `Field.module.css`.
- **Global `noa-*` classes** from `foundation.css` — `Controls`, `DataGrid`,
  `DataTable`, `DataView`, `Drawer`, `ComboInput`.

Only `dropdown-menu` is re-exported from `primitives/` through the barrel.
Everything else in `primitives/` is importable by path only.

---

## 2. Buttons

### `Button`

`ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>`

| Prop | Type | Default |
|---|---|---|
| `variant` | `'primary' \| 'outline' \| 'quiet'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `loading` | `boolean` | `false` |
| `fullWidth` | `boolean` | `false` |
| `iconLeft` / `iconRight` | `ReactNode` | — |
| `iconOnly` | `boolean` | `false` |
| `type` | inherited | `'button'` |

Heights come from tokens: `sm` = `--noa-control-height-compact` (32px),
`md` = `--noa-control-height` (38px), `lg` = `--noa-touch-target` (44px).
`iconOnly` makes width equal height.

- Sets `aria-busy` when loading, and `disabled = disabled || loading`.
- While loading, `iconLeft` is replaced by a spinner and `iconRight` is dropped.
- **`iconOnly` requires the caller to pass `aria-label`.**

> This is **not** `primitives/button.tsx`. The shadcn one carries Tailwind
> (`h-9 px-4 shadow hover:bg-accent`) that fights the brand stylesheet. The
> primitive is kept only for `asChild` cases.

---

## 3. Fields

All three field components generate their own `id` via `useId()` — you cannot
pass one. `className` lands on the **wrapper**, not the control.

### `Input`

`InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>`

| Prop | Type | Default |
|---|---|---|
| `label` | `string` | **required** |
| `error` | `string` | — |
| `hint` | `string` | — |
| `labelHidden` | `boolean` | `false` |

`label` is required by the type: a placeholder is not a label. `labelHidden`
applies `.noa-visually-hidden` — the label still exists for assistive tech.

Sets `aria-invalid` when `error`, `aria-describedby` pointing at the hint or
error, and `role="alert"` on the error paragraph. The hint is hidden while an
error is showing.

### `Select`

`SelectProps extends ComponentPropsWithoutRef<typeof SelectRoot>` (Radix).

| Prop | Type | Default |
|---|---|---|
| `label` | `string` | **required** |
| `options` | `SelectOption[]` | **required** |
| `error` / `hint` / `placeholder` | `string` | — |
| `labelHidden` | `boolean` | `false` |

`SelectOption` = `{ value: string; label: string; disabled?: boolean }`.

> **Behavioural trap.** With no `placeholder`, `defaultValue` falls back to the
> first enabled option — the select is never empty. Pass a `placeholder` if you
> need "nothing chosen" to be a real state.

`forwardRef` targets the trigger button. Content is portalled and carries
`.noa-select-content`.

### `ComboInput`

`Omit<InputProps, 'list'> & { options: string[] }`

A native `<datalist>` attached to an `Input`. The browser supplies filtering,
keyboard and screen-reader semantics. **Free text is always accepted** —
suggestions never constrain. The datalist is omitted entirely when `options` is
empty.

---

## 4. Content and display

### `Code`

`{ children: ReactNode; tone?: 'strong' | 'muted'; className?: string }`

Forces `--noa-font-mono`. Use for any identifier a human compares character by
character — CW1 organisation codes, slugs, references.

### `DateValue`, `formatDate`, `formatTime`

```ts
formatDate(value: string | null | undefined): string | null   // DD.MM.YYYY
formatTime(value: string | null | undefined): string | null   // HH:mm, 24h
```

| Prop | Type | Default |
|---|---|---|
| `value` | `string \| null \| undefined` | **required** |
| `withTime` | `boolean` | `false` |
| `absent` | `string` | `'—'` |

A bare `YYYY-MM-DD` is parsed as UTC so it cannot shift a day across the date
line; a full timestamp stays in the viewer's zone. Renders `<time dateTime>` and
uses tabular figures so date columns line up. `formatTime` returns `null` for a
date-only value.

**This is the only correct way to render a date.** The brand format is
`DD.MM.YYYY` everywhere.

### `SectionHeading`

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | **required** |
| `description` | `string` | — |
| `actions` | `ReactNode` | — |
| `as` | `'h1' \| 'h2' \| 'h3'` | `'h2'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |

Heading level and visual size are **independent**: `as` is the document outline,
`size` is appearance. Never pick a level for its looks.

### `StatCounter`

| Prop | Type | Default |
|---|---|---|
| `label` | `string` | **required** |
| `value` | `string \| number` | **required** — pre-formatted by the caller |
| `delta` | `string` e.g. `"+12%"` | — |
| `deltaDirection` | `'up' \| 'down' \| 'flat'` | `'flat'` |
| `icon` | `ReactNode` | — |
| `loading` | `boolean` | `false` |
| `onClick` | `() => void` | — |

Renders a `<button>` when `onClick` is given, otherwise a `<div>`.
`aria-busy` is set **only** on the non-clickable variant.

### `NewsCard`

| Prop | Type |
|---|---|
| `title` | `string` **required** |
| `excerpt` | `string` — plain text, never HTML |
| `publishedAt` | `Date \| null` |
| `publishedLabel` | `string` — pre-formatted |
| `tag` | `string` |
| `href` | `string` |
| `onClick` | `() => void` |
| `media` | `ReactNode` |

The root element switches: `href` → `<a>`, else `onClick` → `<button>`, else
`<article>`. `href` wins. This is deliberate so middle-click and keyboard
behave correctly for each case.

### `InfoRibbon`

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | **required** |
| `label` | `string` — trigger accessible name | **required** |
| `closeLabel` | `string` | **required** |
| `heading` | `ReactNode` | — |
| `defaultOpen` | `boolean` | `false` |

Uncontrolled disclosure. Trigger carries `aria-expanded` and `aria-controls`;
the panel is `role="note"`. **Content is unmounted while closed**, so assistive
tech never announces hidden help.

---

## 5. Chrome

### `Header`

| Prop | Type | Default |
|---|---|---|
| `logo` | `ReactNode` | **required** |
| `productName` | `string` | — |
| `nav` | `ReactNode` | — |
| `actions` | `ReactNode` | — |
| `impersonationNotice` | `ReactNode` | — |
| `width` | `'measure' \| 'full'` | `'measure'` |

`width="full"` is what the customer shell uses to run edge to edge.

> **The `nav` slot is hidden below 768px.** Anything that must survive on a
> phone — a mobile menu button, for instance — belongs in `actions`.

### `Footer`

| Prop | Type | Default |
|---|---|---|
| `copyright` | `string` — already localised and year-substituted | **required** |
| `links` | `FooterLink[]` | `[]` |
| `version` | `string` | — |
| `children` | `ReactNode` | — |

`FooterLink` = `{ label: string; href: string; external?: boolean }`. External
links get `target="_blank" rel="noopener noreferrer"`.

---

## 6. Overlays and controls (`Controls.tsx`)

Radix-backed, Noatum-skinned. Portalling, focus trapping and Escape handling
come from Radix.

| Export | Notes |
|---|---|
| `Dialog`, `DialogTrigger`, `DialogClose`, `DialogTitle`, `DialogDescription` | Direct Radix aliases |
| `DialogContent` | **`closeLabel: string` required.** `side?: 'left' \| 'right'` turns it into a side sheet; omit for a centred modal |
| `Checkbox` | `label: string` required + Radix `Checkbox.Root` props |
| `Switch` | Same shape as `Checkbox` |
| `Tooltip` | `label: string`, `children`. Creates its own provider, `delayDuration={250}` |
| `TabGroup` / `TabList` / `Tab` / `TabPanel` | Radix tabs; arrow keys, Home/End and roving tabindex come free |
| `Badge` | `tone?: 'neutral' \| 'info' \| 'error' \| 'success' \| 'warning'`, default `neutral` |
| `StatePanel` | `{ title: string; children?: ReactNode; action?: ReactNode }` — the shared loading / empty / error block, class `.noa-state` |

A side sheet is a workspace, not a card: the sheet is the page tint and white
blocks inside it separate one group of fields from the next.

### Drawer parts

`DrawerHeader`, `DrawerBody`, `DrawerFooter`, `DrawerWide` each take
`{ children: ReactNode; className?: string }` and render a `<div>` with the
matching `noa-drawer-*` class.

`DrawerCard` adds `title?`, `ariaLabel?` (falls back to `title`) and
`columns?: 1 | 2` (default `1`). Renders `<section aria-label=…>`; the two-column
field grid is applied only when `columns === 2`.

---

## 7. Data display

### `DataTable`

| Prop | Type |
|---|---|
| `caption` | `string` **required** |
| `columns` | `TableColumn<Row>[]` **required** |
| `rows` | `Row[]` **required** |
| `rowKey` | `(row: Row) => string` **required** |
| `sort` | `{ key: string; direction: 'ascending' \| 'descending' }` |
| `onSort` | `(key: string) => void` |

`TableColumn<Row>` = `{ key: string; label: string; render: (row: Row) => ReactNode; sortable?: boolean }`.

The scroll container is `role="region"` + `aria-label={caption}` + `tabIndex={0}`
so a keyboard user can reach a horizontally scrolling table. The `<caption>` is
visually hidden. `aria-sort` appears only on the active column. A header is
inert unless **both** `sortable` and `onSort` are supplied.

### `Pagination`

Required: `label`, `page`, `pageCount`, `previousLabel`, `nextLabel`,
`onPageChange`. Optional: `rangeLabel`, `pageSize`, `pageSizeLabel`,
`pageSizeOptions` (default `[8, 16, 32]`), `onPageSizeChange`, `lastLabel`.

The range is `aria-live="polite"`; the progress bar is `aria-hidden`; every icon
button carries an `aria-label`.

### `DataView` parts

Composition pieces, all used internally by `DataGrid`. Reach for them only when
building a listing that `DataGrid` cannot express.

| Export | Purpose |
|---|---|
| `CountedTabs` | Tab strip with counts; each tab's accessible name includes the count |
| `ListingToolbar` | Search + filter trigger + grid/cards switch + `actions` slot |
| `FilterDrawer` | Right-hand sheet; **returns focus to the trigger** via `returnFocus` |
| `FilterSection` | Native `<details>`/`<summary>` group |
| `FilterChip` | Removable applied-filter pill |
| `RouteCell` | Origin → progress → destination cell for shipment tables |

---

## 8. `DataGrid` — the shared listing

One component for every list screen: search, filters, tabs, grid/cards,
pagination, and all four states. Use it rather than assembling a table.

For product screens prefer **`ListingGrid`** (`src/shared/components/`), which
wraps `DataGrid` and fills the ~30 chrome labels from the default i18n
namespace, so a caller supplies only what is specific to the screen.

### Types

```ts
type DataGridFilter =
  | { kind: 'choice'; key: string; title: string; multiple?: boolean;
      options: { value: string; label: string; count?: number }[] }
  | { kind: 'dateRange'; key: string; title: string }
  | { kind: 'text';      key: string; title: string };

type DataGridFilterValues = Record<string, string | string[] | undefined>;
type DataGridTab = { value: string; label: string; count: number };
```

### Props

**Data** — `caption`, `columns`, `rows`, `rowKey`, `total` (the **server** total,
not `rows.length`).

**Paging** — `page`, `pageSize`, `onPageChange`, optional `onPageSizeChange` and
`pageSizeOptions` (default `[25, 50, 100]`).

**Search** — `search`, `onSearchChange`, `searchDelay` (default `300` ms; `0`
fires on every keystroke).

**Sort** — `sort`, `onSort`.

**Filters** — `filters` (default `[]`), `filterValues` (default `{}`),
`onFilterChange`.

**Tabs** — `tabs`, `tab`, `onTabChange`. All three are required together.

**View** — `view`, `onViewChange` (uncontrolled, internal default `'grid'`),
`renderCard` (defaults to the first four columns), `showSearch`,
`showViewSwitcher`.

**State** — `isPending`, `isFetching`, `error`, `onRetry`.

**Chrome** — `actions`, and `labels: DataGridLabels` (required; ~24 strings plus
five functions: `selectedCount`, `removeFilter`, `page`, `showing`,
`resultCount`).

### Behaviour worth knowing

- **Debounced search.** Outside changes to `search` are adopted; the component's
  own echo is ignored; the timer is cleared on unmount.
- **The filter drawer is draft-based.** Edits go to local state; only **Apply**
  calls `onFilterChange`. Apply is disabled while any date range is invalid
  (`from > to`).
- **Focus returns to the filter trigger** when the drawer closes.
- **Result count is announced politely**, suppressed on the first settled render
  so it never talks over page load.
- Date ranges are stored as two keys: `${key}From` and `${key}To`.
- `countFilters` counts each selected **value**, so two countries read as two
  filters.
- Body precedence: `error` → `isPending` → empty → cards → table. Pending
  renders `Math.min(pageSize, 8)` skeleton blocks.
- Page count is capped at 10 000.

---

## 9. `primitives/`

shadcn/ui files with most Tailwind stripped in favour of `noa-*` globals.

| File | Wraps | Notes |
|---|---|---|
| `badge.tsx` | — | All `cva` variants map to empty strings; styling comes from `noa-badge-*` |
| `button.tsx` | `@radix-ui/react-slot` | Full stock shadcn variants. **Unused** by `components/Button` — kept for `asChild` |
| `checkbox.tsx` | `@radix-ui/react-checkbox` | |
| `dialog.tsx` | `@radix-ui/react-dialog` | `DialogContent` requires `closeLabel` |
| `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | The only primitive re-exported from the barrel |
| `input.tsx` | — | Plain `<input>` |
| `label.tsx` | `@radix-ui/react-label` | |
| `select.tsx` | `@radix-ui/react-select` | `position="popper"` by default |
| `switch.tsx` | `@radix-ui/react-switch` | |
| `table.tsx` | — | Wraps `<table>` in its own overflow div — which nests inside `DataTable`'s scroller |
| `tabs.tsx` | `@radix-ui/react-tabs` | Deliberately unstyled; consumers own appearance |
| `tooltip.tsx` | `@radix-ui/react-tooltip` | |

---

## 10. Cross-cutting facts

**Every variant union in the package**

```
Button.variant        primary | outline | quiet
Button.size           sm | md | lg
Code.tone             strong | muted
Badge.tone            neutral | info | error | success | warning
SectionHeading.as     h1 | h2 | h3
SectionHeading.size   sm | md | lg
Header.width          measure | full
StatCounter.delta…    up | down | flat
DrawerCard.columns    1 | 2
DialogContent.side    left | right
view                  grid | cards
sort.direction        ascending | descending
DataGridFilter.kind   choice | dateRange | text
```

**`forwardRef`** — `Button` (button), `Input` (input), `Select` (trigger button),
`DialogContent`, and most primitives.

**`useId()`** — `Input`, `Select`, `ComboInput`, `InfoRibbon`, `Checkbox`,
`Switch`.

**Portalled** — dialog and sheet content, dropdown menus, select content,
tooltips.

**The only debounce in the package** is `DataGrid`'s search.

### Hard-coded English

Three strings do not go through i18n and should be treated as defects if a
Spanish build is reviewed:

| Location | String |
|---|---|
| `Footer.tsx` | `aria-label="Footer"` |
| `Header.tsx` | `aria-label="Main"` |
| `DateValue.tsx` | `absent` default `'—'` |

Everything else takes its text through props.

---

## 11. Adding a component

1. Does `DataGrid`, `StatePanel` or an existing component already do it? Most
   "new" listings are `ListingGrid` with different columns.
2. Put it in `components/` with a `.module.css`, or use `noa-*` globals if it is
   a composition piece.
3. Tokens only — no hex, no `font-family`, no literal `border-radius`.
4. Strings arrive as props. The design system never calls `useTranslation`.
5. Export it, with its props type, from `index.ts`.
6. Every `var()` you write must resolve, or the unit suite fails (see
   `10-testing.md` §3.2).
