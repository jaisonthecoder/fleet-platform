import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FileText, Receipt, Search, Ship, UserPlus } from 'lucide-react';

import type { components } from '../../../api/generated/schema';
import { RingGauge, RouteBreadcrumb } from '../../../design-system';
import { Co2Calculator } from '../../../shared/components/Co2Calculator';
import { TrackAndTrace } from '../components/TrackAndTrace';
import { PublicLanding } from '../components/PublicLanding';
import { AccountSetup } from '../components/AccountSetup';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { useAccountOverview } from '../api/overview';
import { useDashboardAnalytics, type DashboardFilters } from '../api/analytics';
import styles from './CustomerDashboardPage.module.css';

type CurrentUser = components['schemas']['CurrentUserDto'];

/** The three lists the portal will carry, and where each one lives. */
const LISTS = [
  { id: 'shipments', href: '/app/shipments', icon: Ship },
  { id: 'quotations', href: '/app/quotations', icon: FileText },
  { id: 'bookings', href: '/app/bookings', icon: Receipt },
] as const;

/** The three things worth doing first. Static: they are navigation, not data. */
const STARTERS = [
  { id: 'quote', href: '/app/quotations/new', icon: FileText, tone: 'action' },
  { id: 'team', href: '/app/team', icon: UserPlus, tone: 'navy' },
  { id: 'track', href: '/app/shipments', icon: Search, tone: 'muted' },
] as const;

/**
 * The customer's landing page, in three states.
 *
 *   visitor    not signed in — the public page: what the portal is, public
 *              tracking, and how to get an account.
 *   new        signed in, nothing on the account yet — say what will appear
 *              here and what to set up, rather than showing empty tiles.
 *   returning  signed in with activity — the lists carry their real counts.
 *
 * The state is read, never assumed: `/api/account/overview` answers who this
 * is, what they may see, what is set up and what is already here, in one call.
 *
 * There is no rate search on any of them: v4 rule 1 is that no rate management
 * exists and every quote is priced by a person, so a screen implying live
 * prices would be a promise the platform cannot keep.
 */
export function CustomerDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useOutletContext<CurrentUser | undefined>();
  const signedIn = Boolean(user);
  const overview = useAccountOverview(signedIn);

  /*
   * The analytics dashboard, when this account has one.
   *
   * It is behind a switch and a permission, so `null` is an ordinary answer
   * rather than a failure: the page falls back to the welcome below, which is
   * also the right screen for an account with nothing on it yet.
   */
  const [filters, setFilters] = useState<DashboardFilters>({ period: '12m', mode: 'all' });
  const analytics = useDashboardAnalytics(filters, signedIn);

  if (!signedIn) return <PublicLanding />;

  if (analytics.data) {
    return (
      <AnalyticsDashboard
        data={analytics.data}
        filters={filters}
        onFilters={setFilters}
        busy={analytics.isFetching}
      />
    );
  }

  const account = overview.data;
  const records = account?.records;
  const offices = account?.offices ?? [];

  // Only the steps the platform can actually observe count towards the ring.
  const tracked = (account?.setup ?? []).filter((step) => step.trackable);
  const doneCount = tracked.filter((step) => step.done).length;
  const percent = tracked.length === 0 ? 0 : Math.round((doneCount / tracked.length) * 100);

  const countOf = (id: (typeof LISTS)[number]['id']) =>
    id === 'shipments' ? records?.shipments : id === 'quotations' ? records?.quotations : records?.bookings;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroPattern} aria-hidden="true" />
        <div className={styles.heroInner}>
          <RouteBreadcrumb
            label={t('breadcrumb')}
            homeHref="/app/dashboard"
            homeLabel={t('customerNav_dashboard')}
            steps={[{ id: 'dashboard', label: t('customerNav_dashboard') }]}
          />

          <div className={styles.heroRow}>
            <div className={styles.heroLede}>
              <p className={styles.status}>
                <span className={styles.statusDot} aria-hidden="true" />
                {offices.length > 0
                  ? t('customerStatusOffices', {
                      count: offices.length,
                      names: offices.map((office) => office.name).join(', '),
                    })
                  : t('customerStatusActive')}
              </p>
              <h1 className={styles.heading}>
                {user?.displayName
                  ? t('customerWelcomeNamed', { name: user.displayName.split(' ')[0] })
                  : t('customerWelcome')}
              </h1>
              <p className={styles.lede}>
                {t('customerFirstRunLede', {
                  role: account?.roleNames?.[0] ?? t('customerRoleFallback'),
                  customer: account?.customerName ?? '',
                })}
              </p>
            </div>

            {tracked.length > 0 && (
              <div className={styles.heroSetup}>
                <RingGauge
                  value={percent}
                  label={t('setupTitle')}
                  valueLabel={`${doneCount}/${tracked.length}`}
                  caption={t('customerSetupCaption')}
                  tone={doneCount === tracked.length ? 'success' : 'action'}
                  formatValueText={(value) => t('setupPercent', { percent: value })}
                />
                <ul className={styles.heroSteps}>
                  {(account?.setup ?? []).slice(0, 3).map((step) => (
                    <li key={step.id} data-done={step.done ? 'true' : undefined}>
                      <span className={styles.heroStepDot} aria-hidden="true" />
                      {t(`setupStep_${step.id}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <TrackAndTrace />
        </div>
      </section>

      <div className={styles.body}>
        {/*
          One block per row, in the order the customer meets them: what they
          still have to do, the tool anyone can use without an account, then
          what the portal is holding for them.

          The checklist used to share a row with the calculator, which left the
          two arguing for the same attention and squeezed both. It leads on its
          own instead, and rises into the band's foot - it is the customer's own
          unfinished work, so it belongs against the welcome above it.
        */}
        {(account?.setup?.length ?? 0) > 0 && (
          <AccountSetup
            className={styles.lead}
            steps={account?.setup ?? []}
            onGo={(href) => navigate(href)}
          />
        )}

        {/* Full width now, so it takes the roomier layout rather than the
            sidebar one it was drawn compact for. */}
        <Co2Calculator
          className={styles.calculator}
          onSearchRates={() => navigate('/app/quotations/new')}
        />

        <div className={styles.starters}>
          {STARTERS.map((starter) => (
            <button
              key={starter.id}
              type="button"
              className={styles.starter}
              data-tone={starter.tone}
              onClick={() => navigate(starter.href)}
            >
              <span className={styles.starterIcon} aria-hidden="true">
                <starter.icon />
              </span>
              <span className={styles.starterTitle}>{t(`starter_${starter.id}`)}</span>
              <span className={styles.starterNote}>{t(`starterNote_${starter.id}`)}</span>
              <span className={styles.starterCta}>
                {t(`starterCta_${starter.id}`)} <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.lists}>
            {LISTS.map((list) => {
              const count = countOf(list.id);
              return (
                <section key={list.id} className={styles.list} aria-labelledby={`list-${list.id}`}>
                  <header className={styles.listHead}>
                    <div className={styles.lede}>
                      <h2 id={`list-${list.id}`} className={styles.listTitle}>
                        {t(`customerNav_${list.id}`)}
                      </h2>
                      <p className={styles.listNote}>{t(`listNote_${list.id}`)}</p>
                    </div>
                    {/* Absent rather than zero when the count is unknown: the
                        shipment tables do not exist yet, and "0 shipments" is a
                        claim, not a placeholder. */}
                    {count !== undefined && (
                      <span className={styles.listCount}>
                        {t(`listCount_${list.id}`, { count })}
                      </span>
                    )}
                  </header>

                  <div className={styles.listBody}>
                    <span className={styles.listIcon} aria-hidden="true"><list.icon /></span>
                    <div className={styles.lede}>
                      <p className={styles.listEmptyTitle}>{t(`listEmpty_${list.id}`)}</p>
                      <p className={styles.listEmptyNote}>{t(`listEmptyNote_${list.id}`)}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.listCta}
                      onClick={() => navigate(list.href)}
                    >
                      {t(`listCta_${list.id}`)}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className={styles.side}>
            <section className={styles.panel} aria-labelledby="access-title">
              <h2 id="access-title" className={styles.panelTitle}>{t('accessTitle')}</h2>
              <span className={styles.panelRule} aria-hidden="true" />
              <dl className={styles.facts}>
                {account?.customerName && (
                  <div>
                    <dt>{t('accessCustomer')}</dt>
                    <dd>{account.customerName}</dd>
                  </div>
                )}
                {account?.roleNames && account.roleNames.length > 0 && (
                  <div>
                    <dt>{t('accessRole')}</dt>
                    <dd>{account.roleNames.join(' · ')}</dd>
                  </div>
                )}
                {offices.length > 0 && (
                  <div>
                    <dt>{t('accessOffices')}</dt>
                    <dd>{offices.map((office) => `${office.cw1OrgCode} · ${office.name}`).join(', ')}</dd>
                  </div>
                )}
                {account?.signInEmail && (
                  <div>
                    <dt>{t('accessSignIn')}</dt>
                    <dd>{account.signInEmail}</dd>
                  </div>
                )}
                {account?.servicingBranchName && (
                  <div>
                    <dt>{t('accessBranch')}</dt>
                    <dd>{account.servicingBranchName}</dd>
                  </div>
                )}
              </dl>
              <p className={styles.panelNote}>{t('accessNote')}</p>
            </section>

            {/* Only when there is somebody to name. The DTO says this stays
                empty until contact assignment exists, so an empty card would be
                a promise rather than information. */}
            {(account?.contacts.length ?? 0) > 0 && (
              <section className={styles.panel} aria-labelledby="team-title">
                <h2 id="team-title" className={styles.panelTitle}>{t('teamTitle')}</h2>
                <span className={styles.panelRule} aria-hidden="true" />
                <ul className={styles.team}>
                  {account?.contacts.map((contact) => (
                    <li key={contact.email ?? contact.name} className={styles.member}>
                      <div>
                        <p className={styles.memberName}>{contact.name}</p>
                        <p className={styles.memberRole}>{contact.role}</p>
                        {contact.email && (
                          <a className={styles.memberMail} href={`mailto:${contact.email}`}>
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default CustomerDashboardPage;
