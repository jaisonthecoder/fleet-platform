import { useTranslation } from 'react-i18next';
import { formatDate, RouteBreadcrumb } from '../../../design-system';
import type { PricingQuote } from '../api/pricing';
import styles from './RequestHero.module.css';

/** How long a request has waited, in the words a queue uses. */
function waitingFor(since: string): { hours: number; minutes: number } {
  const elapsed = Math.max(0, Date.now() - new Date(since).getTime());
  return { hours: Math.floor(elapsed / 3_600_000), minutes: Math.floor(elapsed / 60_000) % 60 };
}

interface Props {
  data: PricingQuote;
  /** mode · load type · direction · incoterm · scope, from the request. */
  service: string;
  /** Anything the pricer has to resolve before quoting, already in words. */
  flags: string[];
  onHome: () => void;
  onQueue: () => void;
  onClaim: () => void;
  onRelease: () => void;
  onViewRequest: () => void;
  busy: boolean;
}

/**
 * The request hero.
 *
 * Full bleed, and the first thing on the screen: the reference, what the screen
 * is for, and the six facts that decide most of a quote — the lane, the cargo,
 * who is asking, how long it has waited, what it is charged on and in which
 * currency. Nothing inside is editable; the two acts are claiming the job and
 * reading the request in full.
 */
export function RequestHero({
  data, service, flags, onHome, onQueue, onClaim, onRelease, onViewRequest, busy,
}: Props) {
  const { t } = useTranslation('staff');
  const held = data.claimedByMe;
  const heldByOther = data.claimedById !== null && !held;
  /* Claiming is only possible while the request is still being worked. Once it is
     published the API refuses, so offering the button produced a 409 and taught
     the pricer nothing. */
  const claimable = data.status === 'requested' || data.status === 'claimed';
  const wait = waitingFor(data.createdAt);

  const cargo = [
    data.grossWeightKg ? t('heroKg', { kg: data.grossWeightKg.toLocaleString() }) : null,
    data.volumeM3 ? t('heroM3', { m3: data.volumeM3.toLocaleString() }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className={styles.hero} aria-label={t('theRequest')}>
      <div className={styles.inner}>
        <div className={styles.container}>
          {/* CH-04, the same trail the customer's own request form wears on its
              hero: drawn as a route, in the dark tone, so it sits ON the band
              rather than as a white card laid over it. */}
          <RouteBreadcrumb
            tone="dark"
            label={t('breadcrumb')}
            homeHref="/portal/staff"
            homeLabel={t('moduleAdministration')}
            onHomeNavigate={onHome}
            steps={[
              {
                id: 'queue',
                label: t('nav_pricing'),
                href: '/portal/pricing',
                onNavigate: onQueue,
              },
              { id: 'quote', label: `${data.reference} · ${data.customerName ?? t('queueSomeone')}` },
            ]}
          />

          <div className={styles.titleRow}>
            <div className={styles.titleText}>
              <p className={styles.eyebrow}>{service}</p>
              <h1 className={styles.title}>{data.reference}</h1>
              <p className={styles.lede}>
                {t('heroLede', { customer: data.customerName ?? t('queueSomeone') })}
              </p>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={onViewRequest}>
                {t('heroViewRequest')}
              </button>
              {/*
                One button either way. The API decides: it refuses a claim on a
                request somebody else holds, and refuses a release of theirs.
              */}
              <button
                type="button"
                className={styles.claim}
                data-held={held ? 'true' : undefined}
                disabled={busy || heldByOther || (!held && !claimable)}
                onClick={held ? onRelease : onClaim}
              >
                {held
                  ? t('heroRelease')
                  : heldByOther
                    ? t('heroHeldElsewhere')
                    : claimable
                      ? t('claimRequest')
                      : t('heroClaimClosed')}
              </button>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelGrid}>
              <div>
                <div className={styles.laneCard}>
                  <div className={styles.place}>
                    <div className={styles.code}>{data.originCode}</div>
                    {data.originName && <div className={styles.city}>{data.originName}</div>}
                  </div>
                  <span className={styles.rule} aria-hidden="true" />
                  <div className={`${styles.place} ${styles.placeEnd}`}>
                    <div className={styles.code}>{data.destinationCode}</div>
                    {data.destinationName && <div className={styles.city}>{data.destinationName}</div>}
                  </div>
                </div>

                <ul className={styles.chips}>
                  {data.equipment.length > 0 && (
                    <li data-lead="true">
                      {data.equipment.map((unit) => `${unit.quantity} × ${unit.containerType}`).join(', ')}
                    </li>
                  )}
                  {cargo && <li>{cargo}</li>}
                  {data.readyDate && <li>{t('heroReady', { date: formatDate(data.readyDate) })}</li>}
                  {/* Amber, and the words carry the meaning: colour is never the
                      only signal on this platform. */}
                  {flags.map((flag) => <li key={flag} data-flag="true">{flag}</li>)}
                </ul>
              </div>

              <dl className={styles.meta}>
                <div>
                  <dt>{t('queueCustomer')}</dt>
                  <dd>{data.customerName ?? '—'}</dd>
                  {data.customerReference && (
                    <dd className={styles.sub}>
                      {t('heroTheirRef', { reference: data.customerReference })}
                    </dd>
                  )}
                </div>
                <div>
                  <dt>{t('heroReceived')}</dt>
                  <dd>{formatDate(data.createdAt)}</dd>
                  <dd className={`${styles.sub} ${held ? styles.held : styles.waiting}`}>
                    {held
                      ? t('heroHeldByYou')
                      : heldByOther
                        ? t('heroHeldBy', { name: data.claimedByName ?? t('queueSomeone') })
                        : t('heroWaiting', { hours: wait.hours, minutes: wait.minutes })}
                  </dd>
                </div>
                <div>
                  <dt>{t('heroCharged')}</dt>
                  <dd>
                    {data.chargeableKg
                      ? t('heroKg', { kg: data.chargeableKg.toLocaleString() })
                      : t('heroChargeableUnknown')}
                  </dd>
                  <dd className={styles.sub}>{t('heroChargedOn')}</dd>
                </div>
                <div>
                  <dt>{t('heroQuoteIn')}</dt>
                  <dd>{data.currency}</dd>
                  {data.serviceLevel && <dd className={styles.sub}>{data.serviceLevel}</dd>}
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
