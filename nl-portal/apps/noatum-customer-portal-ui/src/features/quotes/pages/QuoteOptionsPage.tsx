import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Download, Plane, Ship, Truck, X,
} from 'lucide-react';
import { formatDate, RouteBreadcrumb } from '../../../design-system';
import { cargoCaption } from '../../../shared/quotations/listing';
// The drawer and the dialog live beside the page that opens them.
import { CustomerRequestDrawer } from '../components/CustomerRequestDrawer';
import { OptionDetail } from '../components/OptionDetail';
import { RejectDialog } from '../components/RejectDialog';
import { formatMoney } from '../../pricing/money';
import type { CustomerQuote, CustomerQuoteOption } from '../api/quotes';
import styles from './QuoteOptionsPage.module.css';

const MODE_ICON: Record<string, typeof Ship> = { sea: Ship, air: Plane, road: Truck, rail: Truck };

/** The long tail of the request, as the customer submitted it. */
interface RequestExtras {
  direction?: string;
  scope?: string;
  namedPlace?: string | null;
  deliveryAddress?: string | null;
  additionalServices?: string[];
  costCentre?: string | null;
  commodity?: string | null;
}

interface Props {
  data: CustomerQuote;
  canDecide: boolean;
  busy: boolean;
  failure: string | null;
  onAccept: (optionId: string) => void;
  onDecline: (reason: string) => void;
}

/**
 * The quotation, once it has been priced.
 *
 * A different screen from the one a customer watches while we work on it. There
 * is a decision to make here, and the page is built around making it: the
 * options are the largest thing on it, they can be compared side by side, and
 * everything else - the request, the history, the versions - is context for
 * choosing between them.
 *
 * Two pages rather than one that changes shape, because the two jobs share
 * almost nothing: waiting needs reassurance and a date; deciding needs numbers
 * next to each other.
 */
export function QuoteOptionsPage({
  data, canDecide: permittedToDecide, busy, failure, onAccept, onDecline,
}: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const options = data.options;
  const [selected, setSelected] = useState(() => {
    const recommended = options.findIndex((option) => option.isRecommended);
    return recommended === -1 ? 0 : recommended;
  });
  const [window_, setWindow] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [showingRequest, setShowingRequest] = useState(false);

  /* The same sheet the pricing desk reads, from the right: the comparison is
     what they are in the middle of, and a page would lose their place in it. */
  const onViewRequest = () => setShowingRequest(true);

  const extra = (data.payload ?? {}) as RequestExtras;
  const Icon = MODE_ICON[data.mode] ?? Ship;
  const current = options[Math.min(selected, options.length - 1)];

  // Two to a row, one on a narrow screen; anything beyond that is a carousel.
  const perView = options.length > 2 ? 2 : options.length;
  const isCarousel = options.length > 2;
  const maxWindow = Math.max(0, options.length - perView);
  const at = Math.min(Math.max(0, window_), maxWindow);
  const shown = isCarousel ? options.slice(at, at + perView) : options;

  const cheapest = useMemo(
    () => options.reduce<number | null>(
      (low, option) =>
        option.totalMinorUnits !== null && (low === null || option.totalMinorUnits < low)
          ? option.totalMinorUnits
          : low,
      null,
    ),
    [options],
  );

  const decided = data.status === 'accepted' || data.status === 'rejected';
  const canDecide = permittedToDecide && data.awaitingDecision && !decided;

  const transitOf = (option: CustomerQuoteOption) => {
    const range = [option.transitDaysMin, option.transitDaysMax].filter((value) => value !== null);
    if (range.length === 0) return null;
    return t('optTransitDays', { range: [...new Set(range)].join('–') });
  };

  /* Null when the branch withholds it, which is an answer rather than a gap. */
  const carrierOf = (option: CustomerQuoteOption) =>
    option.carrierName ?? t('optCarrierOnBooking');

  const status = decided
    ? data.status === 'accepted' ? 'accepted' : 'declined'
    : data.pipelineSegment === 'expired' ? 'expired' : 'quoted';

  const validUntil = data.validUntil ? formatDate(data.validUntil) : '—';

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.container}>
            <RouteBreadcrumb
              tone="dark"
              label={t('breadcrumb')}
              homeHref="/app/dashboard"
              homeLabel={t('customerNav_dashboard')}
              onHomeNavigate={() => navigate('/app/dashboard')}
              steps={[
                {
                  id: 'quotations',
                  label: t('customerNav_quotations'),
                  href: '/app/quotations/list',
                  onNavigate: () => navigate('/app/quotations/list'),
                },
                { id: 'quote', label: data.reference },
              ]}
            />

            <div className={styles.titleRow}>
              <div className={styles.titleText}>
                <div className={styles.titleLine}>
                  <h1 className={styles.reference}>{data.reference}</h1>
                  <span className={styles.status} data-state={status}>
                    {t(`optStatus_${status}`)}
                  </span>
                </div>
                <div className={styles.rule} aria-hidden="true" />
                <p className={styles.lede}>
                  {[
                    t('optRequestedOn', { date: formatDate(data.createdAt) }),
                    data.version > 1 ? t('optVersion', { number: data.version }) : null,
                    data.publishedAt ? t('optPricedOn', { date: formatDate(data.publishedAt) }) : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>

              {/* Both wait on a document renderer, which does not exist yet. They
                  are here because the page is laid out around them; pressing one
                  says so rather than doing nothing. */}
              <div className={styles.heroActions}>
                <button type="button" className={styles.ghost} onClick={() => setPending(true)}>
                  {t('optDownloadAll')}
                </button>
                <button type="button" className={styles.ghost} onClick={() => setPending(true)}>
                  {t('optCopyQuote')}
                </button>
              </div>
            </div>

            <div className={styles.panel}>
              <div>
                <p className={styles.eyebrow}>
                  {[
                    t('optRoute'),
                    t(`mode_${data.mode}`, { defaultValue: data.mode }),
                    data.loadType,
                    extra.direction ? t(`reqDirection_${extra.direction}`, { defaultValue: extra.direction }) : null,
                    data.incoterm,
                  ].filter(Boolean).join(' · ')}
                </p>

                <div className={styles.laneCard}>
                  <div className={styles.place}>
                    <div className={styles.code}>{data.originCode}</div>
                  </div>
                  <span className={styles.track} aria-hidden="true">
                    <span className={styles.trackLine} />
                    <span className={styles.trackMark}><Icon size={13} /></span>
                    <span className={styles.trackEnd} />
                  </span>
                  <div className={`${styles.place} ${styles.placeEnd}`}>
                    <div className={styles.code}>{data.destinationCode}</div>
                  </div>
                </div>

                <ul className={styles.chips}>
                  <li data-lead="true">{cargoCaption(data.cargo, t, i18n.language)}</li>
                  {(extra.additionalServices ?? []).map((service) => (
                    <li key={service}>{t(`reqService_${service}`, { defaultValue: service })}</li>
                  ))}
                </ul>
              </div>

              <dl className={styles.facts}>
                <div>
                  <dt>{t('optFactRequested')}</dt>
                  <dd>{formatDate(data.createdAt)}</dd>
                  <dd className={styles.sub}>{t('optVersion', { number: data.version })}</dd>
                </div>
                <div>
                  <dt>{t('optFactCargo')}</dt>
                  <dd>{cargoCaption(data.cargo, t, i18n.language)}</dd>
                  <dd className={styles.sub}>{t(`mode_${data.mode}`, { defaultValue: data.mode })}</dd>
                </div>
                <div>
                  <dt>{t('optFactValidity')}</dt>
                  <dd>{t('optUntil', { date: validUntil })}</dd>
                  <dd className={styles.sub}>{t('optAcceptBefore')}</dd>
                </div>
                <div>
                  <dt>{t('optFactReference')}</dt>
                  <dd>{data.customerReference ?? '—'}</dd>
                  {extra.costCentre && <dd className={styles.sub}>{extra.costCentre}</dd>}
                </div>
              </dl>

              <div className={styles.fromColumn}>
                <div className={styles.fromBox}>
                  <div className={styles.fromLabel}>{t('optFrom')}</div>
                  <div className={styles.fromTotal}>
                    {formatMoney(cheapest, data.currency)}
                  </div>
                  <div className={styles.fromNote}>
                    {t('optCountAndValidity', { count: options.length, date: validUntil })}
                  </div>
                </div>
                <button type="button" className={styles.solid} onClick={onViewRequest}>
                  {t('optViewRequest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.rise} data-carousel={isCarousel ? 'true' : undefined}>
        {pending && (
          <p className={styles.pending} role="status">{t('optDownloadPending')}</p>
        )}

        <div className={styles.options}>
          {isCarousel && (
            <div className={styles.carouselHead}>
              <span className={styles.carouselHeading}>
                {t('optCarouselHeading', {
                  count: options.length,
                  from: at + 1,
                  to: Math.min(options.length, at + perView),
                })}
              </span>
              <span className={styles.arrows}>
                <button
                  type="button" className={styles.arrow} aria-label={t('optPrevious')}
                  disabled={at === 0} onClick={() => setWindow(at - 1)}
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
                <button
                  type="button" className={styles.arrow} data-lead="true" aria-label={t('optNext')}
                  disabled={at >= maxWindow} onClick={() => setWindow(at + 1)}
                >
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </span>
            </div>
          )}

          <div
            className={styles.cards}
            style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, minmax(0, 1fr))` }}
          >
            {shown.map((option) => {
              const index = options.indexOf(option);
              const isSelected = index === selected;
              return (
                <div
                  key={option.id}
                  className={styles.card}
                  data-selected={isSelected ? 'true' : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(index);
                    }
                  }}
                >
                  <div className={styles.cardHead}>
                    <div>
                      <div className={styles.cardName}>
                        {option.name ?? t('optUnnamed', { number: index + 1 })}
                      </div>
                      <div className={styles.cardSub}>
                        {[carrierOf(option), transitOf(option)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {option.isRecommended && (
                      <span className={styles.recommended}>{t('optRecommended')}</span>
                    )}
                  </div>

                  <div className={styles.cardTotal}>
                    {formatMoney(option.totalMinorUnits, option.currency ?? data.currency)}
                  </div>
                  <div className={styles.cardBasis}>
                    {t('optTotalBasis', {
                      date: option.validUntil ? formatDate(option.validUntil) : validUntil,
                    })}
                  </div>

                  <ul className={styles.cardChips}>
                    {option.freeTimeDays !== null && (
                      <li>{t('optFreeDays', { days: option.freeTimeDays })}</li>
                    )}
                    {option.nextDepartures && <li>{option.nextDepartures}</li>}
                  </ul>

                  <ul className={styles.cardLines}>
                    {option.chargeLines.map((line) => (
                      <li key={line.id}>
                        <span>{line.description}</span>
                        <strong>
                          {formatMoney(line.amountMinorUnits, line.currency ?? data.currency)}
                        </strong>
                      </li>
                    ))}
                  </ul>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.accept}
                      data-selected={isSelected ? 'true' : undefined}
                      disabled={!canDecide || busy || option.isExpired}
                      onClick={(event) => { event.stopPropagation(); onAccept(option.id); }}
                    >
                      <Check size={13} aria-hidden="true" />
                      {t('optAccept')}
                    </button>
                    <button
                      type="button" className={styles.iconAction} aria-label={t('optReject')}
                      disabled={!canDecide || busy}
                      onClick={(event) => { event.stopPropagation(); setSelected(index); setRejecting(true); }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button" className={styles.iconAction} aria-label={t('optDownloadOne')}
                      onClick={(event) => { event.stopPropagation(); setPending(true); }}
                    >
                      <Download size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button" className={styles.detailsAction}
                      onClick={(event) => { event.stopPropagation(); setSelected(index); setDetail(index); }}
                    >
                      {t('optDetails')}
                      <ChevronRight size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {isCarousel && (
            <ul className={styles.dots}>
              {Array.from({ length: maxWindow + 1 }, (_, index) => (
                <li key={index}>
                  <button
                    type="button" className={styles.dot} data-on={index === at ? 'true' : undefined}
                    aria-label={t('optShowFrom', { number: index + 1 })}
                    onClick={() => setWindow(index)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {data.messageToCustomer && (
          <div className={styles.message}>
            <span className={styles.panelLabel}>{t('optMessage')}</span>
            <p>{data.messageToCustomer}</p>
          </div>
        )}

        {options.length > 1 && (
          <div className={styles.compare}>
            <button
              type="button" className={styles.compareHead}
              aria-expanded={comparing} onClick={() => setComparing((open) => !open)}
            >
              <span>
                <h2 className={styles.compareTitle}>{t('optCompare')}</h2>
                <span className={styles.compareNote}>{t('optCompareNote')}</span>
              </span>
              <ChevronDown
                size={16} className={styles.compareChevron}
                data-open={comparing ? 'true' : undefined} aria-hidden="true"
              />
            </button>

            {comparing && (
              <div className={styles.compareBody}>
                <div
                  className={styles.compareGrid}
                  style={{ gridTemplateColumns: `170px repeat(${options.length}, minmax(190px, 1fr))` }}
                >
                  <div className={styles.compareCorner} />
                  {options.map((option, index) => (
                    <div
                      key={option.id}
                      className={styles.compareOption}
                      data-selected={index === selected ? 'true' : undefined}
                    >
                      {option.name ?? t('optUnnamed', { number: index + 1 })}
                      {option.isRecommended && (
                        <span className={styles.compareRecommended}>{t('optRecommended')}</span>
                      )}
                    </div>
                  ))}

                  {([
                    ['total', (option: CustomerQuoteOption) =>
                      formatMoney(option.totalMinorUnits, option.currency ?? data.currency)],
                    ['transit', (option: CustomerQuoteOption) => transitOf(option)],
                    ['carrier', (option: CustomerQuoteOption) => carrierOf(option)],
                    ['routing', (option: CustomerQuoteOption) => option.serviceRouting],
                    ['departures', (option: CustomerQuoteOption) => option.nextDepartures],
                    ['freeTime', (option: CustomerQuoteOption) =>
                      option.freeTimeDays === null ? null : t('optFreeDays', { days: option.freeTimeDays })],
                    ['validUntil', (option: CustomerQuoteOption) =>
                      option.validUntil ? formatDate(option.validUntil) : null],
                    ['included', (option: CustomerQuoteOption) => option.termsIncluded],
                  ] as const).map(([key, read]) => (
                    <Row
                      key={key}
                      label={t(`optCompare_${key}`)}
                      lead={key === 'total'}
                      options={options}
                      selected={selected}
                      read={read}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {canDecide && current && (
          <div className={styles.decision}>
            <div>
              <div className={styles.decisionTitle}>
                {t('optSelected', {
                  name: current.name ?? t('optUnnamed', { number: selected + 1 }),
                  amount: formatMoney(current.totalMinorUnits, current.currency ?? data.currency),
                })}
              </div>
              <div className={styles.decisionNote}>{t('optAcceptNote')}</div>
            </div>
            <div className={styles.decisionActions}>
              <button
                type="button" className={styles.rejectButton} disabled={busy}
                onClick={() => setRejecting(true)}
              >
                {t('optRejectWithReason')}
              </button>
              <button
                type="button" className={styles.acceptButton} disabled={busy || current.isExpired}
                onClick={() => onAccept(current.id)}
              >
                {t('optAcceptQuote')}
              </button>
            </div>
          </div>
        )}

        {decided && (
          <div className={styles.decided} data-tone={data.status === 'accepted' ? 'accepted' : 'declined'}>
            <span className={styles.decidedDot} aria-hidden="true" />
            <div>
              <div className={styles.decisionTitle}>
                {t(data.status === 'accepted' ? 'optDecidedAccepted' : 'optDecidedDeclined')}
              </div>
              <div className={styles.decisionNote}>
                {data.status === 'accepted'
                  ? t('optDecidedAcceptedNote', {
                      date: data.decidedAt ? formatDate(data.decidedAt) : '—',
                    })
                  : data.declineReason ?? t('optDecidedDeclinedNote')}
              </div>
            </div>
          </div>
        )}

        {failure && <p className={styles.error} role="alert">{failure}</p>}

        <div className={styles.columns}>
          <div className={styles.cardPanel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{t('optYourRequest')}</h2>
              <button type="button" className={styles.panelLink} onClick={onViewRequest}>
                {t('optSeeEverything')}
              </button>
            </div>
            <dl className={styles.recap}>
              <Fact label={t('optRecapRoute')} value={`${data.originCode} → ${data.destinationCode}`} />
              <Fact
                label={t('optRecapService')}
                value={[
                  t(`mode_${data.mode}`, { defaultValue: data.mode }),
                  extra.direction ? t(`reqDirection_${extra.direction}`, { defaultValue: extra.direction }) : null,
                  data.incoterm,
                ].filter(Boolean).join(' · ')}
              />
              <Fact label={t('optRecapCargo')} value={cargoCaption(data.cargo, t, i18n.language)} />
              <Fact
                label={t('optRecapScope')}
                value={extra.scope ? t(`reqScope_${extra.scope}`, { defaultValue: extra.scope }) : null}
              />
              <Fact label={t('optRecapReference')} value={data.customerReference} />
              <Fact
                label={t('optRecapReady')}
                value={data.readyDate ? formatDate(data.readyDate) : null}
              />
            </dl>
          </div>

          <div className={styles.cardPanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelLabel}>{t('optActivity')}</span>
            </div>
            <ul className={styles.activity}>
              {[
                data.publishedAt && {
                  name: t('optActivityPriced'),
                  when: formatDate(data.publishedAt),
                },
                { name: t('optActivityReceived'), when: formatDate(data.createdAt) },
              ].filter((entry): entry is { name: string; when: string } => Boolean(entry))
                .map((entry) => (
                  <li key={entry.name}>
                    <span className={styles.activityDot} aria-hidden="true" />
                    <span>
                      <span className={styles.activityName}>{entry.name}</span>
                      <span className={styles.activityWhen}>{entry.when}</span>
                    </span>
                  </li>
                ))}
            </ul>

            <div className={styles.versions}>
              <div className={styles.panelLabel}>{t('optVersions')}</div>
              <div className={styles.versionRow}>
                <span>
                  <span className={styles.versionName}>
                    {t('optVersionCurrent', { reference: data.reference, number: data.version })}
                  </span>
                  <span className={styles.versionNote}>{t('optVersionCurrentNote')}</span>
                </span>
                <span className={styles.status} data-state={status}>
                  {t(`optStatus_${status}`)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {detail !== null && options[detail] && (
        <OptionDetail
          option={options[detail]}
          index={detail}
          count={options.length}
          reference={data.reference}
          currency={data.currency}
          carrier={carrierOf(options[detail])}
          transit={transitOf(options[detail])}
          canDecide={canDecide}
          busy={busy}
          onClose={() => setDetail(null)}
          onAccept={() => { setDetail(null); onAccept(options[detail]!.id); }}
          onReject={() => { setDetail(null); setRejecting(true); }}
          onDownload={() => setPending(true)}
        />
      )}

      {showingRequest && (
        <CustomerRequestDrawer data={data} onClose={() => setShowingRequest(false)} />
      )}

      {rejecting && (
        <RejectDialog
          busy={busy}
          onCancel={() => setRejecting(false)}
          onConfirm={(reason) => { setRejecting(false); onDecline(reason); }}
        />
      )}
    </section>
  );
}

/** One row of the comparison, with every option's answer beside it. */
function Row({
  label, options, selected, read, lead,
}: {
  label: string;
  options: CustomerQuoteOption[];
  selected: number;
  read: (option: CustomerQuoteOption) => string | null;
  lead: boolean;
}) {
  return (
    <>
      <div className={styles.compareLabel}>{label}</div>
      {options.map((option, index) => (
        <div
          key={option.id}
          className={styles.compareCell}
          data-selected={index === selected ? 'true' : undefined}
          data-lead={lead ? 'true' : undefined}
        >
          {read(option) ?? '—'}
        </div>
      ))}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
    </div>
  );
}
