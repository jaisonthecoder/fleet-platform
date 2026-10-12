import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plane, Ship, Truck } from 'lucide-react';

import {
  Button, Dialog, DialogContent, DialogTitle, DrawerBody, DrawerCard, DrawerFooter, DrawerHeader,
  formatDate, formatTime,
} from '../../../design-system';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { cargoCaption } from '../../../shared/quotations/listing';
import { CustomerRequestDrawer } from '../components/CustomerRequestDrawer';
import type { CustomerQuote } from '../api/quotes';
import styles from './QuoteProgressPage.module.css';

const MODE_ICON: Record<string, typeof Ship> = { sea: Ship, air: Plane, road: Truck, rail: Truck };

/**
 * The customer's journey. NOT the staff stepper.
 *
 * Step four is CargoWise confirming, not our internal approval - whether two
 * Noatum people checked a price is not the customer's business.
 */
const STAGES = ['requested', 'claimed', 'priced', 'confirmed', 'ready'] as const;

/** The long tail of the request, as the customer submitted it. */
interface RequestExtras {
  direction?: string;
  scope?: string;
  namedPlace?: string | null;
  deliveryAddress?: string | null;
  dateFlexibility?: string | null;
  additionalServices?: string[];
  costCentre?: string | null;
  commodity?: string | null;
}

interface Props {
  data: CustomerQuote;
  /** The permission, not the status: the page decides whether the moment is right. */
  canWithdraw: boolean;
  busy: boolean;
  failure: string | null;
  onWithdraw: () => Promise<unknown>;
}

/**
 * The quotation while we are still working on it.
 *
 * To REFERENCE/MOCKUP-htmls-page-vice/Noatum Quotation Progress.html. The other
 * half of the split: until the offer exists the customer is watching rather than
 * choosing, so this page answers "where is it" and "what did I ask for" and
 * nothing else. There is one decision on it - withdraw - and it is deliberately
 * the quiet button.
 *
 * Three things the mockup shows are not here, because nothing behind them
 * exists: the carrier-response table, the "options expected by 16:00" promise,
 * and the note box to the desk. Rate sourcing is not modelled at all (CLAUDE.md
 * v4 rule 1), there is no service-level promise to quote, and there is no
 * message channel. A timeline that invented any of the three would be read as
 * fact by somebody planning a shipment around it.
 */
export function QuoteProgressPage({ data, canWithdraw, busy, failure, onWithdraw }: Props) {
  const { t, i18n } = useTranslation();

  const [showingRequest, setShowingRequest] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const extra = (data.payload ?? {}) as RequestExtras;
  const Icon = MODE_ICON[data.mode] ?? Ship;

  const withdrawn = data.statusBadge === 'withdrawn';

  /*
   * `stageIndex` counts the steps that have HAPPENED, so the live step is the
   * last one of them - not the one after. A request nobody has picked up yet is
   * at "Requested", and saying "Claimed - now" over an unclaimed request is the
   * one thing a status page must never do.
   */
  const step = Math.min(STAGES.length - 1, Math.max(0, data.stageIndex - 1));
  const routeStep = Math.min(STAGES.length, Math.max(0, data.stageIndex));

  const mode = t(`mode_${data.mode}`, { defaultValue: data.mode });
  const submittedOn = formatDate(data.createdAt) ?? '';
  const submittedAt = formatTime(data.createdAt);
  const ready = formatDate(data.readyDate);
  const cargo = cargoCaption(data.cargo, t, i18n.language);

  const flexibility = extra.dateFlexibility
    ? t(`reqFlexibility_${extra.dateFlexibility}`, { defaultValue: extra.dateFlexibility })
    : null;

  const services = (extra.additionalServices ?? [])
    .map((service) => t(`reqService_${service}`, { defaultValue: service }))
    .join(', ');

  const statusLabel = withdrawn
    ? t('quoteBadge_withdrawn')
    : t(`custStage_${STAGES[step]}`);

  const dash = (value: string | null | undefined) =>
    value === null || value === undefined || value === '' ? '—' : value;

  const join = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' · ') || null;

  /*
   * Only the two timestamps the record actually carries. The mockup gives every
   * step a time to the minute; we have the submission and, once it happens, the
   * publication - so the steps between say what state they are in instead of
   * inventing a clock.
   */
  const timeFor = (index: number) => {
    if (index === 0) return join(submittedOn, submittedAt);
    if (index === STAGES.length - 1 && data.publishedAt) {
      return join(formatDate(data.publishedAt), formatTime(data.publishedAt));
    }
    if (index < step) return t('progStageDone');
    if (index === step) return withdrawn ? t('progStageStopped') : t('progStageLive');
    return t('progStageExpected');
  };

  const activity = [
    withdrawn && data.decidedAt
      ? { key: 'withdrawn', label: t('progActWithdrawn'), when: data.decidedAt, lead: true }
      : null,
    data.version > 1
      ? { key: 'revised', label: t('progActRevised', { number: data.version }), when: null, lead: false }
      : null,
    { key: 'submitted', label: t('progActSubmitted'), when: data.createdAt, lead: !withdrawn },
  ].filter((entry): entry is { key: string; label: string; when: string | null; lead: boolean } =>
    Boolean(entry),
  );

  const tips = ['1', '2', '3'] as const;

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.container}>
            <Breadcrumb
              tone="hero"
              items={[
                { label: t('customerNav_dashboard'), to: '/app/dashboard' },
                { label: t('customerNav_quotations'), to: '/app/quotations/list' },
                { label: data.reference },
              ]}
            />

            <div className={styles.titleRow}>
              <div className={styles.titleText}>
                <div className={styles.eyebrow}>
                  {[
                    mode,
                    extra.direction
                      ? t(`reqDirection_${extra.direction}`, { defaultValue: extra.direction })
                      : null,
                    data.incoterm ? [data.incoterm, extra.namedPlace].filter(Boolean).join(' ') : null,
                    extra.scope ? t(`reqScope_${extra.scope}`, { defaultValue: extra.scope }) : null,
                  ].filter(Boolean).join(' · ')}
                </div>

                <h1 className={styles.reference}>{data.reference}</h1>

                <div className={styles.statusRow}>
                  <span className={styles.statusPill} data-stopped={withdrawn || undefined}>
                    <span className={styles.statusDot} aria-hidden="true">
                      {!withdrawn && <span className={styles.statusHalo} />}
                    </span>
                    {statusLabel}
                  </span>
                  <span className={styles.statusLine}>
                    {withdrawn ? t('progStatusWithdrawn') : t('progStatusWaiting')}
                  </span>
                </div>
              </div>

              <div className={styles.heroActions}>
                {canWithdraw && !withdrawn && (
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => setWithdrawing(true)}
                    disabled={busy}
                  >
                    {t('progWithdraw')}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.solid}
                  onClick={() => setShowingRequest(true)}
                >
                  {t('progViewRequest')}
                </button>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.laneColumn}>
                <div className={styles.laneCard}>
                  <div className={styles.place}>
                    <div className={styles.code}>{data.originCode}</div>
                  </div>
                  <span className={styles.track} data-step={routeStep} aria-hidden="true">
                    <span className={styles.trackFill} />
                  </span>
                  <div className={`${styles.place} ${styles.placeEnd}`}>
                    <div className={styles.code}>{data.destinationCode}</div>
                  </div>
                </div>

                <ul className={styles.chips}>
                  <li data-lead="true">{cargo}</li>
                  {/* The caption already carries the commodity, so the second
                      chip is the weight rather than the same words again. */}
                  {data.grossWeightKg !== null && (
                    <li>{t('optKg', { kg: data.grossWeightKg.toLocaleString() })}</li>
                  )}
                  {ready && <li>{t('progReadyChip', { date: ready })}</li>}
                </ul>
              </div>

              <dl className={styles.facts}>
                <div>
                  <dt>{t('progFactSubmitted')}</dt>
                  <dd>{dash(join(submittedOn, submittedAt))}</dd>
                  <dd className={styles.sub}>{elapsedSince(data.createdAt, t)}</dd>
                </div>
                <div>
                  <dt>{t('progFactReady')}</dt>
                  <dd>{dash(ready)}</dd>
                  <dd className={styles.sub}>{flexibility ?? t('progNoFlexibility')}</dd>
                </div>
                <div>
                  <dt>{t('progFactStep')}</dt>
                  <dd>{statusLabel}</dd>
                  <dd className={styles.sub}>
                    {t('progStepOf', { number: step + 1, total: STAGES.length })}
                  </dd>
                </div>
                <div>
                  <dt>{t('progFactReference')}</dt>
                  <dd>{dash(data.customerReference)}</dd>
                  {extra.costCentre && <dd className={styles.sub}>{extra.costCentre}</dd>}
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.rise}>
        <div className={styles.main}>
          <div className={styles.card} data-raised="true">
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>{t('progTitle')}</h2>
                <p className={styles.cardSub}>{t('progSubtitle')}</p>
              </div>
              <span className={styles.stepPill}>
                {t('progStepOf', { number: step + 1, total: STAGES.length })}
              </span>
            </div>

            <ol className={styles.timeline} aria-label={t('quoteProgressLabel')}>
              {STAGES.map((stage, index) => {
                const done = index < step || (index === step && withdrawn);
                const live = index === step && !withdrawn;
                return (
                  <li
                    key={stage}
                    className={styles.stage}
                    data-done={done || undefined}
                    data-live={live || undefined}
                  >
                    <div className={styles.rail}>
                      <span className={styles.dot}>
                        {done && <Check size={12} aria-hidden="true" />}
                        {live && (
                          <>
                            <span className={styles.dotCore} aria-hidden="true" />
                            <span className={styles.dotHalo} aria-hidden="true" />
                          </>
                        )}
                      </span>
                      {index < STAGES.length - 1 && <span className={styles.line} aria-hidden="true" />}
                    </div>

                    <div className={styles.stageBody}>
                      <div className={styles.stageHead}>
                        <span className={styles.stageLabel}>{t(`custStage_${stage}`)}</span>
                        <span className={styles.stageTime}>{timeFor(index)}</span>
                      </div>
                      <p className={styles.stageNote}>{t(`progStageNote_${stage}`)}</p>

                      {/* Where the mockup puts its carrier table and its promised
                          hour. Both are rate sourcing, which this platform does
                          not model, so the step says what is true instead. */}
                      {index === 2 && !withdrawn && (
                        <div className={styles.await}>
                          <span>{t('progAwaitNote')}</span>
                          <span className={styles.awaitMark}>{t('progAwaitMark')}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>{t('progRecapLabel')}</span>
              <button
                type="button"
                className={styles.cardLink}
                onClick={() => setShowingRequest(true)}
              >
                {t('progViewRequest')}
              </button>
            </div>

            <dl className={styles.recap}>
              <Recap
                label={t('progRecapService')}
                value={join(mode, data.loadType, extra.scope
                  ? t(`reqScope_${extra.scope}`, { defaultValue: extra.scope })
                  : null)}
                strong
              />
              <Recap
                label={t('progRecapIncoterm')}
                value={data.incoterm ? [data.incoterm, extra.namedPlace].filter(Boolean).join(' ') : null}
                strong
              />
              <Recap
                label={t('progRecapRoute')}
                value={join(`${data.originCode} → ${data.destinationCode}`, extra.deliveryAddress)}
              />
              <Recap label={t('progRecapCargo')} value={cargo} />
              <Recap
                label={t('progRecapChargeable')}
                value={data.chargeableKg === null ? null : t('optKg', { kg: data.chargeableKg.toLocaleString() })}
                strong
              />
              <Recap label={t('progRecapReady')} value={join(ready, flexibility)} />
              <Recap label={t('progRecapExtras')} value={services || t('progNone')} />
              <Recap
                label={t('progRecapReference')}
                value={join(data.customerReference, extra.costCentre)}
              />
            </dl>
          </div>

          {failure && <p className={styles.error} role="alert">{failure}</p>}
        </div>

        <aside className={styles.side}>
          <div className={styles.card} data-raised="true" data-capped="true">
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>{t('progDeskLabel')}</span>
            </div>
            <div className={styles.deskBody}>
              <div className={styles.desk}>
                <span className={styles.deskMark} aria-hidden="true"><Icon size={15} /></span>
                <span className={styles.deskText}>
                  <span className={styles.deskName}>{t('progDeskName', { mode })}</span>
                  {/* Which branch, and who in it, is ours rather than theirs. */}
                  <span className={styles.deskRole}>{t('progDeskRole')}</span>
                </span>
                <span className={styles.deskState} data-stopped={withdrawn || undefined}>
                  {withdrawn
                    ? t('progDeskStopped')
                    : step >= 1 ? t('progDeskWorking') : t('progDeskQueued')}
                </span>
              </div>
              <p className={styles.deskNote}>
                {withdrawn ? t('progDeskNoteStopped') : t('progDeskNote')}
              </p>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>{t('progActivity')}</span>
              <span className={styles.cardCount}>
                {t('progActivityCount', { count: activity.length })}
              </span>
            </div>
            <ul className={styles.activity}>
              {activity.map((entry) => (
                <li key={entry.key} data-lead={entry.lead || undefined}>
                  <span className={styles.activityDot} aria-hidden="true" />
                  <span className={styles.activityText}>
                    <span className={styles.activityLabel}>{entry.label}</span>
                    <span className={styles.activityWhen}>
                      {entry.when ? dash(join(formatDate(entry.when), formatTime(entry.when))) : '—'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>{t('progTipsLabel')}</span>
            </div>
            <ul className={styles.tips}>
              {tips.map((tip) => (
                <li key={tip}>
                  <span className={styles.tipNumber}>{`0${tip}`}</span>
                  <span className={styles.tipText}>{t(`progTip_${tip}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {showingRequest && (
        <CustomerRequestDrawer data={data} onClose={() => setShowingRequest(false)} />
      )}

      {withdrawing && (
        <Dialog open onOpenChange={(open) => { if (!open) setWithdrawing(false); }}>
          <DialogContent side="right" closeLabel={t('close')}>
            <DrawerHeader>
              <DialogTitle>{t('quoteCancelTitle', { reference: data.reference })}</DialogTitle>
            </DrawerHeader>
            <DrawerBody>
              <DrawerCard>
                <p className={styles.dialogNote}>{t('quoteCancelNote')}</p>
              </DrawerCard>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="outline" onClick={() => setWithdrawing(false)}>
                {t('quoteCancelKeep')}
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  await onWithdraw();
                  setWithdrawing(false);
                }}
              >
                {t('progWithdraw')}
              </Button>
            </DrawerFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

/** One row of the recap. Strong rows are the ones a price turns on. */
function Recap({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className={styles.recapRow}>
      <dt>{label}</dt>
      <dd data-strong={strong || undefined}>{value ?? '—'}</dd>
    </div>
  );
}

/**
 * How long the customer has been waiting, in the largest unit that still says
 * something. "2 days ago" is the answer to "is this normal"; "3120 minutes" is
 * arithmetic.
 */
function elapsedSince(iso: string, t: (key: string, options?: Record<string, unknown>) => string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return t('progAgoMinutes', { value: Math.max(minutes, 1) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('progAgoHours', { value: hours });
  return t('progAgoDays', { value: Math.floor(hours / 24) });
}
