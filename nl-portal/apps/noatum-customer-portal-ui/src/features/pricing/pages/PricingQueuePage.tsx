import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Plane, Ship, Train, Truck } from 'lucide-react';

import type { components } from '../../../api/generated/schema';

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
import {
  QUOTE_SEGMENTS,
  cargoCaption,
  segmentProgress,
  validityLabel,
} from '../../../shared/quotations/listing';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import { useClaimQuote, usePricingQuotations, type QuotationRow } from '../api/pricing';
import { formatMoney } from '../money';
import styles from './PricingQueuePage.module.css';

/**
 * The branch's quotations.
 *
 * The same CH-14 listing the customer sees, from the other side of the desk:
 * same band, same segments, same cells. What differs is what the branch is
 * allowed to know - who the customer is, who owns the work, what the margin is -
 * and what it can do about it.
 *
 * Margin and owner are internal columns. Margin is gated twice on the server
 * (the branch records cost at all, and this person may see it) and the column is
 * not drawn when either gate is shut, because a column of dashes invites
 * somebody to ask what is broken.
 */

const MODE_ICON: Record<string, typeof Ship> = {
  sea: Ship,
  air: Plane,
  road: Truck,
  rail: Train,
};

/**
 * What the row's button offers, per segment. One action, never three.
 *
 * `Claim and price` is the only solid button on the screen: an unclaimed request
 * is the one thing on this list that somebody has to pick up, and the quote that
 * is about to lapse is the one thing that runs out.
 */
const ACTION: Record<string, { key: string; primary: boolean }> = {
  submitted: { key: 'queueAction_submitted', primary: true },
  in_progress: { key: 'queueAction_in_progress', primary: false },
  options_ready: { key: 'queueAction_options_ready', primary: false },
  expiring_soon: { key: 'queueAction_expiring_soon', primary: false },
  accepted: { key: 'queueAction_accepted', primary: false },
  declined: { key: 'queueAction_declined', primary: false },
  expired: { key: 'queueAction_expired', primary: false },
};

const VIEWS = ['all', 'unclaimed', 'mine', 'expiring'] as const;

  /* The drawer's own filters. The pipeline band already owns status, so this is
     what is left that is worth narrowing by. */
  const MODES = ['sea', 'air', 'road', 'rail'] as const;

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

/** Whoever is signed in, as the staff layout hands it down. */
type StaffSession = components['schemas']['CurrentUserDto'] | undefined;

export function PricingQueuePage() {
  const { t } = useTranslation('staff');
  // Cargo and validity wording is audience-neutral and lives in the default
  // namespace, so both listings say the same thing about the same row.
  const { t: shared, i18n } = useTranslation();
  const navigate = useNavigate();
  const session = useOutletContext<StaffSession>();

  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<string | null>(null);
  const [view, setView] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<DataGridFilterValues>({});

  const text = (key: string) => (typeof filters[key] === 'string' ? (filters[key] as string) : '');

  const list = usePricingQuotations({
    search: search.trim(),
    segment: segment ?? '',
    view,
    mode: text('mode'),
    requestedFrom: text('requestedFrom'),
    requestedTo: text('requestedTo'),
    page,
    pageSize,
  });
  const claim = useClaimQuote();

  const restart = <Value,>(apply: (value: Value) => void) => (value: Value) => {
    apply(value);
    setPage(1);
  };

  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const pipeline = useMemo(() => list.data?.pipeline ?? [], [list.data]);

  const segments = useMemo<PipelineSegment[]>(
    () =>
      QUOTE_SEGMENTS.map((key) => ({
        key,
        label: t(`queueSegment_${key}`),
        count: pipeline.find((entry) => entry.key === key)?.count ?? 0,
      })),
    [pipeline, t],
  );

  const total = segments.reduce((sum, entry) => sum + entry.count, 0);
  const unclaimed = list.data?.unclaimed ?? 0;
  const expiring = pipeline.find((entry) => entry.key === 'expiring_soon')?.count ?? 0;
  const maySeeMargin = Boolean(list.data?.maySeeMargin);

  const open = (row: QuotationRow) => navigate(`/portal/pricing/${row.id}`);

  /* Claim and price is one act, so the button does both and lands on the quote. */
  const claimAndOpen = async (row: QuotationRow) => {
    if (row.claimedById === null) await claim.mutateAsync(row.id);
    open(row);
  };

  /**
   * Claim everything selected that nobody holds.
   *
   * One at a time and in order, not `Promise.all`: each claim is a conditional
   * update that can lose to a colleague, and one loss must not take the rest of
   * the batch with it. A row that was taken in between simply stays theirs, and
   * the refetch shows who has it.
   */
  const claimSelected = async () => {
    const claimable = rows.filter((row) => selected.includes(row.id) && row.claimedById === null);
    for (const row of claimable) {
      try {
        await claim.mutateAsync(row.id);
      } catch {
        /* Already taken. */
      }
    }
    setSelected([]);
  };

  const columns: TableColumn<QuotationRow>[] = [
    {
      key: 'reference',
      label: t('queueQuote'),
      width: '12%',
      render: (row) => (
        <StackedCell
          primary={<Link to={`/portal/pricing/${row.id}`}>{row.reference}</Link>}
          secondary={row.customerReference ?? undefined}
          accent
        />
      ),
    },
    {
      key: 'customer',
      label: t('queueCustomer'),
      width: '15%',
      render: (row) => (
        <StackedCell
          primary={row.customerName ?? '—'}
          secondary={
            row.customerBranchName
              ? t('queueCustomerShipments', {
                  branch: row.customerBranchName,
                  count: row.customerQuoteCount,
                })
              : t('queueCustomerNoBranch', { count: row.customerQuoteCount })
          }
        />
      ),
    },
    {
      key: 'route',
      label: t('queueRouteCargo'),
      width: '22%',
      render: (row) => {
        const Icon = MODE_ICON[row.mode] ?? Ship;
        return (
          <RouteCargoCell
            origin={row.originCode}
            destination={row.destinationCode}
            progress={segmentProgress(row.pipelineSegment)}
            tone={row.pipelineSegment}
            icon={<Icon size={12} aria-hidden="true" />}
            cargo={cargoCaption(row.cargo, shared, i18n.language)}
            label={t('queueLane', { from: row.originCode, to: row.destinationCode })}
          />
        );
      },
    },
    {
      key: 'status',
      label: t('queueStatus'),
      width: '12%',
      render: (row) => (
        <StatusPill tone={row.pipelineSegment}>{t(`queueSegment_${row.pipelineSegment}`)}</StatusPill>
      ),
    },
    {
      key: 'total',
      label: t('queueTotal'),
      align: 'end',
      width: '11%',
      render: (row) =>
        row.totalMinorUnits === null ? (
          <AmountCell value="—" caption={shared('quoteTotalAwaiting')} muted />
        ) : (
          <AmountCell
            value={formatMoney(row.totalMinorUnits, row.currency)}
            caption={shared('quoteTotalAllIn', { count: row.optionCount })}
          />
        ),
    },
    // Internal, and only when there is something behind it. The owner rides in
    // this column's caption because the two are read together: a margin nobody
    // owns is a margin nobody will defend.
    ...(maySeeMargin
      ? [
          {
            key: 'margin',
            label: t('queueMargin'),
            align: 'end' as const,
            width: '7%',
            render: (row: QuotationRow) => (
              <span
                className={styles.margin}
                data-thin={row.marginPercent !== null && row.marginPercent < 10 ? 'true' : undefined}
                data-none={row.marginPercent === null ? 'true' : undefined}
              >
                <strong>{row.marginPercent === null ? '—' : `${row.marginPercent}%`}</strong>
                <small>
                  {row.ownerInitials
                    ? t('queueOwnerInitials', { initials: row.ownerInitials })
                    : t('queueNoOwner')}
                </small>
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'valid',
      label: t('queueValidity'),
      width: '10%',
      render: (row) => (
        <ValidityMeter label={validityLabel(row.daysRemaining, shared)} days={row.daysRemaining} />
      ),
    },
    {
      key: 'act',
      label: t('queueRowActions'),
      headerLabelHidden: true,
      align: 'end',
      width: '11%',
      render: (row) => {
        const action = ACTION[row.pipelineSegment] ?? ACTION.submitted!;
        return (
          <Button
            size="sm"
            variant={action.primary ? 'primary' : 'outline'}
            disabled={claim.isPending}
            onClick={() => (action.primary ? void claimAndOpen(row) : open(row))}
          >
            {t(action.key)}
          </Button>
        );
      },
    },
  ];

  /* The trail back up. Tone 'hero' because the band is dark. */
  const trail = (
    <Breadcrumb
      tone="hero"
      items={[{ label: t('navGroup_operating') }, { label: t('queueTitle') }]}
    />
  );

  const eyebrow = session?.branchName
    ? t('queueEyebrow', { branch: session.branchName })
    : t('queueEyebrowAll');

  if (list.error) {
    return (
      <ListingHero breadcrumb={trail} eyebrow={eyebrow} title={t('queueTitle')} subtitle={t('queueIntro')}>
        <div className="noa-panel" role="alert">
          <StatePanel title={t(errorKey(list.error))} />
        </div>
      </ListingHero>
    );
  }

  return (
    <ListingHero
      breadcrumb={trail}
      eyebrow={eyebrow}
      title={t('queueTitle')}
      subtitle={t('queueIntro')}
      /* The mockup also shows Export and New quotation here. Neither exists:
         there is no quotation export, and staff-originated quotations are not in
         Phase 1. Both are recorded in docs/gaps.md rather than drawn inert. */
      pipelineTitle={t('queuePipelineTitle', { count: total })}
      pipelineNote={
        unclaimed > 0
          ? t('queuePipelineNote_unclaimed', { count: unclaimed })
          : t('queuePipelineNote_none')
      }
      segments={segments}
      activeSegment={segment}
      onSegmentChange={restart(setSegment)}
      segmentsLabel={t('queueFilterState')}
      clearLabel={t('queueClearState')}
      segmentTitle={(count, label) => t('queueSegmentTitle', { count, state: label })}
      footnote={maySeeMargin ? t('queueFootnote') : undefined}
    >
      <ListingGrid
        caption={t('queueTitle')}
        searchLabel={t('queueSearchWide')}
        emptyLabel={t('queueNothing')}
        columns={columns}
        rows={rows}
        rowKey={(row: QuotationRow) => row.id}
        rowTone={(row: QuotationRow) => row.pipelineSegment}
        rowMinWidth="1180px"
        total={list.data?.total ?? 0}
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
            title: shared('quoteMode'),
            options: MODES.map((value) => ({ value, label: shared(`mode_${value}`) })),
          },
          { kind: 'dateRange', key: 'requested', title: shared('quoteRequested') },
        ]}
        filterValues={filters}
        onFilterChange={restart(setFilters)}
        segments={VIEWS.map((value) => ({
          value,
          label: t(`queueView_${value}`),
          count: value === 'all' ? total : value === 'unclaimed' ? unclaimed : expiring,
        }))}
        segment={view}
        onSegmentChange={restart(setView)}
        /* The band and the pills narrow the list from outside the grid, so the
           grid has to be told - otherwise an empty segment reads as "nothing has
           been quoted here" while the band above it is showing ten. */
        isFiltered={segment !== null || view !== 'all'}
        onClearFilters={() => {
          setSegment(null);
          setView('all');
          setPage(1);
        }}
        selection={{
          label: t('queueSelect'),
          rowLabel: (row: QuotationRow) => t('queueSelectRow', { reference: row.reference }),
          selected,
          onChange: setSelected,
          /*
           * Claim is the only bulk action that exists. The mockup also offers
           * Assign owner and Extend validity; neither has an endpoint, and a
           * bulk button that silently does nothing is the worst kind. Recorded
           * in docs/gaps.md.
           */
          actions: (
            <Button
              size="sm"
              variant="outline"
              disabled={claim.isPending}
              onClick={() => void claimSelected()}
            >
              {t('queueBulkClaim')}
            </Button>
          ),
        }}
        isPending={list.isPending}
        isFetching={list.isFetching}
      />
    </ListingHero>
  );
}
