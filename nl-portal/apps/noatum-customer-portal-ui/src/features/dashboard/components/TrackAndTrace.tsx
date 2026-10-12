import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Search } from 'lucide-react';

import { RouteProgress } from '../../../design-system';
import { usePublicTracking, type TrackingLookup } from '../api/public-landing';
import styles from './TrackAndTrace.module.css';

/**
 * Track and trace, in the welcome band.
 *
 * One field that takes any reference the customer has to hand — a container, a
 * bill of lading, an air waybill, a booking or a purchase order — because at
 * the moment somebody wants to find a shipment they do not want to first be
 * asked what kind of number they are holding.
 *
 * It reads the same public tracking endpoint the landing page uses, so there is
 * one lookup in the product rather than a second one for signed-in customers.
 * The result is shown here rather than on another screen: the question is short
 * and so is the answer.
 */
export function TrackAndTrace() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<TrackingLookup | null>(null);

  const tracking = usePublicTracking(lookup);
  const result = tracking.data ?? null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const reference = query.trim();
    // The kind is not asked for. Most references are unambiguous by shape, and
    // the endpoint resolves it; making the customer classify their own number
    // first is a question we can answer ourselves.
    if (reference.length > 2) setLookup({ reference, kind: 'container' });
  };

  return (
    <section className={styles.band} aria-labelledby="track-title">
      <div className={styles.head}>
        <h2 id="track-title" className={styles.title}>
          <Search aria-hidden="true" className={styles.icon} />
          {t('trackTitle')}
        </h2>
        <p className={styles.note}>{t('trackNote')}</p>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="track-reference">{t('trackAnyReference')}</label>
          <input
            id="track-reference"
            className={styles.input}
            value={query}
            placeholder={t('trackPlaceholder')}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button type="submit" className={styles.submit} disabled={query.trim().length < 3}>
          <ArrowRight aria-hidden="true" />
          {t('trackAction')}
        </button>
      </form>

      {/* Announced, because the answer arrives without the page moving. */}
      <div className={styles.result} aria-live="polite">
        {tracking.isFetching && <p className={styles.state}>{t('trackSearching')}</p>}

        {!tracking.isFetching && lookup && !result && (
          <p className={styles.state}>{t('trackNoRecord', { reference: lookup.reference })}</p>
        )}

        {!tracking.isFetching && result && (
          <div className={styles.found}>
            <RouteProgress
              className={styles.route}
              origin={result.origin.code}
              destination={result.destination.code}
              progress={result.progressPct}
              modeIcon={result.mode === 'air' ? 'air-freight' : 'container-ship'}
              label={t('trackRoute', { from: result.origin.city, to: result.destination.city })}
            />
            <p className={styles.status}>
              <strong>{result.reference}</strong> · {t(`trackStatus_${result.status}`)}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
