import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Plane, Plus, Ship, Train, Truck, Zap } from 'lucide-react';

import {
  AmountCell,
  Button,
  type DataGridFilterValues,
  ListingHero,
  RouteCargoCell,
  StackedCell,
  StatePanel,
  StatusPill,
  ValidityMeter,
  type PipelineSegment,
  type TableColumn,
} from '../../../design-system';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { ListingGrid } from '../../../shared/components/ListingGrid';
import { QUOTE_SEGMENTS, cargoCaption, segmentProgress, validityLabel } from '../../../shared/quotations/listing';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import type { CustomerSession } from '../../../app/layouts/CustomerPortalLayout';
import { useQuotes, type QuoteSummary } from '../api/quotes';
import { formatMoney } from '../../pricing/money';
import styles from './QuotesListPage.module.css';

/**
 * The customer's quotations.
 *
 * CH-14: a navy band carrying the pipeline, and the listing rising into it. The
 * band IS the status filter - picking a segment filters the grid - which is why
 * there is no status control in the toolbar. The pills beside the search are
 * saved views, a different question: "which of these is waiting on me".
 *
 * Every column is a design-system cell. The page decides what a quotation is;
 * the kit decides what a validity meter looks like.
 */

/** The glyph on the cargo line. One per transport mode, and sea is the default. */
const MODE_ICON: Record<string, typeof Ship> = {
  sea: Ship,
  air: Plane,
  road: Truck,
  rail: Train,
};

/**
 * What the row's button offers, per segment.
 *
 * One decision per state, and never more than one: a row with three buttons is a
 * row nobody reads. `primary` is the single action a customer is being waited on
 * for - everything else is an outline, because looking at something we have
 * already settled is not urgent.
 */
const ACTION: Record<string, { key: string; primary: boolean }> = {
  options_ready: { key: 'quoteAction_options_ready', primary: true },
  expiring_soon: { key: 'quoteAction_expiring_soon', primary: true },
  submitted: { key: 'quoteAction_submitted', primary: false },
  in_progress: { key: 'quoteAction_in_progress', primary: false },
  accepted: { key: 'quoteAction_accepted', primary: false },
  declined: { key: 'quoteAction_declined', primary: false },
  expired: { key: 'quoteAction_expired', primary: false },
};

/** The saved views, in the order the pill row shows them. */
const VIEWS = ['all', 'needs_decision', 'accepted'] as const;

  /* The drawer's own filters. The pipeline band already owns status, so this is
     what is left that is worth narrowing by. */
  const MODES = ['sea', 'air', 'road', 'rail'] as const;

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

export function QuotesListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const session = useOutletContext<CustomerSession>();

  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<string | null>(null);
  const [view, setView] = useState<string>('all');
  const [filters, setFilters] = useState<DataGridFilterValues>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const text = (key: string) => (typeof filters[key] === 'string' ? (filters[key] as string) : '');

  const quotes = useQuotes({
    search: search.trim(),
    segment: segment ?? '',
    view,
    mode: text('mode'),
    requestedFrom: text('requestedFrom'),
    requestedTo: text('requestedTo'),
    page,
    pageSize,
  });

  const mayCreate = Boolean(session?.permissions.includes('quotes.create'));

  /* Anything that changes what is being asked for returns to the first page. */
  const restart = <Value,>(apply: (value: Value) => void) => (value: Value) => {
    apply(value);
    setPage(1);
  };

  const rows = useMemo(() => quotes.data?.items ?? [], [quotes.data]);
  const pipeline = useMemo(
    () => quotes.data?.pipeline ?? [],
    [quotes.data],
  );

  /* The band's own order, not the server's: the pipeline reads left to right in
     the order a quotation moves through it. */
  const segments = useMemo<PipelineSegment[]>(
    () =>
      QUOTE_SEGMENTS.map((key) => ({
        key,
        label: t(`quoteSegment_${key}`),
        count: pipeline.find((entry) => entry.key === key)?.count ?? 0,
      })),
    [pipeline, t],
  );

  const total = segments.reduce((sum, entry) => sum + entry.count, 0);
  const waiting =
    (pipeline.find((entry) => entry.key === 'options_ready')?.count ?? 0) +
    (pipeline.find((entry) => entry.key === 'expiring_soon')?.count ?? 0);
  const accepted = pipeline.find((entry) => entry.key === 'accepted')?.count ?? 0;

  const open = (row: QuoteSummary) => navigate(`/app/quotations/${row.id}`);

  /* The trail back up. Tone 'hero' because the band is dark. */
  const trail = (
    <Breadcrumb
      tone="hero"
      items={[{ label: t('customerNav_dashboard'), to: '/app/dashboard' }, { label: t('quotesTitle') }]}
    />
  );

  const columns: TableColumn<QuoteSummary>[] = [
    {
      key: 'reference',
      label: t('quoteReference'),
      width: '15%',
      render: (row) => (
        <StackedCell
          primary={<Link to={`/app/quotations/${row.id}`}>{row.reference}</Link>}
          secondary={row.customerReference ?? undefined}
          accent
        />
      ),
    },
    {
      key: 'route',
      label: t('quoteRouteCargo'),
      width: '27%',
      render: (row) => {
        const Icon = MODE_ICON[row.mode] ?? Ship;
        return (
          <RouteCargoCell
            origin={row.originCode}
            destination={row.destinationCode}
            progress={segmentProgress(row.pipelineSegment)}
            tone={row.pipelineSegment}
            icon={<Icon size={12} aria-hidden="true" />}
            cargo={cargoCaption(row.cargo, t, i18n.language)}
            label={t('quoteLane', { from: row.originCode, to: row.destinationCode })}
          />
        );
      },
    },
    {
      key: 'status',
      label: t('quoteStatusColumn'),
      width: '15%',
      render: (row) => (
        <StatusPill tone={row.pipelineSegment}>{t(`quoteSegment_${row.pipelineSegment}`)}</StatusPill>
      ),
    },
    {
      key: 'total',
      label: t('quoteTotal'),
      align: 'end',
      width: '14%',
      // Blank until published: a figure here before the offer is released would
      // be a price the customer was never shown.
      render: (row) =>
        row.totalMinorUnits === null ? (
          <AmountCell value="—" caption={t('quoteTotalAwaiting')} muted />
        ) : (
          <AmountCell
            value={formatMoney(row.totalMinorUnits, row.currency)}
            caption={t('quoteTotalAllIn', { count: row.optionCount })}
          />
        ),
    },
    {
      key: 'valid',
      label: t('quoteValidity'),
      width: '14%',
      render: (row) => (
        <ValidityMeter label={validityLabel(row.daysRemaining, t)} days={row.daysRemaining} />
      ),
    },
    {
      key: 'act',
      label: t('quoteRowActions'),
      headerLabelHidden: true,
      align: 'end',
      width: '15%',
      render: (row) => {
        const action = ACTION[row.pipelineSegment] ?? ACTION.submitted!;
        return (
          <Button
            size="sm"
            variant={action.primary ? 'primary' : 'outline'}
            onClick={() => open(row)}
          >
            {t(action.key)}
          </Button>
        );
      },
    },
  ];

  if (quotes.error) {
    return (
      <ListingHero
        breadcrumb={trail}
        eyebrow={t('quotesEyebrow', { customer: session?.displayName ?? '' })}
        title={t('quotesTitle')}
        subtitle={t('quotesIntro')}
      >
        <div className="noa-panel" role="alert">
          <StatePanel title={t(errorKey(quotes.error))} />
        </div>
      </ListingHero>
    );
  }

  return (
    <ListingHero
      breadcrumb={trail}
      eyebrow={t('quotesEyebrow', { customer: quotes.data?.customerName ?? session?.displayName ?? '' })}
      title={t('quotesTitle')}
      subtitle={t('quotesIntro')}
      /*
       * The mockup also shows an Export beside this. There is no export endpoint
       * for quotations, and a button that does nothing is worse than an absent
       * one, so it is left out and recorded in docs/gaps.md rather than drawn
       * inert.
       */
      actions={
        mayCreate && (
          <>
            {/* Two doors, and the short one leads. Most requests need none of
                what the full form asks, and the one that does is one click
                further on rather than four screens in. */}
            <Button variant="outline" onClick={() => navigate('/app/quotations')}>
              <Zap size={15} aria-hidden="true" /> {t('instTitleShort')}
            </Button>
            <Button onClick={() => navigate('/app/quotations/new')}>
              <Plus size={15} aria-hidden="true" /> {t('quoteRequestNew')}
            </Button>
          </>
        )
      }
      pipelineTitle={t('quotesPipelineTitle', { count: total })}
      pipelineNote={
        waiting > 0 ? t('quotesPipelineNote_waiting', { count: waiting }) : t('quotesPipelineNote_none')
      }
      segments={segments}
      activeSegment={segment}
      onSegmentChange={restart(setSegment)}
      segmentsLabel={t('quotesFilterState')}
      clearLabel={t('quotesClearState')}
      segmentTitle={(count, label) => t('quotesSegmentTitle', { count, state: label })}
      footnote={t('quotesFootnote')}
    >
      <ListingGrid
        caption={t('quotesTitle')}
        searchLabel={t('quotesSearch')}
        emptyLabel={t('quotesEmpty')}
        columns={columns}
        rows={rows}
        rowKey={(row: QuoteSummary) => row.id}
        rowTone={(row: QuoteSummary) => row.pipelineSegment}
        rowMinWidth="830px"
        total={quotes.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={restart(setPageSize)}
        pageSizeOptions={[10, 25, 50]}
        search={search}
        onSearchChange={restart(setSearch)}
        /* The drawer carries everything the band does not. Status is NOT among
           them: it is the band, and two controls for one thing would disagree. */
        filters={[
          {
            kind: 'choice',
            key: 'mode',
            title: t('quoteMode'),
            options: MODES.map((value) => ({ value, label: t(`mode_${value}`) })),
          },
          { kind: 'dateRange', key: 'requested', title: t('quoteRequested') },
        ]}
        filterValues={filters}
        onFilterChange={restart(setFilters)}
        segments={VIEWS.map((value) => ({
          value,
          label: t(`quoteView_${value}`),
          count: value === 'all' ? total : value === 'needs_decision' ? waiting : accepted,
        }))}
        segment={view}
        onSegmentChange={restart(setView)}
        /* The band and the pills narrow the list from outside the grid, so the
           grid has to be told - otherwise an empty segment reads as "you have
           no quotations" while the band above it is showing ten. */
        isFiltered={segment !== null || view !== 'all'}
        onClearFilters={() => {
          setSegment(null);
          setView('all');
          setPage(1);
        }}
        renderCard={(row: QuoteSummary) => (
          <>
            <header>
              <div className={styles.cardRef}>
                <strong>{row.reference}</strong>
                {row.customerReference && <small>{row.customerReference}</small>}
              </div>
              <StatusPill tone={row.pipelineSegment}>
                {t(`quoteSegment_${row.pipelineSegment}`)}
              </StatusPill>
            </header>
            <RouteCargoCell
              origin={row.originCode}
              destination={row.destinationCode}
              progress={segmentProgress(row.pipelineSegment)}
              tone={row.pipelineSegment}
              cargo={cargoCaption(row.cargo, t, i18n.language)}
              label={t('quoteLane', { from: row.originCode, to: row.destinationCode })}
            />
            <div className="noa-row">
              <AmountCell
                value={
                  row.totalMinorUnits === null ? '—' : formatMoney(row.totalMinorUnits, row.currency)
                }
                caption={
                  row.totalMinorUnits === null
                    ? t('quoteTotalAwaiting')
                    : t('quoteTotalAllIn', { count: row.optionCount })
                }
                muted={row.totalMinorUnits === null}
              />
              <ValidityMeter label={validityLabel(row.daysRemaining, t)} days={row.daysRemaining} />
            </div>
            <Button
              size="sm"
              variant={(ACTION[row.pipelineSegment] ?? ACTION.submitted!).primary ? 'primary' : 'outline'}
              onClick={() => open(row)}
            >
              {t((ACTION[row.pipelineSegment] ?? ACTION.submitted!).key)}
            </Button>
          </>
        )}
        isPending={quotes.isPending}
        isFetching={quotes.isFetching}
      />
    </ListingHero>
  );
}
