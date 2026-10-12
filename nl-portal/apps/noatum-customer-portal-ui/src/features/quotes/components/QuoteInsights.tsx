import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plane, Ship, Train, Truck } from 'lucide-react';

import { Button, MeterCell, RingGauge, StatusPill, formatDate } from '../../../design-system';
import { formatMoney } from '../../pricing/money';
import type { QuoteInsights as Insights } from '../api/insights';
import styles from './QuoteInsights.module.css';

const MODE_ICON: Record<string, typeof Ship> = { sea: Ship, air: Plane, road: Truck, rail: Train };

/**
 * A stored status, in the words the quotations listing already uses.
 *
 * The listing speaks in pipeline segments and this table would otherwise print
 * raw statuses beside it - two vocabularies for one thing, on two screens a
 * customer moves between.
 */
const SEGMENT_OF: Record<string, string> = {
  published: 'options_ready',
  accepted: 'accepted',
  rejected: 'declined',
  withdrawn: 'declined',
  expired: 'expired',
};

const segmentOf = (status: string) => SEGMENT_OF[status] ?? 'in_progress';

/** The funnel's rails, darkest where the volume is. */
const FUNNEL_COLOUR: Record<string, string> = {
  requested: 'var(--noa-chart-2)',
  priced: 'var(--noa-chart-1)',
  accepted: 'var(--color-primary)',
  booked: 'var(--noa-chart-5)',
};

/** A card, so seven of them cannot drift apart. */
function Card({
  title,
  note,
  aside,
  children,
  className,
  sampled,
  sampleLabel,
}: {
  title: ReactNode;
  note?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Marks the panel as generated. Only the panels that are. */
  sampled?: boolean;
  sampleLabel?: string;
}) {
  return (
    <section className={[styles.card, className ?? ''].filter(Boolean).join(' ')}>
      <header className={styles.cardHead}>
        <div className={styles.cardLede}>
          <h2 className={styles.cardTitle}>
            {title}
            {sampled && <span className={styles.sample}>{sampleLabel}</span>}
          </h2>
          {note && <p className={styles.cardNote}>{note}</p>}
        </div>
        {aside && <div className={styles.cardAside}>{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/**
 * The quotations landing page, under the instant quote form.
 *
 * To REFERENCE/MOCKUP-htmls-page-vice, and in its order: what is waiting, how
 * requests turn into bookings, what a lane costs against the market, how fast a
 * price comes back, what was asked recently, and what is worth asking again.
 *
 * Four panels are marked as sample and the rest are not, because the rest are
 * real: the counts, the medians, the recent list and the reusable lanes all come
 * from this customer's own quotations. A single caveat across the page would
 * have made the measured figures look invented.
 */
export function QuoteInsights({ data }: { data: Insights }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [lane, setLane] = useState(0);

  const sampled = new Set(data.sampled);
  const sampleLabel = t('qiSample');
  const money = (minorUnits: number | null, currency?: string | null) =>
    minorUnits === null ? '—' : formatMoney(minorUnits, currency ?? data.currency);

  const chosen = data.rateLanes[lane] ?? data.rateLanes[0];
  const funnelMax = Math.max(1, ...data.funnel.map((step) => step.count ?? 0));
  const speedMax = Math.max(1, ...data.speed.map((entry) => entry.hours ?? 0));

  return (
    <div className={styles.grid}>
      {/* --- the five numbers ------------------------------------------------ */}
      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <p className={styles.kpiLabel}>{t('qiOpenRequests')}</p>
          <p className={styles.kpiValue}>{data.kpis.openRequests}</p>
          <p className={styles.kpiNote}>
            {t('qiWithOptions', { count: data.kpis.withOptionsReady })}
          </p>
        </article>

        <article className={styles.kpi}>
          <p className={styles.kpiLabel}>{t('qiExpiring')}</p>
          <p className={[styles.kpiValue, styles.alert].join(' ')}>{data.kpis.expiringThisWeek}</p>
          <p className={styles.kpiNote}>
            {data.kpis.expiringReference && data.kpis.expiringOn
              ? `${data.kpis.expiringReference} · ${formatDate(data.kpis.expiringOn)}`
              : t('qiNothingExpiring')}
          </p>
        </article>

        <article className={styles.kpi}>
          <p className={styles.kpiLabel}>{t('qiAccepted')}</p>
          <p className={styles.kpiValue}>
            {data.kpis.accepted}
            <span className={styles.kpiOf}>{t('qiOfPriced', { count: data.kpis.priced })}</span>
          </p>
          <p className={styles.kpiNote}>
            {data.kpis.priced === 0
              ? t('qiNothingPriced')
              : t('qiAcceptRate', {
                  percent: Math.round((data.kpis.accepted / data.kpis.priced) * 100),
                })}
          </p>
        </article>

        <article className={styles.kpi}>
          <p className={styles.kpiLabel}>{t('qiTimeToPrice')}</p>
          <p className={styles.kpiValue}>
            {data.kpis.medianHoursToPrice ?? '—'}
            {data.kpis.medianHoursToPrice !== null && <span className={styles.kpiOf}>{t('qiHours')}</span>}
          </p>
          <p className={styles.kpiNote}>{t('qiMedianNote')}</p>
        </article>

        {/* The only tile that is not measured. It is labelled rather than left
            out, because the panel it belongs to is what the page is for. */}
        <article className={styles.kpi}>
          <p className={styles.kpiLabel}>
            {t('qiSavedVsSpot')}
            {sampled.has('saved_vs_spot') && <span className={styles.sample}>{sampleLabel}</span>}
          </p>
          <p className={[styles.kpiValue, styles.good].join(' ')}>
            {money(data.kpis.savedVsSpotMinorUnits)}
          </p>
          <p className={styles.kpiNote}>{t('qiOnContractLanes')}</p>
        </article>
      </div>

      {/* --- what is waiting -------------------------------------------------- */}
      <Card
        title={t('qiWaitingTitle')}
        note={t('qiWaitingNote')}
        className={styles.wide}
        aside={
          <button type="button" className={styles.cardLink} onClick={() => navigate('/app/quotations/list')}>
            {t('qiAllQuotations')}
          </button>
        }
      >
        {data.waiting.length === 0 ? (
          <p className={styles.empty}>{t('qiWaitingEmpty')}</p>
        ) : (
          <div className={styles.waiting}>
            {data.waiting.map((quote) => (
              <article key={quote.id} className={styles.waitCard} data-state={quote.state}>
                <header className={styles.waitHead}>
                  <span className={styles.waitRef}>{quote.reference}</span>
                  <span className={styles.waitBadge}>{quote.badge}</span>
                </header>

                <p className={styles.waitLane}>
                  <strong>{quote.originCode}</strong>
                  <ArrowRight size={14} aria-hidden="true" />
                  <strong>{quote.destinationCode}</strong>
                </p>
                <p className={styles.waitCargo}>{quote.summary}</p>

                <div className={styles.waitPrice}>
                  <span className={styles.waitFrom}>
                    {quote.fromMinorUnits === null ? t('qiFirmPriceBy') : t('qiFrom')}
                  </span>
                  <span className={styles.waitAmount}>
                    {quote.fromMinorUnits === null
                      ? quote.validUntil
                        ? formatDate(quote.validUntil)
                        : '—'
                      : money(quote.fromMinorUnits, quote.currency)}
                  </span>
                </div>
                <span className={styles.waitRule} aria-hidden="true" />

                <p className={styles.waitValid}>
                  {quote.validUntil
                    ? t('qiValidTo', {
                        date: formatDate(quote.validUntil) ?? '',
                        days: quote.daysLeft ?? 0,
                      })
                    : t('qiWithDesk')}
                </p>

                <button
                  type="button"
                  className={styles.waitCta}
                  onClick={() => navigate(`/app/quotations/${quote.id}`)}
                >
                  {quote.state === 'with_desk' ? t('qiTrackRequest') : t('qiReviewOptions')}{' '}
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        )}
      </Card>

      {/* --- the funnel -------------------------------------------------------- */}
      <Card title={t('qiFunnelTitle')} note={t('qiFunnelNote')}>
        <ol className={styles.funnel}>
          {data.funnel.map((step, index) => (
            <li key={step.key}>
              <div className={styles.funnelRow}>
                <span className={styles.funnelLabel}>
                  {t(`qiFunnel_${step.key}`)}
                  {step.count === null && <span className={styles.sample}>{sampleLabel}</span>}
                </span>
                <span className={styles.funnelCount}>{step.count ?? '—'}</span>
              </div>
              <span className={styles.funnelTrack} aria-hidden="true">
                <span
                  className={styles.funnelFill}
                  style={{
                    inlineSize: `${((step.count ?? 0) / funnelMax) * 100}%`,
                    background: FUNNEL_COLOUR[step.key],
                  }}
                />
              </span>
              {index < data.funnel.length - 1 && data.funnel[index + 1]?.movePercent !== null && (
                <p className={styles.funnelMove}>
                  {t('qiMoveOn', { percent: data.funnel[index + 1]?.movePercent })}
                </p>
              )}
            </li>
          ))}
        </ol>
        {data.funnelNote && <p className={styles.cardFoot}>{data.funnelNote}</p>}
      </Card>

      {/* --- contract against market ------------------------------------------- */}
      <Card
        title={t('qiRateTitle')}
        note={chosen ? t('qiRateNote', { lane: chosen.label, basis: chosen.basis }) : undefined}
        className={styles.wide}
        sampled={sampled.has('rate_lanes')}
        sampleLabel={sampleLabel}
        aside={
          data.rateLanes.length > 1 && (
            <div className={styles.laneTabs} role="group" aria-label={t('qiRateTitle')}>
              {data.rateLanes.map((entry, index) => (
                <button
                  key={entry.key}
                  type="button"
                  className={styles.laneTab}
                  aria-pressed={index === lane}
                  onClick={() => setLane(index)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )
        }
      >
        {!chosen ? (
          <p className={styles.empty}>{t('qiRateEmpty')}</p>
        ) : (
          <RateChart lane={chosen} money={money} labelFor={(month) => monthLabel(month, i18n.language)} />
        )}
      </Card>

      {/* --- how fast a price comes back ---------------------------------------- */}
      <Card title={t('qiSpeedTitle')} note={t('qiSpeedNote')}>
        <div className={styles.speedHead}>
          <RingGauge
            value={data.kpis.instantPercent}
            label={t('qiInstantShare')}
            valueLabel={`${data.kpis.instantPercent}%`}
            tone="success"
            formatValueText={(value) => t('qiInstantPercent', { percent: value })}
          />
          <p className={styles.speedLede}>
            {t('qiInstantLede')}
            {sampled.has('instant_share') && <span className={styles.sample}>{sampleLabel}</span>}
          </p>
        </div>

        <ul className={styles.speedList}>
          {data.speed.map((entry) => (
            <li key={entry.key}>
              <span className={styles.speedLabel}>{t(`qiSpeed_${entry.key}`)}</span>
              <MeterCell
                ratio={(entry.hours ?? 0) / speedMax}
                label={entry.hours === null ? t('qiNoneYet') : t('qiHoursValue', { hours: entry.hours })}
                tone={entry.hours === null ? 'neutral' : entry.hours <= 4 ? 'good' : 'warning'}
              />
            </li>
          ))}
        </ul>
      </Card>

      {/* --- the recent list ----------------------------------------------------- */}
      <Card
        title={t('qiRecentTitle')}
        note={t('qiRecentNote')}
        className={styles.wide}
        aside={
          <button type="button" className={styles.cardLink} onClick={() => navigate('/app/quotations/list')}>
            {t('qiOpenFullList')}
          </button>
        }
      >
        {data.recent.length === 0 ? (
          <p className={styles.empty}>{t('qiRecentEmpty')}</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('qiReference')}</th>
                  <th scope="col">{t('qiLane')}</th>
                  <th scope="col">{t('qiMode')}</th>
                  <th scope="col">{t('qiSent')}</th>
                  <th scope="col">{t('qiStatus')}</th>
                  <th scope="col" className={styles.numeric}>{t('qiPrice')}</th>
                  <th scope="col">{t('qiNext')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <button
                        type="button"
                        className={styles.rowLink}
                        onClick={() => navigate(`/app/quotations/${row.id}`)}
                      >
                        {row.reference}
                      </button>
                    </th>
                    <td>
                      {row.originCode} <span aria-hidden="true">→</span> {row.destinationCode}
                    </td>
                    <td>{row.mode}</td>
                    <td>{formatDate(row.sentAt)}</td>
                    <td>
                      <StatusPill tone={segmentOf(row.status)}>
                        {t(`quoteSegment_${segmentOf(row.status)}`)}
                      </StatusPill>
                    </td>
                    <td className={styles.numeric}>{money(row.priceMinorUnits, row.currency)}</td>
                    <td className={styles.next}>{row.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --- ask again ------------------------------------------------------------ */}
      <Card title={t('qiReuseTitle')} note={t('qiReuseNote')}>
        {data.reuse.length === 0 ? (
          <p className={styles.empty}>{t('qiReuseEmpty')}</p>
        ) : (
          <ul className={styles.reuse}>
            {data.reuse.map((entry) => {
              const Icon = MODE_ICON[entry.mode] ?? Ship;
              return (
                <li key={entry.id}>
                  <span className={styles.reuseIcon} aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <span className={styles.reuseLede}>
                    <strong>
                      {entry.originCode} <span aria-hidden="true">→</span> {entry.destinationCode}
                    </strong>
                    <small>
                      {entry.summary} · {entry.outcome}
                    </small>
                  </span>
                  {/* Opens the full request rather than prefilling the strip: the
                      strip is four questions and this lane carries more than four
                      answers, so the form that can hold them all is the honest
                      place to land. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/app/quotations/${entry.id}`)}
                  >
                    {t('qiReuse')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className={styles.cardFoot}>
          {t('qiNeedMore')}{' '}
          <button type="button" className={styles.cardLink} onClick={() => navigate('/app/quotations/new')}>
            {t('qiDetailedRequest')}
          </button>
        </p>
      </Card>
    </div>
  );
}

/** "OCT" — the axis label under a point. */
function monthLabel(month: string, locale: string) {
  return new Date(`${month}T00:00:00Z`)
    .toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })
    .toUpperCase();
}

/**
 * Contract against spot.
 *
 * Its own component rather than the shared chart kit: this is two series read
 * as a gap rather than as two lines, so the area between them is the subject and
 * the fill belongs to neither series. The kit's TrendLine draws one series.
 */
function RateChart({
  lane,
  money,
  labelFor,
}: {
  lane: Insights['rateLanes'][number];
  money: (value: number | null, currency?: string | null) => string;
  labelFor: (month: string) => string;
}) {
  const { t } = useTranslation();
  const pad = { top: 16, right: 14, bottom: 26, left: 52 };
  const box = { width: 760, height: 250 };
  const plotWidth = box.width - pad.left - pad.right;
  const plotHeight = box.height - pad.top - pad.bottom;

  const values = lane.points.flatMap((point) => [point.contractMinorUnits, point.spotMinorUnits]);
  const low = Math.min(...values) * 0.94;
  const high = Math.max(...values) * 1.02;

  const x = (index: number) => pad.left + (plotWidth / Math.max(1, lane.points.length - 1)) * index;
  const y = (value: number) => pad.top + plotHeight - ((value - low) / Math.max(1, high - low)) * plotHeight;

  const contract = lane.points.map((point, index) => `${x(index)},${y(point.contractMinorUnits)}`);
  const spot = lane.points.map((point, index) => `${x(index)},${y(point.spotMinorUnits)}`);

  return (
    <div className={styles.rate}>
      <div className={styles.rateLegend}>
        <span>
          <span className={styles.rateSwatchContract} aria-hidden="true" /> {t('qiContractRate')}
        </span>
        <span>
          <span className={styles.rateSwatchSpot} aria-hidden="true" /> {t('qiMarketSpot')}
        </span>
        <strong className={styles.rateSaving}>
          {t('qiAverageSaving', { percent: lane.savingPercent })}
        </strong>
      </div>

      <svg viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label={lane.label}>
        {[low, (low + high) / 2, high].map((tick) => (
          <g key={tick}>
            <line className={styles.rateGrid} x1={pad.left} x2={box.width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className={styles.rateAxis} x={pad.left - 8} y={y(tick) + 3} textAnchor="end">
              {money(Math.round(tick), lane.currency)}
            </text>
          </g>
        ))}

        {/* The gap is the point of the chart, so it is filled rather than left
            to be measured between two lines by eye. */}
        <polygon className={styles.rateGap} points={[...spot, ...contract.slice().reverse()].join(' ')} />
        <polyline className={styles.rateSpot} points={spot.join(' ')} />
        <polyline className={styles.rateContract} points={contract.join(' ')} />

        {lane.points.map((point, index) => (
          <text
            key={point.month}
            className={styles.rateAxis}
            x={x(index)}
            y={box.height - pad.bottom + 15}
            textAnchor="middle"
          >
            {labelFor(point.month)}
          </text>
        ))}
      </svg>

      <table className="noa-visually-hidden">
        <caption>{lane.label}</caption>
        <thead>
          <tr>
            <th scope="col">{t('qiMonth')}</th>
            <th scope="col">{t('qiContractRate')}</th>
            <th scope="col">{t('qiMarketSpot')}</th>
          </tr>
        </thead>
        <tbody>
          {lane.points.map((point) => (
            <tr key={point.month}>
              <th scope="row">{labelFor(point.month)}</th>
              <td>{money(point.contractMinorUnits, lane.currency)}</td>
              <td>{money(point.spotMinorUnits, lane.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
