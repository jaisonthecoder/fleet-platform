import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { RouteBreadcrumb, StatePanel } from '../../../design-system';
import { AccessError } from '../../auth/api/current-user';
import { StaffError } from '../../staff/api/staff';
import type { CustomerSession } from '../../../app/layouts/CustomerPortalLayout';
import { InstantQuoteStrip } from '../components/InstantQuoteStrip';
import { useQuoteInsights } from '../api/insights';
import { QuoteInsights } from '../components/QuoteInsights';
import styles from './QuoteInstantPage.module.css';

function errorKey(error: unknown) {
  return error instanceof StaffError ? error.kind : error instanceof AccessError ? 'denied' : 'unavailable';
}

/**
 * The quotations landing page: ask for one.
 *
 * To REFERENCE/MOCKUP-htmls-page-vice/Noatum Instant Quote.html. Asking is what
 * a customer comes here to do far more often than reading the list, so asking is
 * what the page opens with - the list is one button away, and every other route
 * into quotations still lands where it did.
 *
 * The strip below the headline writes the same request the full form writes,
 * through the same two calls. The full request form is untouched; it is a click
 * away for everything this page does not ask.
 */
export function QuoteInstantPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useOutletContext<CustomerSession>();

  const mayCreate = Boolean(session?.permissions.includes('quotes.create'));

  /*
   * Everything the page reports under the form.
   *
   * Most of it is measured from this customer’s own quotations; the four
   * figures that cannot be are named in `sampled` and marked on screen.
   */
  const insights = useQuoteInsights(Boolean(session));

  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.pattern} aria-hidden="true" />
        <div className={styles.container}>
          <RouteBreadcrumb
            tone="dark"
            label={t('breadcrumb')}
            homeHref="/app/dashboard"
            homeLabel={t('customerNav_dashboard')}
            onHomeNavigate={() => navigate('/app/dashboard')}
            steps={[{ id: 'instant', label: t('instBreadcrumb') }]}
          />

          <div className={styles.headline}>
            <div className={styles.lede}>
              <h1 className={styles.title}>{t('instTitle')}</h1>
              <p className={styles.intro}>{t('instIntro')}</p>
            </div>

            {/* The way to the list, which used to be this route. Outline, because
                asking is the page's job and reading is the other one. */}
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => navigate('/app/quotations/list')}
              >
                {t('instViewQuotations')}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {mayCreate ? (
            <InstantQuoteStrip
              fullFormHref="/app/quotations/new"
              onSubmitted={(id) => navigate(`/app/quotations/${id}`)}
            />
          ) : (
            <p className={styles.denied}>{t('instNoPermission')}</p>
          )}
        </div>
      </div>

      {/*
        The content, to the mockup: what is waiting, how requests turn into
        bookings, a lane against the market, how fast a price comes back, the
        recent list and the lanes worth repeating.

        The hero and the instant quote strip above are untouched.
      */}
      <div className={styles.rise}>
        {insights.error && (
          <div role="alert" className={styles.state}>
            <StatePanel title={t(errorKey(insights.error))} />
          </div>
        )}

        {!insights.error && insights.isPending && (
          <div role="status" className={styles.state}>
            <StatePanel title={t('loading')} />
          </div>
        )}

        {insights.data && <QuoteInsights data={insights.data} />}
      </div>
    </section>
  );
}
