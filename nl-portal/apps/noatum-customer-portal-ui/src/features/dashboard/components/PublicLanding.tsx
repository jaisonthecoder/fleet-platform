import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { publicApiIsStandIn } from '../../../api/public/client';
import { ReferenceKindSchema, type PublicStatDto, type ReferenceKind } from '../../../api/public/contracts';
import { formatDate } from '../../../design-system';
import { timeAgo } from '../../../lib/relative-time';
import { useNow } from '../../../lib/use-now';
import { Co2Calculator } from '../../../shared/components/Co2Calculator';
import { useAccessRequest, usePublicLanding, usePublicTracking, type TrackingLookup } from '../api/public-landing';
import styles from './PublicLanding.module.css';
import { FEATURES, ICON, STAT_RAIL } from './publicLandingData';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const RECENT_KEY = 'noatum.public.recent';
const RECENT_LIMIT = 5;

/** Keeps the counters' layout while the call is in flight. */
const PENDING_STATS: PublicStatDto[] = [
  { id: 'tracked', value: '—' },
  { id: 'feeds', value: '—' },
  { id: 'lag', value: '—' },
];

/*
 * Recent searches live in this browser only.
 *
 * A reference somebody looked up is a hint about their business, so it never
 * leaves the device: no account, no server, no cookie sent anywhere. Every
 * access is guarded because storage throws in a private window and comes back
 * empty when site data is cleared — neither is an error worth showing.
 */
function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(values: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(values));
  } catch {
    // A visitor who blocks storage still gets the list for this visit.
  }
}

/**
 * The public landing page, built to "Noatum Landing Public.dc.html".
 *
 * Geometry, type and the 1080 / 760 breakpoints follow that design exactly.
 *
 * Every figure on it comes from an endpoint under `/api/public/*` — the
 * counters, the reference kinds, the tracking result and the emissions
 * estimate. While the API has none of those routes an in-browser stand-in
 * answers them, with real status codes and real latency, so the loading, empty,
 * not-found and failure states on this page are the same code that will run
 * against the real thing. Going live is VITE_PUBLIC_API_MOCK=false.
 *
 * Nothing here reads customer data, which is what lets it be public at all.
 */
export function PublicLanding() {
  const { t, i18n } = useTranslation();
  const landing = usePublicLanding();
  // "38 min ago" has to keep being true. Without a clock it is only true at the
  // moment something else happened to re-render the page.
  const now = useNow();

  /*
   * A lookup is a place, not a piece of component state.
   *
   * It lives in ?ref= and ?kind= so a result can be refreshed, bookmarked,
   * shared with a colleague and reached with the back button — none of which
   * worked while it was held in useState. It is also the only way the page can
   * be linked to from an email or a support ticket, which for public tracking
   * is most of the point.
   *
   * The kind is parsed, not trusted: it arrives from the address bar.
   */
  const [params, setParams] = useSearchParams();
  const urlRef = (params.get('ref') ?? '').trim();
  const urlKind = ReferenceKindSchema.safeParse(params.get('kind'));

  const [kind, setKind] = useState<ReferenceKind>(urlKind.success ? urlKind.data : 'container');
  const [query, setQuery] = useState(urlRef);
  // False until the visitor searches or clears. Before that the page opens on
  // the featured reference, as the design does, rather than on a bare form.
  const [touched, setTouched] = useState(urlRef.length > 0);
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  /*
   * Follow the address bar when it moves on its own — back, forward, or a
   * pasted link. Adjusting state during render rather than in an effect: React
   * re-runs this component before anything is painted, so the field never
   * flashes the previous reference.
   */
  const [shownRef, setShownRef] = useState(urlRef);
  if (urlRef !== shownRef) {
    setShownRef(urlRef);
    setQuery(urlRef);
    if (urlRef) setTouched(true);
    if (urlKind.success) setKind(urlKind.data);
  }
  const accessSection = useRef<HTMLElement>(null);

  const [form, setForm] = useState({ company: '', email: '', country: 'Spain', reference: '' });
  const accessRequest = useAccessRequest();

  const kinds = landing.data?.kinds ?? [];
  const samples = landing.data?.samples ?? [];
  const stats = landing.data?.stats ?? PENDING_STATS;
  const activeKind = kinds.find((entry) => entry.id === kind);

  const featured = samples[0];
  const active: TrackingLookup | null = urlRef
    ? { reference: urlRef, kind: urlKind.success ? urlKind.data : kind }
    : touched
      ? null
      : featured
        ? { reference: featured, kind: 'container' }
        : null;

  const tracking = usePublicTracking(active, { onResolved: (reference) => remember(reference) });
  const result = tracking.data ?? null;

  const emailValid = EMAIL.test(form.email.trim());
  const canSubmit = form.company.trim().length > 1 && emailValid && !accessRequest.isPending;

  /** Most recent first, no duplicates, capped. */
  const remember = (reference: string) => {
    const trimmed = reference.trim();
    if (!trimmed) return;
    setRecent((current) => {
      const next = [trimmed, ...current.filter((entry) => entry !== trimmed)].slice(0, RECENT_LIMIT);
      writeRecent(next);
      return next;
    });
  };

  /** Pushes, so each search is a step the back button can return to. */
  const lookUp = (reference: string, as: ReferenceKind = kind) => {
    const trimmed = reference.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setKind(as);
    setTouched(true);
    setShownRef(trimmed);
    setParams({ ref: trimmed, kind: as });
  };

  const track = (event: FormEvent) => {
    event.preventDefault();
    lookUp(query);
  };

  /**
   * Back to the page with nothing searched. Recent searches are kept.
   *
   * Replaces rather than pushes: the history is the list of things you looked
   * up, and clearing is undoing the last one, not a place of its own.
   */
  const clearSearch = () => {
    setQuery('');
    setTouched(true);
    setShownRef('');
    setParams({}, { replace: true });
    document.getElementById('public-reference')?.focus();
  };

  const forget = (reference: string) =>
    setRecent((current) => {
      const next = current.filter((entry) => entry !== reference);
      writeRecent(next);
      return next;
    });

  const forgetAll = () => {
    setRecent([]);
    writeRecent([]);
  };

  /*
   * There are no rates to search.
   *
   * v4 rule 1: no rate management exists and every quote is priced by a person.
   * The design's rates panel therefore cannot do what its label says, so it
   * does the honest equivalent — takes you to the form that reaches a pricer.
   * The copy itself is a Product decision and is raised in docs/gaps.md.
   */
  const goToAccessRequest = () => {
    accessSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    accessSection.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  };

  const change = (key: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    accessRequest.reset();
  };

  const submitRequest = () => {
    accessRequest.mutate({
      company: form.company.trim(),
      email: form.email.trim(),
      country: form.country.trim(),
      reference: form.reference.trim() || undefined,
    });
  };

  const delayed = result?.status === 'delayed';
  const done = result ? result.milestones.filter((step) => step.at !== null).length : 0;
  const resultTone = delayed
    ? { '--resultFg': 'var(--color-primary)', '--resultBg': 'var(--red-050)' }
    : { '--resultFg': 'var(--color-accent-navy)', '--resultBg': 'var(--noa-navy-050)' };

  /* The first block in the body column lifts into the hero's padding. That is
     whichever of the result, its loading state or its empty state is showing;
     with nothing searched, the benefits band takes the lift instead. */
  const leads = active !== null;

  /* Hoisted so the not-found block's callbacks read it without assertions. */
  const miss = tracking.miss;

  return (
    <div className={styles.page}>
      {/* ═══ hero ═══ */}
      <section className={styles.hero} aria-labelledby="public-heading">
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <div style={{ minWidth: 0 }}>
              <p className={styles.eyebrow}>
                <span className={styles.pulse} aria-hidden="true" />
                {t('publicEyebrow')}
              </p>
              <h1 id="public-heading" className={styles.heading}>{t('publicHeading')}</h1>
              <p className={styles.lede}>{t('publicLede')} {t('publicLedeSecond')}</p>
            </div>

            <dl className={styles.stats} aria-busy={landing.isPending || undefined}>
              {stats.map((stat) => (
                <div
                  className={styles.stat}
                  key={stat.id}
                  style={{ '--statRail': STAT_RAIL[stat.id] } as CSSProperties}
                >
                  <dt className={styles.statLabel}>{t(`publicStat_${stat.id}`)}</dt>
                  <dd className={styles.statValue}>{stat.value}</dd>
                  <dd className={styles.statSub}>{t(`publicStatSub_${stat.id}`)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ═══ track and trace ═══ */}
          <form className={styles.panel} onSubmit={track}>
            <div className={styles.panelHead}>
              <p className={styles.panelTitle}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d={ICON.search} />
                </svg>
                {t('publicTrackTitle')}
              </p>
              <div className={styles.kinds} role="group" aria-label={t('publicReferenceKind')}>
                {kinds.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={styles.kind}
                    aria-pressed={kind === entry.id}
                    onClick={() => setKind(entry.id)}
                  >
                    {t(`publicKind_${entry.id}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <span className={styles.fieldLabel} aria-hidden="true">{t(`publicKindShort_${kind}`)}</span>
                <input
                  id="public-reference"
                  /* Not type="search": the browser's own × clears the field but
                     leaves the result card standing, which is the exact
                     mismatch the Clear button exists to avoid. */
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  value={query}
                  placeholder={activeKind?.placeholder ?? ''}
                  aria-label={t('publicReferenceLabel', { kind: t(`publicKind_${kind}`) })}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <button type="submit" className={styles.track} disabled={query.trim().length === 0}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d={ICON.arrow} />
                </svg>
                {t('publicTrack')}
              </button>

              {/* Only offered when there is something to clear, so the row does
                  not carry a dead control on first paint. */}
              {(query.length > 0 || active) && (
                <button type="button" className={styles.clear} onClick={clearSearch}>
                  {t('publicClear')}
                </button>
              )}

              {samples.length > 0 && (
                <div className={styles.samples}>
                  <span className={styles.samplesLabel}>{t('publicTry')}</span>
                  {samples.map((reference) => (
                    <button
                      key={reference}
                      type="button"
                      className={styles.sample}
                      onClick={() => lookUp(reference)}
                    >
                      {reference}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {recent.length > 0 && (
              <div className={styles.recent}>
                <span className={styles.samplesLabel}>{t('publicRecent')}</span>
                {recent.map((reference) => (
                  <span className={styles.recentChip} key={reference}>
                    <button type="button" className={styles.recentGo} onClick={() => lookUp(reference)}>
                      {reference}
                    </button>
                    <button
                      type="button"
                      className={styles.recentDrop}
                      aria-label={t('publicRecentRemove', { reference })}
                      onClick={() => forget(reference)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button type="button" className={styles.recentClear} onClick={forgetAll}>
                  {t('publicRecentClear')}
                </button>
              </div>
            )}

            <p className={styles.panelNote}>{t('publicTrackNote')}</p>
          </form>
        </div>
      </section>

      <div className={styles.body}>
        {/* ═══ the lookup, in whichever state it is in ═══ */}
        {active && tracking.isPending && (
          <div className={`${styles.stateCard} ${styles.lift}`} role="status">
            <p className={styles.stateTitle}>{t('publicLooking', { reference: active.reference })}</p>
            <p>{t('publicLookingNote')}</p>
          </div>
        )}

        {miss && (
          <div className={`${styles.stateCard} ${styles.lift}`} data-tone="warn" role="status">
            <p className={styles.stateTitle}>{t('publicMissTitle', { reference: miss.reference })}</p>
            <p>{miss.suggestedKind ? t('publicMissWrongKind') : t('publicMissNote')}</p>

            {miss.suggestedKind && (
              <div className={styles.stateChips}>
                <button
                  type="button"
                  className={styles.stateChip}
                  onClick={() => {
                    setKind(miss.suggestedKind!);
                    lookUp(miss.reference, miss.suggestedKind!);
                  }}
                >
                  {t('publicMissSearchAs', { kind: t(`publicKind_${miss.suggestedKind}`) })}
                </button>
              </div>
            )}
            {miss.samples.length > 0 && (
              <div className={styles.stateChips}>
                <span className={styles.stateChipsLabel}>{t('publicTry')}</span>
                {miss.samples.map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    className={styles.stateChip}
                    onClick={() => lookUp(reference)}
                  >
                    {reference}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tracking.failed && (
          <div className={`${styles.stateCard} ${styles.lift}`} data-tone="error" role="alert">
            <p className={styles.stateTitle}>{t('publicTrackFailed')}</p>
            <p>{t('publicTrackFailedNote')}</p>
            <div className={styles.stateChips}>
              <button type="button" className={styles.stateChip} onClick={() => void tracking.refetch()}>
                {t('retry')}
              </button>
            </div>
          </div>
        )}

        {/* ═══ public result ═══ */}
        {result && (
          <div
            className={`${styles.result} ${styles.lift}`}
            style={resultTone as CSSProperties}
            aria-busy={tracking.isFetching || undefined}
          >
            <span className={styles.resultEdge} aria-hidden="true" />
            <div className={styles.resultMain}>
              <div className={styles.resultHead}>
                <p className={styles.resultStatus}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d={ICON.tick} />
                  </svg>
                  {t('publicResult')} · {t(`publicStatus_${result.status}`)}
                </p>
                <span className={styles.resultMeta}>
                  <span className={styles.resultUpdated}>
                    {t('publicLastMessage', { ago: timeAgo(result.updatedAt, i18n.language, now) ?? '' })}
                  </span>
                </span>
              </div>

              <div className={styles.journey}>
                <div style={{ minWidth: 0 }}>
                  <p className={styles.ref}>{result.reference} · {result.mode}</p>
                  <div className={styles.route}>
                    <div style={{ minWidth: 0 }}>
                      <p className={styles.port}>{result.origin.code}</p>
                      <p className={styles.portCity}>{result.origin.city}</p>
                      <p className={styles.portWhen}>
                        {result.departedAt
                          ? t('publicDeparted', { date: formatDate(result.departedAt) })
                          : t('publicNotDeparted')}
                      </p>
                    </div>
                    <div
                      className={styles.progress}
                      role="progressbar"
                      aria-valuenow={result.progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('publicJourney')}
                    >
                      <span className={styles.progressFill} style={{ width: `${result.progressPct}%` }} />
                      <span className={styles.progressPin} style={{ left: `${result.progressPct}%` }}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                          <path d={result.mode === 'Air' ? ICON.air : ICON.sea} />
                        </svg>
                      </span>
                    </div>
                    <div className={styles.routeEnd}>
                      <p className={styles.port}>{result.destination.code}</p>
                      <p className={styles.portCity}>{result.destination.city}</p>
                      <p
                        className={styles.portEta}
                        style={{ '--etaFg': delayed ? 'var(--color-primary)' : 'var(--text-muted)' } as CSSProperties}
                      >
                        {result.eta
                          ? t(result.etaRevised ? 'publicEtaRevised' : 'publicEta', {
                              date: formatDate(result.eta),
                            })
                          : t('publicNoEta')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.donutRow}>
                  <span className={styles.donut} aria-hidden="true">
                    <svg width="74" height="74" viewBox="0 0 74 74">
                      <circle cx="37" cy="37" r="30" fill="none" stroke="var(--noa-ring-track)" strokeWidth="7" />
                      <circle
                        cx="37" cy="37" r="30" fill="none"
                        stroke="var(--resultFg)" strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={`${((2 * Math.PI * 30 * result.progressPct) / 100).toFixed(1)} ${(2 * Math.PI * 30).toFixed(1)}`}
                        transform="rotate(-90 37 37)"
                      />
                    </svg>
                    <span className={styles.donutValue}>{result.progressPct}%</span>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className={styles.ref}>{t('publicJourneyComplete')}</p>
                    <p className={styles.donutLeg}>{result.routing}</p>
                    <p className={styles.donutEquip}>{result.equipment}</p>
                  </div>
                </div>
              </div>

              <div className={styles.facts}>
                {result.facts.map((fact) => (
                  <div className={styles.fact} key={fact.id} data-locked={fact.locked || undefined}>
                    <p className={styles.factKey}>
                      {t(`publicFact_${fact.id}`)}
                      {fact.locked && (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinejoin="round" aria-label={t('publicLocked')}>
                          <path d={ICON.lock} />
                        </svg>
                      )}
                    </p>
                    <p className={styles.factValue}>
                      {fact.locked ? t('publicSignInToView') : (fact.value ?? '—')}
                    </p>
                  </div>
                ))}
              </div>

              <div className={styles.milestones}>
                <div className={styles.milestonesHead}>
                  <p className={styles.milestonesLabel}>{t('publicMilestones')}</p>
                  <span className={styles.milestonesCount}>
                    {t('publicStages', { done, total: result.milestones.length })}
                  </span>
                </div>
                <ol className={styles.steps}>
                  {result.milestones.map((step, index) => (
                    <li
                      className={styles.step}
                      key={step.id}
                      data-done={step.at !== null || undefined}
                      data-next={step.at === null && index === done ? 'true' : undefined}
                      data-last={index === result.milestones.length - 1 ? 'true' : undefined}
                    >
                      <span className={styles.stepLine} aria-hidden="true" />
                      <span className={styles.stepDot} aria-hidden="true" />
                      <span className={styles.stepLabel}>{step.label}</span>
                      <p className={styles.stepWhen}>
                        {/* A stage with neither a date nor a due date is expected
                            but unscheduled. "due" followed by nothing is worse
                            than saying so. */}
                        {formatDate(step.at) ??
                          (formatDate(step.due)
                            ? t('publicDue', { date: formatDate(step.due) })
                            : t('publicUnscheduled'))}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={styles.resultFoot}>
                <p>
                  <strong>{t('publicSignInForRest')}</strong> {t('publicSignInForRestNote')}
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} onClick={() => window.location.assign('/login')}>
                    {t('signIn')}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={goToAccessRequest}
                  >
                    {t('publicRequestAction')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ what a portal account adds ═══ */}
        <section
          className={leads ? styles.band : `${styles.band} ${styles.lift}`}
          aria-labelledby="public-benefits"
        >
          <div className={styles.bandHead}>
            <div style={{ minWidth: 0 }}>
              <h2 id="public-benefits" className={styles.bandTitle}>{t('publicBenefitsTitle')}</h2>
              <p className={styles.bandSub}>{t('publicBenefitsNote')}</p>
            </div>
            <span className={styles.bandRule} aria-hidden="true" />
          </div>
          <div className={styles.features}>
            {FEATURES.map((feature) => (
              <article
                className={styles.feature}
                key={feature.id}
                style={{ '--accent': feature.accent, '--accentWash': feature.wash } as CSSProperties}
              >
                <span className={styles.featureIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinejoin="round">
                    <path d={feature.icon} />
                  </svg>
                </span>
                <span className={styles.featureTitle}>{t(`publicBenefit_${feature.id}`)}</span>
                <span className={styles.featureSub}>{t(`publicBenefitNote_${feature.id}`)}</span>
                <span className={styles.featureTag}>{t(`publicBenefitKicker_${feature.id}`)}</span>
              </article>
            ))}
          </div>
        </section>

        {/* ═══ access + rates ═══ */}
        <div className={styles.access}>
          <section className={styles.card} aria-labelledby="public-access" ref={accessSection}>
            <p className={styles.badgeRow}>
              <span className={styles.badge}>{t('publicInvitationOnly')}</span>
              <span className={styles.badgeNote}>{t('publicNoSignUp')}</span>
            </p>
            <h2 id="public-access" className={styles.cardTitle}>{t('publicRequestTitle')}</h2>
            <p className={styles.cardBlurb}>{t('publicRequestNote')}</p>

            <div className={styles.fields}>
              <Field label={t('publicCompany')} placeholder={t('publicCompanyHint')} value={form.company} onChange={change('company')} />
              <Field
                label={t('publicWorkEmail')}
                placeholder={t('publicWorkEmailHint')}
                value={form.email}
                onChange={change('email')}
                type="email"
                invalid={form.email.length > 0 && !emailValid}
                note={form.email.length > 0 && !emailValid ? t('publicWorkEmailInvalid') : t('publicWorkEmailNote')}
              />
              <Field label={t('publicCountry')} placeholder={t('publicCountryHint')} value={form.country} onChange={change('country')} />
              <Field
                label={t('publicReference')}
                placeholder={t('publicReferenceHint')}
                value={form.reference}
                onChange={change('reference')}
                note={t('publicReferenceNote')}
              />
            </div>

            <div className={styles.submitRow}>
              <p className={styles.privacy}>{t('publicPrivacy')}</p>
              <button
                type="button"
                className={styles.submit}
                disabled={!canSubmit}
                onClick={submitRequest}
              >
                {accessRequest.isPending ? t('publicSending') : t('publicRequestAction')}
              </button>
            </div>

            {accessRequest.isSuccess && (
              <p className={styles.received} role="status">
                <strong>{t('publicRequestReceived')}</strong>{' '}
                {t('publicRequestReference', { reference: accessRequest.data.reference })}{' '}
                {t('publicRequestReceivedNote')}
              </p>
            )}

            {accessRequest.isError && (
              <p className={styles.received} data-error="true" role="alert">
                <strong>{t('publicRequestFailed')}</strong> {t('publicRequestFailedNote')}
              </p>
            )}
          </section>

          <div className={styles.aside}>
            <button type="button" className={styles.rates} onClick={goToAccessRequest}>
              <span className={styles.ratesEyebrow}>{t('publicRatesEyebrow')}</span>
              <span className={styles.ratesTitle}>{t('publicRatesTitle')}</span>
              <span className={styles.ratesSub}>{t('publicRatesNote')}</span>
              <span className={styles.ratesCta}>
                {t('publicRatesAction')}
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d={ICON.arrow} />
                </svg>
              </span>
            </button>

            <section className={styles.card} aria-labelledby="public-invited">
              <h2 id="public-invited" className={styles.helpTitle}>{t('publicInvitedTitle')}</h2>
              <span className={styles.helpRule} aria-hidden="true" />
              <ol className={styles.helpRows}>
                <li className={styles.helpRow}><span>{t('publicInvitedStep1')}</span></li>
                <li className={styles.helpRow}><span>{t('publicInvitedStep2')}</span></li>
                <li className={styles.helpRow}><span>{t('publicInvitedStep3')}</span></li>
              </ol>
              <button type="button" className={styles.goSignIn} onClick={() => window.location.assign('/login')}>
                {t('publicGoToSignIn')}
              </button>
            </section>
          </div>
        </div>

        {/* ═══ CO2e calculator — the shared component ═══ */}
        <Co2Calculator onSearchRates={goToAccessRequest} />

        <div className={styles.note}>
          <span>{t('publicOffice')}</span>
          <span>{t('publicMilestoneNote')}</span>
          {/* Said plainly rather than hidden: while this is on, nothing on the
              page is a real shipment. It disappears the moment the API answers. */}
          {publicApiIsStandIn && <span data-warning="true">{t('publicSampleData')}</span>}
        </div>
      </div>
    </div>
  );
}

function Field({
  label, placeholder, value, onChange, type = 'text', note, invalid,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  note?: string;
  invalid?: boolean;
}) {
  const id = `request-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div style={{ minWidth: 0 }}>
      <label className={styles.fieldLabelBlock} htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {note && (
        <p className={styles.inputNote} id={`${id}-note`} data-error={invalid || undefined}>
          {note}
        </p>
      )}
    </div>
  );
}
