import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  CountedTabs,
  FilterChip,
  FilterDrawer,
  FilterSection,
  ListingSegments,
  ListingToolbar,
  pipelineTone,
} from './DataView';
import { DataTable, Pagination, type TableColumn } from './DataTable';
import { Checkbox, StatePanel, TabGroup, TabPanel } from './Controls';
import { Button } from './Button';
import { Input } from './Input';

/* ────────────────────────────────────────────────────────────────────────────
 * One listing for the whole product.
 *
 * The component workspace already proved this composition - search, a filter
 * drawer that applies on confirmation, removable chips, counted tabs, grid and
 * card views, and pagination that carries its own page size. It lived only in
 * the development workspace, so every real screen hand-rolled a worse version.
 * This is that composition, with a server-driven data source instead of a
 * sample array.
 *
 * It is a design-system component, so every string arrives as a prop: the
 * customer-facing quote, booking and tracking listings use a different i18n
 * namespace from the administration screens and must be able to use this too.
 * Features wrap it with their own namespace rather than reaching in.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface DataGridFilterOption {
  value: string;
  label: string;
  /** Shown beside the option. Omit when the server cannot supply a facet count. */
  count?: number;
}

export type DataGridFilter =
  /**
   * `multiple` is deliberately opt-in: most list endpoints accept one value per
   * filter today, and a multi-select that silently sends only the last choice is
   * worse than a single-select that says what it does.
   */
  | { kind: 'choice'; key: string; title: string; multiple?: boolean; options: DataGridFilterOption[] }
  | { kind: 'dateRange'; key: string; title: string }
  | { kind: 'text'; key: string; title: string };

/** Applied filter state. Arrays only ever appear for `multiple` choice filters. */
export type DataGridFilterValues = Record<string, string | string[] | undefined>;

export interface DataGridTab {
  value: string;
  label: string;
  count: number;
}

export interface DataGridLabels {
  search: string;
  filters: string;
  filterTitle: string;
  filterDescription: string;
  apply: string;
  clearAll: string;
  close: string;
  any: string;
  selectedCount: (count: number) => string;
  removeFilter: (label: string) => string;
  customRange: string;
  dateFrom: string;
  dateTo: string;
  invalidDateRange: string;
  view: string;
  grid: string;
  cards: string;
  loading: string;
  empty: string;
  emptyFiltered: string;
  error: string;
  retry: string;
  previous: string;
  next: string;
  lastPage: string;
  rows: string;
  /** "Page 2 of 7" */
  page: (page: number, count: number) => string;
  /** "Showing 26-50 of 312" */
  showing: (first: number, last: number, total: number) => string;
  /** Announced politely after a filter or search changes the result count. */
  resultCount: (total: number) => string;
  /** Names the saved-view pills, e.g. "Saved views". */
  views?: string;
  /** "3 selected" */
  selectedRows?: (count: number) => string;
  /** Empties the selection. */
  clearSelection?: string;
}

export interface DataGridProps<Row> {
  /** Accessible name for the table and its scroll region. */
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Server-reported total across all pages, not `rows.length`. */
  total: number;

  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];

  /**
   * The applied search term - the one the server has already answered. The field
   * keeps its own in-progress value, so typing stays instant while the request
   * waits for a pause.
   */
  search: string;
  onSearchChange: (search: string) => void;
  /**
   * How long to wait after the last keystroke before asking the server. Searching
   * is a server round trip on every list in this product, so a request per
   * character would put eight in flight for "Valencia" and answer with whichever
   * returned last. Set 0 to search on every keystroke.
   */
  searchDelay?: number;

  /** Omit both to leave headers inert - the API cannot sort yet on some lists. */
  sort?: { key: string; direction: 'ascending' | 'descending' };
  onSort?: (key: string) => void;

  filters?: DataGridFilter[];
  filterValues?: DataGridFilterValues;
  onFilterChange?: (values: DataGridFilterValues) => void;

  tabs?: DataGridTab[];
  tab?: string;
  onTabChange?: (tab: string) => void;

  view?: 'grid' | 'cards';
  onViewChange?: (view: 'grid' | 'cards') => void;
  /**
   * Card body for the narrow view. Omit and the grid builds one from the first
   * four columns, so every listing gets a card view without extra work.
   */
  renderCard?: (row: Row) => ReactNode;
  /** Hide the list-local search when discovery happens through another workflow. */
  showSearch?: boolean;
  /** Hide the view chooser when a screen has one deliberate presentation. */
  showViewSwitcher?: boolean;
  /**
   * Hide the filter drawer's trigger. For a screen whose filtering lives
   * somewhere more visible - the quotation listings put the status filter in the
   * hero's pipeline band, where it is also the picture of the list.
   */
  showFilters?: boolean;

  /**
   * Saved views, as pills in the toolbar. A different question from `tabs`: a tab
   * divides the list into parts that add up to it, a saved view is one query
   * somebody runs often. A screen may have both.
   */
  segments?: DataGridTab[];
  segment?: string;
  onSegmentChange?: (segment: string) => void;

  /**
   * Something OUTSIDE this grid is narrowing the list - a pipeline band in the
   * page's hero, a saved view, a link that arrived with a filter on it.
   *
   * Without this the empty state cannot tell "you have no quotations" from "the
   * segment you picked has none", and it said the first while the band above it
   * was showing ten. The grid cannot see that filter, so the page has to say.
   */
  isFiltered?: boolean;
  /** Clears those outside filters. Called alongside the grid's own reset. */
  onClearFilters?: () => void;

  /**
   * The rail down the left of each row, as a pipeline tone key. Repeats what the
   * status column says, on purpose: it is what lets somebody find the rows that
   * need them without reading a word.
   */
  rowTone?: (row: Row) => string | undefined;
  /** How wide the grid must be before it scrolls sideways, e.g. "1180px". */
  rowMinWidth?: string;

  /**
   * Row selection and the bar that appears when something is selected. Selection
   * is by row key and stays with the caller, because what can be done with three
   * quotes is a question about quotes, not about grids.
   */
  selection?: {
    label: string;
    rowLabel: (row: Row) => string;
    selected: string[];
    onChange: (keys: string[]) => void;
    /** The buttons in the bar. Rendered only while something is selected. */
    actions?: ReactNode;
  };

  /** First load only. With `keepPreviousData` this is false on later pages. */
  isPending?: boolean;
  /**
   * A refresh behind an already-rendered page. The table deliberately does not
   * move or flicker for this - it only says so, so assistive technology knows the
   * figures are being replaced.
   */
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;

  /** Primary action for this listing, e.g. "Create customer". Sits after the filters. */
  actions?: ReactNode;

  labels: DataGridLabels;
}

const isEmptyValue = (value: string | string[] | undefined) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** Counts every applied value, so two selected countries read as two filters. */
function countFilters(values: DataGridFilterValues): number {
  return Object.values(values).reduce<number>(
    (total, value) =>
      total + (Array.isArray(value) ? value.length : isEmptyValue(value) ? 0 : 1),
    0,
  );
}

/** A date range is stored as two keys, so it validates as a pair. */
const fromKey = (key: string) => `${key}From`;
const toKey = (key: string) => `${key}To`;

function invalidRanges(filters: DataGridFilter[], values: DataGridFilterValues): boolean {
  return filters.some((filter) => {
    if (filter.kind !== 'dateRange') return false;
    const from = values[fromKey(filter.key)];
    const to = values[toKey(filter.key)];
    return typeof from === 'string' && typeof to === 'string' && from !== '' && to !== '' && from > to;
  });
}

export function DataGrid<Row>({
  caption,
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  search,
  onSearchChange,
  searchDelay = 300,
  sort,
  onSort,
  filters = [],
  filterValues = {},
  onFilterChange,
  tabs,
  tab,
  onTabChange,
  view: viewProp,
  onViewChange,
  renderCard,
  showSearch = true,
  showViewSwitcher = true,
  showFilters = true,
  segments,
  segment,
  onSegmentChange,
  isFiltered = false,
  onClearFilters,
  rowTone,
  rowMinWidth,
  selection,
  isPending = false,
  isFetching = false,
  error,
  onRetry,
  actions,
  labels,
}: DataGridProps<Row>) {
  // View is uncontrolled unless the caller wants it in the URL with everything else.
  const [ownView, setOwnView] = useState<'grid' | 'cards'>('grid');
  const view = viewProp ?? ownView;
  const changeView = onViewChange ?? setOwnView;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<DataGridFilterValues>(filterValues);
  const filterTrigger = useRef<HTMLButtonElement>(null);

  /*
   * Search: the field is uncontrolled by the page and settles into it.
   *
   * `typed` is what is on screen; `search` is what the server has answered.
   * `emitted` remembers the last value we handed up, so an outside change - the
   * empty state's Clear all, a saved view, the browser Back button - is adopted
   * while our own echo is ignored.
   */
  const [typed, setTyped] = useState(search);
  const emitted = useRef(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (search !== emitted.current) {
      emitted.current = search;
      setTyped(search);
    }
  }, [search]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const emitSearch = (value: string) => {
    clearTimeout(searchTimer.current);
    if (value === emitted.current) return;
    emitted.current = value;
    onSearchChange(value);
  };

  const typeSearch = (value: string) => {
    setTyped(value);
    clearTimeout(searchTimer.current);
    if (searchDelay <= 0) {
      emitSearch(value);
      return;
    }
    searchTimer.current = setTimeout(() => emitSearch(value), searchDelay);
  };

  const appliedCount = countFilters(filterValues);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const draftInvalid = invalidRanges(filters, draft);

  /*
   * A result count that only appears in the table is invisible to a screen
   * reader driving the filter drawer. Announce it politely on change instead,
   * and never on first render, which would talk over the page load.
   */
  const settled = !isPending && !error;
  const [announcement, setAnnouncement] = useState('');
  const [announcedTotal, setAnnouncedTotal] = useState<number | null>(null);
  if (settled && announcedTotal !== total) {
    setAnnouncedTotal(total);
    // Never on the first settled render: that one would talk over the page load.
    if (announcedTotal !== null) setAnnouncement(labels.resultCount(total));
  }

  const openDrawer = () => {
    setDraft(filterValues);
    setDrawerOpen(true);
  };

  const changeDraft = (key: string, value: string | string[] | undefined) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const applyDraft = () => {
    onFilterChange?.(draft);
    setDrawerOpen(false);
  };

  const clearAll = () => {
    onFilterChange?.({});
    setDraft({});
    // Whatever is narrowing the list from outside goes too. Clearing half of it
    // and leaving the list still empty is the worst answer available.
    onClearFilters?.();
  };

  /** Anything at all is narrowing the list: our filters, the search, or the page's. */
  const narrowed = appliedCount > 0 || search.trim() !== '' || isFiltered;

  const removeValue = (key: string, value: string) => {
    const current = filterValues[key];
    onFilterChange?.({
      ...filterValues,
      [key]: Array.isArray(current) ? current.filter((entry) => entry !== value) : undefined,
    });
  };

  /** One chip per applied value, labelled from the filter definition. */
  const chips = useMemo(() => {
    const labelFor = (filter: DataGridFilter, value: string) =>
      filter.kind === 'choice'
        ? (filter.options.find((option) => option.value === value)?.label ?? value)
        : value;

    return filters.flatMap((filter) => {
      if (filter.kind === 'dateRange') {
        return [fromKey(filter.key), toKey(filter.key)]
          .filter((key) => !isEmptyValue(filterValues[key]))
          .map((key) => ({
            id: key,
            label: `${filter.title}: ${String(filterValues[key])}`,
            remove: () => onFilterChange?.({ ...filterValues, [key]: undefined }),
          }));
      }
      const value = filterValues[filter.key];
      if (isEmptyValue(value)) return [];
      const values = Array.isArray(value) ? value : [String(value)];
      return values.map((entry) => ({
        id: `${filter.key}-${entry}`,
        label: `${filter.title}: ${labelFor(filter, entry)}`,
        remove: () =>
          Array.isArray(value)
            ? removeValue(filter.key, entry)
            : onFilterChange?.({ ...filterValues, [filter.key]: undefined }),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, filterValues]);

  /* A card built from the columns, so a listing gets the narrow view for free. */
  const defaultCard = (row: Row) => (
    <>
      {columns.slice(0, 4).map((column) => (
        <div className="noa-row" key={column.key}>
          <small>{column.label}</small>
          <span>{column.render(row)}</span>
        </div>
      ))}
    </>
  );

  const body = error ? (
    <StatePanel
      title={labels.error}
      action={onRetry ? <Button variant="outline" onClick={onRetry}>{labels.retry}</Button> : undefined}
    />
  ) : isPending ? (
    <div role="status" aria-busy="true" className="noa-section">
      <span className="noa-visually-hidden">{labels.loading}</span>
      {Array.from({ length: Math.min(pageSize, 8) }, (_, index) => (
        <div className="noa-skeleton" key={index} />
      ))}
    </div>
  ) : rows.length === 0 ? (
    <StatePanel
      title={narrowed ? labels.emptyFiltered : labels.empty}
      action={
        narrowed ? (
          <Button
            variant="outline"
            onClick={() => {
              clearAll();
              setTyped('');
              emitSearch('');
            }}
          >
            {labels.clearAll}
          </Button>
        ) : undefined
      }
    />
  ) : view === 'cards' ? (
    <div className="noa-listing-cards">
      {rows.map((row) => (
        /* The same rail as the grid row, moved to the top edge: a card is read
           downwards, so its status belongs where the reading starts. */
        <article
          className="noa-listing-card"
          data-tone={rowTone?.(row)}
          style={pipelineTone(rowTone?.(row))}
          key={rowKey(row)}
        >
          {renderCard ? renderCard(row) : defaultCard(row)}
        </article>
      ))}
    </div>
  ) : (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={rowKey}
      sort={sort}
      onSort={onSort}
      rowTone={rowTone}
      minWidth={rowMinWidth}
      selection={
        selection
          ? {
              label: selection.label,
              rowLabel: selection.rowLabel,
              selected: selection.selected,
              onChange: selection.onChange,
            }
          : undefined
      }
    />
  );

  const footer =
    !error && !isPending && rows.length > 0 ? (
      <Pagination
        label={labels.page(page, pageCount)}
        rangeLabel={labels.showing(first, last, total)}
        page={page}
        pageCount={Math.min(10_000, pageCount)}
        previousLabel={labels.previous}
        nextLabel={labels.next}
        lastLabel={labels.lastPage}
        onPageChange={onPageChange}
        {...(onPageSizeChange
          ? {
              pageSize,
              pageSizeLabel: labels.rows,
              pageSizeOptions: pageSizeOptions ?? [25, 50, 100],
              onPageSizeChange,
            }
          : {})}
      />
    ) : null;

  const content = (
    <>
      {body}
      {footer}
    </>
  );

  return (
    <section className="noa-listing" aria-label={caption} aria-busy={isFetching || undefined}>
      <ListingToolbar
        query={typed}
        onQueryChange={typeSearch}
        searchLabel={labels.search}
        filtersLabel={labels.filters}
        filterCount={appliedCount}
        filterTriggerRef={filterTrigger}
        onFiltersOpen={openDrawer}
        view={view}
        onViewChange={changeView}
        viewLabel={labels.view}
        gridLabel={labels.grid}
        cardsLabel={labels.cards}
        actions={actions}
        filtersDisabled={filters.length === 0}
        showSearch={showSearch}
        showViewSwitcher={showViewSwitcher}
        showFilters={showFilters}
        segments={
          segments && segment !== undefined && onSegmentChange ? (
            <ListingSegments
              label={labels.views ?? labels.filters}
              value={segment}
              onChange={onSegmentChange}
              items={segments.map((item) => ({
                value: item.value,
                label: item.label,
                count: item.count,
              }))}
            />
          ) : undefined
        }
      />

      {/*
       * The bulk bar takes the place of nothing: it appears between the toolbar
       * and the rows, pushing them down, rather than covering the first row it
       * would act on.
       */}
      {selection && selection.selected.length > 0 && (
        <div className="noa-listing-bulk">
          <strong>{labels.selectedRows?.(selection.selected.length)}</strong>
          {selection.actions && <div className="noa-listing-bulk-actions">{selection.actions}</div>}
          <button
            type="button"
            className="noa-listing-bulk-clear"
            onClick={() => selection.onChange([])}
          >
            {labels.clearSelection ?? labels.clearAll}
          </button>
        </div>
      )}

      {chips.length > 0 && (
        <div className="noa-active-filters">
          {chips.map((chip) => (
            <FilterChip
              key={chip.id}
              label={chip.label}
              removeLabel={labels.removeFilter(chip.label)}
              onRemove={chip.remove}
            />
          ))}
          <button type="button" className="noa-text-action" onClick={clearAll}>
            {labels.clearAll}
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="noa-visually-hidden">
        {announcement}
      </p>

      {tabs && tab !== undefined && onTabChange ? (
        <TabGroup value={tab} onValueChange={onTabChange}>
          <CountedTabs label={caption} items={tabs} />
          <TabPanel key={tab} value={tab}>
            {content}
          </TabPanel>
        </TabGroup>
      ) : (
        content
      )}

      {filters.length > 0 && (
        <FilterDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={labels.filterTitle}
          description={labels.filterDescription}
          closeLabel={labels.close}
          returnFocus={() => filterTrigger.current?.focus()}
          footer={
            <>
              <button type="button" className="noa-text-action" onClick={() => setDraft({})}>
                {labels.clearAll}
              </button>
              <Button size="sm" disabled={draftInvalid} onClick={applyDraft}>
                {labels.apply}
              </Button>
            </>
          }
        >
          {filters.map((filter) =>
            filter.kind === 'dateRange' ? (
              <FilterSection
                key={filter.key}
                title={filter.title}
                summary={
                  isEmptyValue(draft[fromKey(filter.key)]) && isEmptyValue(draft[toKey(filter.key)])
                    ? labels.any
                    : labels.customRange
                }
              >
                <Input
                  type="date"
                  label={labels.dateFrom}
                  value={String(draft[fromKey(filter.key)] ?? '')}
                  onChange={(event) => changeDraft(fromKey(filter.key), event.target.value)}
                />
                <Input
                  type="date"
                  label={labels.dateTo}
                  value={String(draft[toKey(filter.key)] ?? '')}
                  onChange={(event) => changeDraft(toKey(filter.key), event.target.value)}
                  error={
                    draft[fromKey(filter.key)] &&
                    draft[toKey(filter.key)] &&
                    String(draft[fromKey(filter.key)]) > String(draft[toKey(filter.key)])
                      ? labels.invalidDateRange
                      : undefined
                  }
                />
              </FilterSection>
            ) : filter.kind === 'text' ? (
              <FilterSection
                key={filter.key}
                title={filter.title}
                summary={isEmptyValue(draft[filter.key]) ? labels.any : String(draft[filter.key])}
              >
                <Input
                  label={filter.title}
                  labelHidden
                  value={String(draft[filter.key] ?? '')}
                  onChange={(event) => changeDraft(filter.key, event.target.value)}
                />
              </FilterSection>
            ) : (
              <FilterSection
                key={filter.key}
                title={filter.title}
                summary={
                  isEmptyValue(draft[filter.key])
                    ? labels.any
                    : filter.multiple
                      ? labels.selectedCount((draft[filter.key] as string[]).length)
                      : (filter.options.find((option) => option.value === draft[filter.key])?.label ??
                        String(draft[filter.key]))
                }
              >
                {filter.options.map((option) => {
                  const current = draft[filter.key];
                  const checked = filter.multiple
                    ? Array.isArray(current) && current.includes(option.value)
                    : current === option.value;
                  return (
                    <div className="noa-filter-option" key={option.value}>
                      <Checkbox
                        label={option.label}
                        checked={checked}
                        onCheckedChange={(next) => {
                          if (!filter.multiple) {
                            changeDraft(filter.key, next === true ? option.value : undefined);
                            return;
                          }
                          const values = Array.isArray(current) ? current : [];
                          changeDraft(
                            filter.key,
                            next === true
                              ? [...values, option.value]
                              : values.filter((entry) => entry !== option.value),
                          );
                        }}
                      />
                      {option.count !== undefined && <span>{option.count}</span>}
                    </div>
                  );
                })}
              </FilterSection>
            ),
          )}
        </FilterDrawer>
      )}
    </section>
  );
}
