import type { CSSProperties, ReactNode, Ref } from 'react';
import { AlignJustify, ChevronDown, LayoutGrid, ListFilter, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, Tab, TabList } from './Controls';
import { Input } from './Input';

export function CountedTabs({
  label,
  items,
}: {
  label: string;
  items: { value: string; label: string; count: number }[];
}) {
  return (
    <TabList aria-label={label} className="noa-counted-tabs">
      {items.map((item) => (
        <Tab key={item.value} value={item.value} aria-label={`${item.label} ${item.count}`}>
          {item.label}
          <span className="noa-tab-count">{item.count}</span>
        </Tab>
      ))}
    </TabList>
  );
}

/**
 * Saved views, as pills in the toolbar.
 *
 * Not the same control as CountedTabs, and deliberately beside the search rather
 * than under it: a tab divides the list, while a saved view is a question
 * somebody asks often - "what needs my decision", "what is unclaimed". Both can
 * be on one screen, and on the quotation listings the status filter is the
 * pipeline band in the hero, which leaves this row for the saved views.
 */
export function ListingSegments({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="noa-listing-views" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          className="noa-listing-view"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ListingToolbar({
  query,
  onQueryChange,
  searchLabel,
  filtersLabel,
  onFiltersOpen,
  filterCount,
  view,
  onViewChange,
  viewLabel,
  gridLabel,
  cardsLabel,
  filterTriggerRef,
  filtersDisabled = false,
  showSearch = true,
  showViewSwitcher = true,
  showFilters = true,
  segments,
  actions,
}: {
  filterTriggerRef?: Ref<HTMLButtonElement>;
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
  filtersLabel: string;
  onFiltersOpen: () => void;
  filterCount: number;
  view: 'grid' | 'cards';
  onViewChange: (view: 'grid' | 'cards') => void;
  viewLabel: string;
  gridLabel: string;
  cardsLabel: string;
  /** A listing with nothing to filter still keeps the button, greyed, so the
      toolbar does not change shape between screens. */
  filtersDisabled?: boolean;
  showSearch?: boolean;
  showViewSwitcher?: boolean;
  /** Hide the drawer trigger where the screen filters from somewhere else, e.g.
      a pipeline band in the hero that is already the status control. */
  showFilters?: boolean;
  /** Saved views, between the search and the view switch. */
  segments?: ReactNode;
  /** This listing's primary action, e.g. "Create customer". Always last. */
  actions?: ReactNode;
}) {
  return (
    <div className="noa-listing-toolbar">
      {showSearch ? (
        <div className="noa-listing-search">
          <Search aria-hidden="true" />
          <Input
            label={searchLabel}
            labelHidden
            placeholder={searchLabel}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      ) : null}
      {showFilters ? (
        <button
          ref={filterTriggerRef}
          className="noa-tool-button"
          onClick={onFiltersOpen}
          aria-haspopup="dialog"
          disabled={filtersDisabled}
        >
          <ListFilter aria-hidden="true" />
          {filtersLabel}
          {filterCount > 0 && <span className="noa-tab-count">{filterCount}</span>}
        </button>
      ) : null}
      {segments}
      {showViewSwitcher ? (
        <div className="noa-view-switch" role="group" aria-label={viewLabel}>
          {/* The glyph says which shape the rows take; the word says it again for
              anyone the shape does not reach. Neither alone is enough. */}
          <button aria-pressed={view === 'grid'} onClick={() => onViewChange('grid')}>
            <AlignJustify aria-hidden="true" />
            {gridLabel}
          </button>
          <button aria-pressed={view === 'cards'} onClick={() => onViewChange('cards')}>
            <LayoutGrid aria-hidden="true" />
            {cardsLabel}
          </button>
        </div>
      ) : null}
      {actions}
    </div>
  );
}

export function FilterDrawer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
  returnFocus,
}: {
  returnFocus?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        side="right"
        closeLabel={closeLabel}
        className="noa-filter-drawer"
        onCloseAutoFocus={
          returnFocus
            ? (event) => {
                event.preventDefault();
                returnFocus();
              }
            : undefined
        }
      >
        <header className="noa-filter-header">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </header>
        <div className="noa-filter-body">{children}</div>
        <footer className="noa-filter-footer">{footer}</footer>
      </DialogContent>
    </Dialog>
  );
}

export function FilterSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="noa-filter-section" open={defaultOpen || undefined}>
      <summary>
        <strong>{title}</strong>
        <span>{summary}</span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="noa-filter-fields">{children}</div>
    </details>
  );
}

export function FilterChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <button className="noa-filter-chip" aria-label={removeLabel} onClick={onRemove}>
      {label}
      <X aria-hidden="true" />
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Listing cells.
 *
 * A row on the quotation listings is six columns of two lines each, and every
 * one of them is the same shape on both audiences' screens. They live here, in
 * the design system, because "what does a validity meter look like" is a brand
 * decision and not a decision either listing gets to make for itself.
 *
 * All of them take a `tone` - one of the pipeline segment keys - and read their
 * colour from the matching token. None of them knows what a quote is.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The colour set for a pipeline tone, as inline custom properties.
 *
 * Exported because the row rail and the card edge need the same three values as
 * the cells. Those two used to be a hand-written list of per-tone rules in the
 * stylesheet, which is how a segment added to the enum ended up drawing a grey
 * rail beside its own navy pill. Reading the tone from the row instead means a
 * new segment costs no CSS at all.
 */
export const pipelineTone = (tone?: string) =>
  tone
    ? ({
        '--tone': `var(--noa-pipe-${tone.replaceAll('_', '-')}, var(--noa-pipe-requested))`,
        '--tone-ink': `var(--noa-pipe-${tone.replaceAll('_', '-')}-ink, var(--noa-pipe-requested-ink))`,
        '--tone-surface': `var(--noa-pipe-${tone.replaceAll('_', '-')}-surface, var(--noa-pipe-requested-surface))`,
      } as CSSProperties)
    : undefined;

/**
 * The route, with what is in it underneath.
 *
 * Different from `RouteCell`, which names the places: on a list of quotations
 * the ports are what you scan and the cargo is what tells two otherwise
 * identical rows apart, so the second line carries the cargo rather than the
 * city. The track's fill is how far along the process the row is, not how far
 * along the voyage - nothing here has sailed yet.
 */
export function RouteCargoCell({
  origin,
  destination,
  progress,
  tone,
  icon,
  cargo,
  label,
}: {
  origin: string;
  destination: string;
  /** 0-100. How far through the process this row is. */
  progress: number;
  tone?: string;
  icon?: ReactNode;
  cargo?: ReactNode;
  /** Names the pair for assistive technology, e.g. "Qingdao to Valencia". */
  label: string;
}) {
  const fill = `${Math.max(0, Math.min(100, progress))}%`;
  return (
    <div className="noa-route-cargo" style={pipelineTone(tone)}>
      <span className="noa-route-cargo-lane" role="group" aria-label={label}>
        <strong>{origin}</strong>
        <span className="noa-route-cargo-track" aria-hidden="true">
          <span className="noa-route-cargo-run" style={{ width: fill }} />
          <span className="noa-route-cargo-marker" style={{ left: fill }} />
        </span>
        <strong>{destination}</strong>
      </span>
      {cargo && (
        <span className="noa-route-cargo-line">
          {icon}
          <span>{cargo}</span>
        </span>
      )}
    </div>
  );
}

/**
 * A status, as a dot and a word on a wash.
 *
 * `Badge` is the general one and stays where it is; this is the listing's own,
 * because a listing row needs the dot: at eleven pixels the wash alone is too
 * quiet to scan down a column, and colour may never be the only signal anyway.
 */
export function StatusPill({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className="noa-status-pill" style={pipelineTone(tone)}>
      <span className="noa-status-pill-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * A figure with its caption under it, aligned to the column's edge.
 *
 * The caption is what stops a total being read as the only number that matters:
 * "all in, 2 options" says the figure is complete and that there is a choice
 * behind it.
 */
export function AmountCell({
  value,
  caption,
  muted = false,
}: {
  value: ReactNode;
  caption?: ReactNode;
  /** For a figure that does not exist yet, e.g. a quote nobody has priced. */
  muted?: boolean;
}) {
  return (
    <span className="noa-amount-cell" data-muted={muted ? 'true' : undefined}>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </span>
  );
}

/**
 * How long is left, in words and as a meter.
 *
 * Two readings of one fact, which is the point: the words are exact and the
 * meter is scannable, and between them nobody has to divide a date by anything.
 * The meter is drawn against a fixed span rather than against this quote's own
 * validity, so a short one looks short - a bar that always started full would
 * say nothing.
 */
export function ValidityMeter({
  label,
  days,
  tone,
}: {
  label: ReactNode;
  /** Whole days left. Null when nothing has been published to run out. */
  days: number | null;
  /** Overrides the tone the day count would pick. */
  tone?: string;
}) {
  const pick =
    tone ??
    (days === null || days <= 0
      ? 'expired'
      : days <= 3
        ? 'options_ready'
        : days <= 7
          ? 'expiring_soon'
          : 'accepted');

  // Clamped to the span the token names, so "11 days left" and "90 days left"
  // both read as plenty rather than sending the bar off the end of the cell.
  const fill =
    days === null || days <= 0
      ? '0%'
      : `min(100%, calc(${days} / var(--noa-listing-validity-span) * 100%))`;

  return (
    <span className="noa-validity" style={pipelineTone(pick)}>
      <strong>{label}</strong>
      <span className="noa-validity-meter" aria-hidden="true">
        <span style={{ width: fill }} />
      </span>
    </span>
  );
}

/** A value with its quiet second line. The commonest cell on either listing. */
export function StackedCell({
  primary,
  secondary,
  accent = false,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  /** Brand red for the second line - a customer's own reference, not ours. */
  accent?: boolean;
}) {
  return (
    <span className="noa-stacked-cell" data-accent={accent ? 'true' : undefined}>
      <strong>{primary}</strong>
      {secondary && <small>{secondary}</small>}
    </span>
  );
}

export function RouteCell({
  origin,
  originLabel,
  destination,
  destinationLabel,
  progress,
  icon,
}: {
  origin: string;
  originLabel: string;
  destination: string;
  destinationLabel: string;
  progress: number;
  icon: ReactNode;
}) {
  return (
    <div className="noa-route-cell">
      <div>
        <strong>{origin}</strong>
        <small>{originLabel}</small>
      </div>
      <div className="noa-route-track" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}>
          <i>{icon}</i>
        </span>
      </div>
      <div>
        <strong>{destination}</strong>
        <small>{destinationLabel}</small>
      </div>
    </div>
  );
}
