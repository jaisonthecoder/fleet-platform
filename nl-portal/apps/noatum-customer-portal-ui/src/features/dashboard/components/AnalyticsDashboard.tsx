import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, FileText, Receipt, Search, Sparkles } from 'lucide-react';

import {
  BarLineChart,
  Button,
  ChartLegend,
  ColumnBars,
  DonutChart,
  MeterCell,
  MiniLine,
  RangeBars,
  RouteBreadcrumb,
  SplitBar,
  StatusPill,
  TrendLine,
  type DonutSlice,
} from '../../../design-system';
import { Co2Calculator } from '../../../shared/components/Co2Calculator';
import { formatMoney } from '../../pricing/money';
import type {
  DashboardAnalytics,
  DashboardFilters,
  DashboardModeFilter,
  DashboardPeriod,
} from '../api/analytics';
import styles from './AnalyticsDashboard.module.css';

/** The colour each mode takes, everywhere on the page. */
const MODE_COLOUR: Record<string, string> = {
  sea_fcl: 'var(--noa-chart-1)',
  sea_lcl: 'var(--noa-chart-2)',
  air: 'var(--noa-chart-3)',
};

/** The block the emissions panel links down to. */
const CALCULATOR_ID = 'dashboard-co2-calculator';

const PERIODS: DashboardPeriod[] = ['3m', '6m', '12m'];
const MODES: DashboardModeFilter[] = ['all', 'sea_fcl', 'sea_lcl', 'air'];

const ACTION_ICON: Record<string, typeof FileText> = {
  quote_decision: FileText,
  customs_hold: AlertTriangle,
  free_time: Clock,
  overdue_invoice: Receipt,
};

/** A panel, so nine of them cannot drift apart. */
function Panel({
  title,
  caption,
  aside,
  children,
  className,
}: {
  title: ReactNode;
  caption?: ReactNode;
  /** The right of the header: a legend, a link, a total. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={[styles.panel, className ?? ''].filter(Boolean).join(' ')}>
      <header className={styles.panelHead}>
        <div className={styles.panelLede}>
          <h2 className={styles.panelTitle}>{title}</h2>
          {caption && <p className={styles.panelCaption}>{caption}</p>}
        </div>
        {aside && <div className={styles.panelAside}>{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export interface AnalyticsDashboardProps {
  data: DashboardAnalytics;
  filters: DashboardFilters;
  onFilters: (filters: DashboardFilters) => void;
  /** True while a filter change is in flight; the old figures stay and dim. */
  busy?: boolean;
}

/**
 * The customer's dashboard.
 *
 * One question, asked from eleven directions: is my freight going well, and
 * what is it costing me. The order is deliberate and is the order a forwarding
 * customer actually reads in:
 *
 *   1. what needs me today          — the only part that is a to-do list
 *   2. the five numbers              — volume, reliability, speed, cost, debt
 *   3. volume and spend over time    — the shape of the relationship
 *   4. what is moving right now      — today's operational picture
 *   5. reliability and transit       — did we do what we promised
 *   6. lane performance              — where the volume and the money sit
 *   7. cost, debt and carbon         — what it added up to
 *
 * Every figure arrives formatted or is formatted here from minor units; nothing
 * on this screen recomputes a total the server already owns. And every chart
 * carries a hidden table of its own numbers, because a dashboard that can only
 * be read by looking at it is a picture, not a report.
 */
export function AnalyticsDashboard({ data, filters, onFilters, busy }: AnalyticsDashboardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  /*
   * Money, shortened.
   *
   * A dashboard is read at a glance and compared column to column, so a lane
   * worth "EUR 118k" is more useful than one worth "EUR 118,020.00" — twelve
   * characters of which are noise that pushes the next column off the screen.
   * The full figure belongs on the invoice and the quotation, where somebody is
   * checking it rather than scanning it.
   *
   * The same rounding the server uses for the KPI tiles, so the tile and the
   * table cannot disagree about what 118k means.
   */
  const money = (minorUnits: number) => {
    // A trailing ".0" is a decimal that says nothing: 92.0k is 92k.
    const round = (value: number) => value.toFixed(1).replace(/\.0$/, '');
    const major = minorUnits / 100;
    if (major === 0) return `${data.currency} 0`;
    if (Math.abs(major) >= 1_000_000) return `${data.currency} ${round(major / 1_000_000)}M`;
    if (Math.abs(major) >= 100_000) return `${data.currency} ${Math.round(major / 1000)}k`;
    if (Math.abs(major) >= 1000) return `${data.currency} ${round(major / 1000)}k`;
    return formatMoney(minorUnits, data.currency);
  };

  /** "OCT\n2025" — the year only where it changes, as the mockup draws it. */
  const monthLabels = useMemo(
    () =>
      data.monthly.map((entry, index) => {
        const date = new Date(`${entry.month}T00:00:00Z`);
        const month = date
          .toLocaleDateString(i18n.language, { month: 'short', timeZone: 'UTC' })
          .toUpperCase();
        const previous = data.monthly[index - 1];
        const changedYear =
          index === 0 || (previous && new Date(`${previous.month}T00:00:00Z`).getUTCFullYear() !== date.getUTCFullYear());
        return changedYear ? `${month}\n${date.getUTCFullYear()}` : month;
      }),
    [data.monthly, i18n.language],
  );

  const shortMonths = monthLabels.map((label) => label.split('\n')[0] ?? label);

  const modeSlices: DonutSlice[] = data.modeMix.map((slice) => ({
    key: slice.mode,
    label: t(`dashMode_${slice.mode}`),
    colour: MODE_COLOUR[slice.mode] ?? 'var(--noa-chart-1)',
    value: slice.shipments,
  }));

  const totalShipments = data.modeMix.reduce((sum, slice) => sum + slice.shipments, 0);
  const stageTotal = data.inFlight.stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className={styles.page} data-busy={busy ? 'true' : undefined}>
      {/* --- the band ------------------------------------------------------ */}
      <section className={styles.hero}>
        <div className={styles.heroPattern} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <RouteBreadcrumb
              label={t('breadcrumb')}
              homeHref="/app/dashboard"
              homeLabel={t('customerNav_dashboard')}
              steps={[{ id: 'dashboard', label: t('customerNav_dashboard') }]}
            />
            {/*
              Where the figures came from, printed rather than implied.
              On a pilot environment most of this dashboard is generated, and a
              customer reading an invented spend as their own is the one failure
              this screen is most able to cause.
            */}
            <p className={styles.asOf}>
              {data.source === 'sample' ? (
                <span className={styles.sample}>
                  <Sparkles size={12} aria-hidden="true" /> {t('dashSample')}
                </span>
              ) : (
                <span className={styles.asOfDot} aria-hidden="true" />
              )}
              {t('dashAsOf', {
                when: new Date(data.asOf).toLocaleString(i18n.language, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                source: data.source === 'sample' ? t('dashSourceSample') : t('dashSourceCargowise'),
              })}
            </p>
          </div>

          <p className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            {[data.customerName, ...data.officeNames].filter(Boolean).join(' · ')}
          </p>

          <div className={styles.heroRow}>
            <div className={styles.heroLede}>
              <h1 className={styles.heading}>{t('dashGreeting', { name: data.firstName })}</h1>
              <p className={styles.lede}>
                {t('dashSubtitle', {
                  inFlight: data.inFlightCount,
                  offices: data.officeNames.join(', ') || data.customerName,
                  arriving: data.arrivingSoonCount,
                })}
              </p>
            </div>
            <div className={styles.heroActions}>
              <Button variant="outline" onDark onClick={() => navigate('/app/shipments')}>
                <Search size={15} aria-hidden="true" /> {t('dashTrack')}
              </Button>
              <Button onDark onClick={() => navigate('/app/quotations')}>
                <FileText size={15} aria-hidden="true" /> {t('dashRequestQuote')}
              </Button>
            </div>
          </div>

          {/* --- filters ------------------------------------------------------ */}
          <div className={styles.filters}>
            <span className={styles.filterLabel}>{t('dashPeriod')}</span>
            <div
              className={[styles.filterGroup, styles.periodGroup].join(' ')}
              role="group"
              aria-label={t('dashPeriod')}
            >
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.period === period}
                  onClick={() => onFilters({ ...filters, period })}
                >
                  {t(`dashPeriod_${period}`)}
                </button>
              ))}
            </div>

            <span className={styles.filterRule} aria-hidden="true" />

            <span className={styles.filterLabel}>{t('dashModeFilter')}</span>
            <div className={styles.filterGroup} role="group" aria-label={t('dashModeFilter')}>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.mode === mode}
                  onClick={() => onFilters({ ...filters, mode })}
                >
                  {mode !== 'all' && (
                    <span
                      className={styles.chipDot}
                      style={{ background: MODE_COLOUR[mode] }}
                      aria-hidden="true"
                    />
                  )}
                  {t(`dashMode_${mode}`)}
                </button>
              ))}
            </div>

            <p className={styles.filterSummary}>
              {t('dashFilterSummary', {
                period: t(`dashPeriodLong_${filters.period}`),
                mode: t(`dashMode_${filters.mode}`).toLowerCase(),
              })}
            </p>
          </div>
        </div>
      </section>

      <div className={styles.body}>
        {/* --- what needs you ------------------------------------------------ */}
        {data.actions.length > 0 && (
          <Panel
            title={t('dashNeedsYou')}
            caption={t('dashNeedsYouNote', { count: data.actions.length })}
            className={styles.needs}
          >
            <div className={styles.actions}>
              {data.actions.map((action) => {
                const Icon = ACTION_ICON[action.key] ?? AlertTriangle;
                return (
                  <article key={action.key} className={styles.action} data-tone={action.tone}>
                    <header>
                      <span className={styles.actionIcon} aria-hidden="true">
                        <Icon size={14} />
                      </span>
                      <span className={styles.actionBadge}>{action.badge}</span>
                    </header>
                    <h3 className={styles.actionTitle}>{action.title}</h3>
                    <p className={styles.actionDetail}>{action.detail}</p>
                    {/* A card whose destination has not shipped says so rather
                        than offering a link that goes nowhere. */}
                    {action.href ? (
                      <button
                        type="button"
                        className={styles.actionCta}
                        onClick={() => navigate(action.href)}
                      >
                        {action.cta} <ArrowRight size={13} aria-hidden="true" />
                      </button>
                    ) : (
                      <span className={styles.actionSoon}>{t('dashNotYetAvailable')}</span>
                    )}
                  </article>
                );
              })}
            </div>
          </Panel>
        )}

        {/* --- the five numbers ---------------------------------------------- */}
        <div className={styles.kpis}>
          {data.kpis.map((kpi) => (
            <article key={kpi.key} className={styles.kpi}>
              <p className={styles.kpiLabel}>
                {t(`dashKpi_${kpi.key}`)}
                <span className={styles.kpiMark} data-key={kpi.key} aria-hidden="true" />
              </p>
              <p className={styles.kpiValue}>
                {kpi.value}
                {kpi.unit && <span className={styles.kpiUnit}>{kpi.unit}</span>}
              </p>
              <MiniLine values={kpi.spark} label={t(`dashKpi_${kpi.key}`)} />
              <p className={styles.kpiFoot}>
                {kpi.delta && (
                  <span className={styles.kpiDelta} data-tone={kpi.deltaTone}>
                    {kpi.deltaDirection === 'up' ? '▲' : kpi.deltaDirection === 'down' ? '▼' : ''}
                    {kpi.delta}
                  </span>
                )}
                {kpi.caption && <span className={styles.kpiCaption}>{kpi.caption}</span>}
              </p>
            </article>
          ))}
        </div>

        {/* --- volume and spend ---------------------------------------------- */}
        <div className={styles.twoUp}>
          <Panel
            title={t('dashVolumeTitle')}
            caption={t('dashVolumeNote')}
            aside={
              <ChartLegend
                items={[
                  ...data.modeMix.map((slice) => ({
                    label: t(`dashMode_${slice.mode}`),
                    colour: MODE_COLOUR[slice.mode] ?? 'var(--noa-chart-1)',
                  })),
                  { label: t('dashSpend'), colour: 'var(--noa-chart-4)', line: true },
                ]}
              />
            }
          >
            <BarLineChart
              chartLabel={t('dashVolumeTitle')}
              labels={monthLabels}
              series={data.modeMix.map((slice) => ({
                key: slice.mode,
                label: t(`dashMode_${slice.mode}`),
                colour: MODE_COLOUR[slice.mode] ?? 'var(--noa-chart-1)',
                values: data.monthly.map((entry) =>
                  slice.mode === 'sea_fcl' ? entry.seaFcl : slice.mode === 'sea_lcl' ? entry.seaLcl : entry.air,
                ),
              }))}
              line={{
                label: t('dashSpend'),
                colour: 'var(--noa-chart-4)',
                values: data.monthly.map((entry) => entry.spendMinorUnits),
                format: (value) => money(value),
              }}
              formatBar={(value) => String(Math.round(value))}
            />
          </Panel>

          <Panel title={t('dashModeMix')} caption={t('dashModeMixNote')} className={styles.mixPanel}>
            <DonutChart
              slices={modeSlices}
              centreValue={totalShipments}
              centreLabel={t('dashShipmentsUnit')}
              chartLabel={t('dashModeMix')}
            />
            <ul className={styles.mixList}>
              {data.modeMix.map((slice) => (
                <li key={slice.mode}>
                  <span
                    className={styles.mixSwatch}
                    style={{ background: MODE_COLOUR[slice.mode] }}
                    aria-hidden="true"
                  />
                  <span className={styles.mixLabel}>{t(`dashMode_${slice.mode}`)}</span>
                  <span className={styles.mixCount}>{slice.shipments}</span>
                  <span className={styles.mixSpend}>{money(slice.spendMinorUnits)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* --- what is moving now -------------------------------------------- */}
        <Panel
          title={t('dashInFlight')}
          caption={t('dashInFlightNote', {
            count: stageTotal,
            delivered: data.inFlight.deliveredRecently,
          })}
          aside={
            <button type="button" className={styles.panelLink} onClick={() => navigate('/app/shipments')}>
              {t('dashAllShipments')}
            </button>
          }
        >
          <SplitBar
            chartLabel={t('dashInFlight')}
            parts={data.inFlight.stages.map((stage, index) => ({
              key: stage.key,
              label: t(`dashStage_${stage.key}`),
              colour: `var(--noa-chart-stage-${index + 1})`,
              value: stage.count,
            }))}
            format={(value) => String(value)}
          />
          <ul className={styles.stages}>
            {data.inFlight.stages.map((stage, index) => (
              <li key={stage.key}>
                <span
                  className={styles.stageSwatch}
                  style={{ background: `var(--noa-chart-stage-${index + 1})` }}
                  aria-hidden="true"
                />
                <span className={styles.stageLabel}>{t(`dashStage_${stage.key}`)}</span>
                <span className={styles.stageCount}>{stage.count}</span>
              </li>
            ))}
          </ul>

          <p className={styles.subHead}>{t('dashArrivingNext')}</p>
          <ul className={styles.arrivals}>
            {data.inFlight.arrivingNext.map((arrival) => {
              const date = new Date(`${arrival.date}T00:00:00Z`);
              return (
                <li key={arrival.reference} className={styles.arrival}>
                  <span className={styles.arrivalDate}>
                    <strong>{date.toLocaleDateString(i18n.language, { day: '2-digit', timeZone: 'UTC' })}</strong>
                    <small>
                      {date
                        .toLocaleDateString(i18n.language, { month: 'short', timeZone: 'UTC' })
                        .toUpperCase()}
                    </small>
                  </span>
                  <span className={styles.arrivalRef}>
                    <strong>{arrival.reference}</strong>
                    <small>{arrival.lane}</small>
                  </span>
                  <span className={styles.arrivalNote}>{arrival.note}</span>
                  <StatusPill tone={arrival.tone === 'good' ? 'accepted' : arrival.tone === 'action' ? 'expiring_soon' : 'in_progress'}>
                    {arrival.status}
                  </StatusPill>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* --- did we do what we promised ------------------------------------ */}
        <div className={[styles.twoUp, styles.evenUp].join(" ")}>
          <Panel
            title={t('dashOnTime')}
            caption={t('dashOnTimeNote', { target: data.onTime.targetPercent })}
            aside={
              <span className={styles.panelFigure}>
                {data.onTime.percent}%
                <small>
                  {t('dashOnTargetMonths', {
                    on: data.onTime.monthsOnTarget,
                    total: data.onTime.points.length,
                  })}
                </small>
              </span>
            }
          >
            <TrendLine
              chartLabel={t('dashOnTime')}
              labels={shortMonths}
              values={data.onTime.points.map((point) => point.percent)}
              target={data.onTime.targetPercent}
              targetLabel={t('dashTarget', { target: data.onTime.targetPercent })}
            />
          </Panel>

          <Panel
            title={t('dashTransit')}
            caption={t('dashTransitNote')}
            aside={
              <ChartLegend
                items={[
                  { label: t('dashQuoted'), colour: 'var(--color-primary)' },
                  { label: t('dashActual'), colour: 'var(--noa-chart-2)' },
                  { label: t('dashAverage'), colour: 'var(--noa-chart-1)' },
                ]}
              />
            }
          >
            <RangeBars
              chartLabel={t('dashTransit')}
              axisLabel={(value) => `${Math.round(value)}`}
              rows={data.transit.map((row) => ({
                key: row.lane,
                label: row.lane,
                quotedMin: row.quotedMinDays,
                quotedMax: row.quotedMaxDays,
                actualMin: row.actualMinDays,
                actualMax: row.actualMaxDays,
                average: row.averageDays,
                value: t('dashDays', { days: row.averageDays }),
              }))}
            />
          </Panel>
        </div>

        {/* --- lane performance ---------------------------------------------- */}
        <Panel
          title={t('dashLanes')}
          caption={t('dashLanesNote')}
          aside={
            <span className={styles.panelFigure}>
              {t('dashLaneCount', { count: data.lanes.length })}
              <small>{money(data.spend.totalMinorUnits)}</small>
            </span>
          }
        >
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('dashLane')}</th>
                  <th scope="col">{t('dashModeColumn')}</th>
                  <th scope="col" className={styles.numeric}>{t('dashShipments')}</th>
                  <th scope="col">{t('dashAvgTransit')}</th>
                  <th scope="col">{t('dashOnTimeColumn')}</th>
                  <th scope="col" className={styles.numeric}>{t('dashSpend')}</th>
                  <th scope="col">{t('dashTrend')}</th>
                  <th scope="col">{t('dashShareOfSpend')}</th>
                </tr>
              </thead>
              <tbody>
                {data.lanes.map((lane) => (
                  <tr key={`${lane.originCode}-${lane.destinationCode}-${lane.mode}`}>
                    <th scope="row">
                      <span className={styles.lane}>
                        <span className={styles.laneEnd}>
                          <strong>{lane.originCode}</strong>
                          <small>{lane.originName}</small>
                        </span>
                        <ArrowRight size={13} aria-hidden="true" className={styles.laneArrow} />
                        <span className={styles.laneEnd}>
                          <strong>{lane.destinationCode}</strong>
                          <small>{lane.destinationName}</small>
                        </span>
                      </span>
                    </th>
                    <td>
                      <span className={styles.modeTag} data-mode={lane.mode}>
                        {t(`dashMode_${lane.mode}`)}
                      </span>
                    </td>
                    <td className={styles.numeric}>{lane.shipments}</td>
                    <td>
                      <span className={styles.transit}>
                        <strong>{t('dashDays', { days: lane.averageTransitDays })}</strong>
                        {/* The quote beside the outcome, because "31.6 days" only
                            means something against what was promised. */}
                        <small>
                          {t('dashQuotedWindow', { min: lane.quotedMinDays, max: lane.quotedMaxDays })}
                        </small>
                      </span>
                    </td>
                    <td>
                      <MeterCell
                        ratio={lane.onTimePercent / 100}
                        label={`${lane.onTimePercent}%`}
                        tone={lane.onTimePercent >= 90 ? 'good' : lane.onTimePercent >= 80 ? 'warning' : 'bad'}
                      />
                    </td>
                    <td className={styles.numeric}>{money(lane.spendMinorUnits)}</td>
                    <td>
                      <MiniLine values={lane.trend} label={t('dashTrend')} />
                    </td>
                    <td>
                      <MeterCell ratio={lane.sharePercent / 100} label={`${lane.sharePercent}%`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* --- cost, debt and carbon ------------------------------------------ */}
        <div className={styles.threeUp}>
          <Panel
            title={t('dashSpendSplit')}
            caption={t('dashSpendSplitNote', { total: money(data.spend.totalMinorUnits) })}
          >
            <SplitBar
              chartLabel={t('dashSpendSplit')}
              parts={data.spend.slices.map((slice) => ({
                key: slice.key,
                label: slice.label,
                colour: `var(--noa-chart-tone-${slice.tone})`,
                value: slice.amountMinorUnits,
              }))}
              format={money}
            />
            <ul className={styles.splitList}>
              {data.spend.slices.map((slice) => (
                <li key={slice.key}>
                  <span
                    className={styles.mixSwatch}
                    style={{ background: `var(--noa-chart-tone-${slice.tone})` }}
                    aria-hidden="true"
                  />
                  <span className={styles.mixLabel}>{slice.label}</span>
                  <span className={styles.mixCount}>{money(slice.amountMinorUnits)}</span>
                  <span className={styles.mixShare}>{slice.percent}%</span>
                </li>
              ))}
            </ul>
            {data.spend.note && <p className={styles.panelNote}>{data.spend.note}</p>}
          </Panel>

          <Panel
            title={t('dashInvoices')}
            caption={t('dashInvoicesNote', {
              open: money(data.invoices.openMinorUnits),
              terms: data.invoices.termsDays,
            })}
            aside={
              <button type="button" className={styles.panelLink} onClick={() => navigate('/app/invoices')}>
                {t('dashStatement')}
              </button>
            }
          >
            <ColumnBars
              chartLabel={t('dashInvoices')}
              showValues
              labels={data.invoices.ageing.map((bucket) => t(`dashAgeing_${bucket.bucket}`))}
              values={data.invoices.ageing.map((bucket) => bucket.amountMinorUnits)}
              /* A bucket with nothing in it reads as a dash: "EUR 0" over an empty
                 column is a value somebody has to stop and dismiss. */
              format={(value) => (value === 0 ? "—" : money(value))}
              colour="var(--noa-chart-1)"
            />
            <div className={styles.credit}>
              <p className={styles.creditRow}>
                <span>{t('dashCreditUsed')}</span>
                <strong>
                  {t('dashCreditOf', {
                    used: money(data.invoices.creditUsedMinorUnits),
                    limit: money(data.invoices.creditLimitMinorUnits),
                  })}
                </strong>
              </p>
              <MeterCell
                ratio={
                  data.invoices.creditLimitMinorUnits === 0
                    ? 0
                    : data.invoices.creditUsedMinorUnits / data.invoices.creditLimitMinorUnits
                }
                label={`${Math.round(
                  (data.invoices.creditUsedMinorUnits / Math.max(1, data.invoices.creditLimitMinorUnits)) * 100,
                )}%`}
                tone={
                  data.invoices.creditUsedMinorUnits / Math.max(1, data.invoices.creditLimitMinorUnits) > 0.8
                    ? 'bad'
                    : 'neutral'
                }
              />
            </div>
          </Panel>

          <Panel
            title={t('dashEmissions')}
            caption={data.emissions.basis}
            aside={
              <button
                type="button"
                className={styles.panelLink}
                onClick={() =>
                  document
                    .getElementById(CALCULATOR_ID)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {t('dashCalculator')}
              </button>
            }
          >
            <p className={styles.emissionTotal}>
              {data.emissions.totalTonnes.toLocaleString(i18n.language)}
              <span>{t('dashTonnesCo2')}</span>
            </p>
            <ColumnBars
              chartLabel={t('dashEmissions')}
              labels={shortMonths}
              values={data.emissions.monthly.map((entry) => entry.tonnes)}
              format={(value) => t('dashTonnes', { tonnes: value })}
              colour="var(--noa-chart-5)"
            />
            <ul className={styles.emissionModes}>
              {data.emissions.byMode.map((slice) => (
                <li key={slice.mode}>
                  <span className={styles.mixLabel}>{t(`dashMode_${slice.mode}`)}</span>
                  <MeterCell
                    ratio={slice.percent / 100}
                    label={`${slice.percent}%`}
                    tone={slice.mode === 'air' ? 'bad' : 'neutral'}
                  />
                </li>
              ))}
            </ul>
            {data.emissions.note && <p className={styles.panelNote}>{data.emissions.note}</p>}
          </Panel>
        </div>

        {/*
          The calculator itself, last.
          The panel above reports what this account already emitted; this asks
          "what would a lane emit", which is a different question and the only
          thing on the page that is not about freight already booked. It closes
          the page rather than interrupting it, and the emissions panel links
          down to it.
        */}
        <Co2Calculator
          id={CALCULATOR_ID}
          className={styles.calculator}
          onSearchRates={() => navigate('/app/quotations/new')}
        />
      </div>
    </div>
  );
}
