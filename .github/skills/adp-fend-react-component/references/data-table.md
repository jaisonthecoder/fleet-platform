# Data Tables

AD Ports apps are heavy on tables — vessels, bookings, manifests, customs declarations. Tables are not "just rows of data"; they have specific best practices around performance, accessibility, RTL, and reusability.

## Standard

**TanStack Table v8** is the AD Ports default for any non-trivial table. Reasons:

- Headless — works with any UI primitive (in our case, the shadcn `Table` family).
- Strong TypeScript ergonomics; columns are typed against the row type.
- Built-in sorting, filtering, pagination, row selection, expansion, column visibility — without you re-implementing them.

For trivial tables (≤ 20 fixed rows, no sort, no filter), a plain `<Table>` from `@shared/ui/table` is fine.

## Reuse, do not recreate (table edition)

Before building a table:

- The base table primitives (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`) live in `@shared/ui/table`. Import from there. Do not re-style raw `<table>` elements in features.
- The shared `<DataTable />` wrapper (TanStack-Table-bound, columns prop, pagination prop) lives in `@shared/ui/data-table`. Most feature tables consume this — they do not redo column rendering, sort UI, or pagination by hand.
- A feature table renders **column definitions and a row type**, not table HTML.

If `@shared/ui/data-table` does not yet exist in the app, build it once in shared, not per feature. After two features have a table, the shared wrapper is mandatory.

## Column definitions

- Define columns in `features/<feature>/components/<feature>-table.columns.ts` — separate from the rendering component. Keeps the column array stable (avoid re-creating it on every render — TanStack memoizes by reference).
- Each column has a stable `id` (use the field key by default; avoid relying on header text).
- `accessorFn` over `accessorKey` when the cell value is derived (joined fields, formatted strings) — keep formatting in the cell renderer, not in the accessor.
- `header` and `cell` go through `t()` and the design-system primitives (`<Icon />`, `<Badge>`, etc.). Never inline JSX strings.

## Sorting

- Use TanStack's built-in sorting state. Persist sort to the URL via `useTypedSearchParams` so links and back/forward work.
- Column-level `enableSorting: false` for columns that are derived or not meaningfully orderable (e.g. action columns, computed totals when the dataset is paginated).
- Sort indicators in the header: use the `<Icon name="chevron-up" />` / `<Icon name="chevron-down" />` from the icon registry. **Mirror in RTL** via `mirrorInRTL` or by swapping which direction means asc.
- Server-side sort (sets `manualSorting: true`) when the table is paginated — the server returns sorted slices; the client only renders.

## Filtering

- Filters live above the table, not in column headers, unless the column header is the natural place (e.g. status pill column with a small filter chip).
- Filter state lives in the URL (`useTypedSearchParams`) — same reason as sort.
- Server-side filtering for paginated tables; client-side only when the full dataset is in memory.

## Pagination

- Default to **server-side pagination** (`manualPagination: true`). Client-side only for known-small datasets.
- Page size choices: 10 / 25 / 50 / 100 by default. Persist the user's choice in localStorage keyed by table id (so users don't reset on every visit).
- Show total count when the API provides it. Don't fake "Page X of ?" — show "Page X · 25 per page" if the count isn't known.
- Keyboard: page-up / page-down navigates pages; Home / End jump to first / last.

## Virtualization

- Required when row count routinely exceeds ~200 visible rows (or the table is the primary content of a page and scrolling lags).
- Use **TanStack Virtual** alongside TanStack Table — they pair without surprises.
- Fix row heights when possible; dynamic-height virtualization is an order of magnitude harder.
- Virtualization changes how screen readers announce — verify with NVDA / VoiceOver after enabling.

## Row selection

- Use TanStack's built-in selection state.
- Selection persists across pagination only when the API supports "select all matching filters" — otherwise selection is per-page and the user is told so explicitly.
- Bulk action buttons appear in a sticky bar above the table when ≥ 1 row is selected. Disabled state when zero selected; never hide.
- Keyboard: `Shift+Click` for ranges, `Space` to toggle the focused row, `Cmd/Ctrl+A` to select all on the current page.

## RTL

- Column order does **not** flip in RTL. The first column is still the first column visually — it's the column the user reads first in their reading order.
- Sort icons mirror via `mirrorInRTL`.
- Pagination controls (Prev / Next) mirror visually: in RTL, "Next" points left. Use direction-aware icons (`chevron-right` with `mirrorInRTL`) or swap the icon by direction.
- Sticky-column shadows: verify the shadow falls on the correct side under `dir="rtl"`.

## Accessibility

- Wrap with a `<table>` (the shadcn `Table` primitive does this) — never reach for `role="grid"` unless you are building a true editable spreadsheet.
- `<caption>` (visually hidden) describes what the table contains. Screen-reader users hit this first.
- `<th scope="col">` / `<th scope="row">` set on header cells — required for screen-reader navigation.
- Sortable column headers are `<button>` inside `<th>` so they are reachable by keyboard.
- Interactive cells (action menus, inline edits) are reachable by Tab and the focus-visible style is unmistakable.
- Selection announcements: when a row is selected, an `aria-live="polite"` region announces "Row X selected, Y total selected."

## Empty / loading / error states

- Loading: skeleton rows that match the column layout (not a centered spinner that destroys the layout).
- Empty: `EmptyState` primitive (see `references/react-architecture.md` §UI states) inside the table body, spanning all columns. Include an action ("Clear filters") when the empty result is filter-driven.
- Error: `ErrorState` primitive with retry. Spans all columns.

## Performance

- Memoize the column array. A new column reference re-creates the table instance.
- Avoid inline `cell: ({ row }) => <ComplexComp />` for hot rows — extract to a named component and `React.memo` it.
- Server-paginate above ~500 rows. Client-side filtering of 10k rows is the wrong solution.
- Don't put queries inside cells. The data is already loaded; the cell renders, that's it.

## Anti-patterns

See `references/anti-patterns.md` §Tables for the canonical list (rejection-citable).
