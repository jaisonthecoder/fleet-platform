import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import { LogOut, ShieldCheck } from 'lucide-react';

import type { components } from '../../api/generated/schema';
import { Button, DropdownMenuItem, StatePanel } from '../../design-system';
import { CustomerMeasure, CustomerShell } from '../../shared/layouts/customer-shell';
import styles from '../../shared/layouts/customer-shell/CustomerShell.module.css';
import { isSignInConfigured, signOut } from '../../auth/sign-in';
import { getDevIdentity, setDevIdentity } from '../../auth/dev-session';
import { csrfToken, signOut as localSignOut } from '../../features/local-auth/api/local-auth';
import { currentUser } from '../../features/auth/api/current-user';
import { useAccountOverview } from '../../features/dashboard/api/overview';
import { initials, roleLabels } from '../../features/staff/role-labels';
import i18n from '../../i18n';
import { customerNavigation } from '../navigation/navigation';

export type CustomerSession = components['schemas']['CurrentUserDto'] | undefined;

/** The only page a visitor may read without signing in. */
const PUBLIC_PATH = '/app/dashboard';

/**
 * Which navigation entries carry a count, and where the number comes from.
 *
 * Only the four sections the account overview actually counts. The dashboard
 * and the team page are not a list of records, so neither gets a chip - a
 * number there would have to be invented to exist.
 */
const COUNTED = {
  shipments: 'shipments',
  quotations: 'quotations',
  bookings: 'bookings',
  invoices: 'invoices',
} as const satisfies Record<string, keyof components['schemas']['AccountRecordCountsDto']>;

/**
 * The quiet line under the name in CH-02, e.g. "Shipper · Finance".
 *
 * Every role this account holds, not the first: a customer who can quote and
 * pay invoices is two different people to two different Noatum teams, and the
 * header is where they check which hat they are wearing. Roles with no label
 * are dropped rather than shown as their raw key.
 */
function roleLine(roleKeys: readonly string[], t: (key: string) => string): string | undefined {
  const named = roleKeys
    .filter((key) => key in roleLabels && key.startsWith('customer_'))
    .map((key) => t(`role_${key}`));
  return named.length > 0 ? named.join(' · ') : undefined;
}

/**
 * The customer side of the product.
 *
 * Deliberately a separate layout from StaffPortalLayout rather than a variant of
 * it. The two audiences share an identity endpoint and nothing else: a customer
 * gets a website with horizontal navigation, an operator gets an application
 * with a rail. Folding both into one component is how you end up with a shell
 * full of `isInternal ?` branches that neither audience is happy with.
 *
 * The shell renders for everyone, signed in or not. The landing page is public
 * so a customer can see what the portal is before they have an account; every
 * other section requires a session and sends a visitor to sign in. Nothing on
 * the public page comes from the API, so there is nothing for an anonymous
 * visitor to read that they should not.
 */
export function CustomerPortalLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState(false);
  const devIdentity = getDevIdentity();

  /*
   * Only ask who this is when there is something that could answer. With no
   * configured sign-in and no session, the visitor is simply anonymous — which
   * is a valid state here, not a failure.
   */
  const mayHaveSession = isSignInConfigured('customer') || Boolean(devIdentity) || Boolean(csrfToken());

  const user = useQuery({
    queryKey: ['current-user', 'customer'],
    queryFn: ({ signal }) => currentUser('customer', signal),
    enabled: mayHaveSession && !leaving,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const permissions = user.data?.permissions ?? [];
  const isStaff = Boolean(user.data?.isInternal);
  const signedIn = Boolean(user.data && !isStaff);
  const checking = mayHaveSession && user.isPending && !leaving;

  /*
   * An operator who lands here has not done anything wrong; their portal is
   * simply the other one. Send them, rather than making them read an error and
   * retype a URL. `replace` so Back does not bounce between the two shells.
   *
   * In an effect, not in render: a redirect is a side effect, and under Strict
   * Mode a render-time one fires twice.
   */
  useEffect(() => {
    if (isStaff && !leaving) window.location.replace('/portal/staff');
  }, [isStaff, leaving]);

  const active = location.pathname.split('/').filter(Boolean)[1] ?? 'dashboard';

  /*
   * What each section holds, for the chips on the navigation.
   *
   * The same query the landing page makes, so on the dashboard this costs
   * nothing and everywhere else it is one cached call per half minute.
   */
  const overview = useAccountOverview(signedIn);
  const records = overview.data?.records;

  /*
   * Signed in, the navigation is what this account may open. Signed out, it is
   * the whole product: a visitor should see everything the portal offers, and
   * choosing any of it asks them to sign in rather than pretending the section
   * is not there.
   */
  const navigation = signedIn
    ? customerNavigation
        .filter((item) => permissions.includes(item.permission))
        .map(({ id, href, available }) => {
          const counted = id in COUNTED ? COUNTED[id as keyof typeof COUNTED] : undefined;
          // No overview, no chip. A refusal or a failed call is not a zero, and
          // drawing one would tell the customer they have nothing.
          const count = counted && records ? records[counted] : undefined;

          return {
            id,
            href: available ? href : undefined,
            label: t(`customerNav_${id}`),
            disabled: !available,
            statusLabel: available ? undefined : t('customerNavUnavailable'),
            count,
            countLabel: count === undefined ? undefined : t(`listCount_${counted}`, { count }),
          };
        })
    : customerNavigation.map(({ id, href }) => ({
        id,
        href: href === PUBLIC_PATH ? href : '/login',
        label: t(`customerNav_${id}`),
        statusLabel: href === PUBLIC_PATH ? undefined : t('customerNavSignInRequired'),
      }));

  async function leave() {
    setLeaving(true);
    setActionError(false);
    await cache.cancelQueries();
    cache.clear();

    // End every credential this browser holds, not just the first one matched.
    // AuthGuard resolves a portal session cookie ahead of a dev identity, so a
    // cookie left behind signs the previous person straight back in - picking a
    // staff demo account after this would still answer as the customer.
    const hadPortalSession = Boolean(csrfToken());
    const hadDevIdentity = Boolean(devIdentity);

    if (hadPortalSession) await localSignOut().catch(() => undefined);
    if (hadDevIdentity) setDevIdentity(null);

    if (hadPortalSession || hadDevIdentity) {
      window.location.assign('/login');
      return;
    }

    try { await signOut('customer'); }
    catch { setActionError(true); setLeaving(false); }
  }

  return (
    <CustomerShell
      brand={<>NOATUM <small>LOGISTICS</small></>}
      navigation={navigation}
      activeId={active}
      onNavigate={(id) => {
        const target = customerNavigation.find((item) => item.id === id);
        if (!target) return;
        // Signing in is a different bundle, so it is a real navigation.
        if (!signedIn && target.href !== PUBLIC_PATH) {
          window.location.assign('/login');
          return;
        }
        if (target.available) navigate(target.href);
      }}
      context={signedIn && user.data ? user.data.displayName : undefined}
      contextDetail={signedIn && user.data ? roleLine(user.data.roleKeys, t) : undefined}
      initials={signedIn && user.data ? initials(user.data.displayName, user.data.email) : undefined}
      /*
       * CH-01 names the organisation this session belongs to; the person is on
       * the account control at the other end of the same strip, so neither is
       * said twice. The customer name comes from the overview when we have it -
       * the identity endpoint carries a branch but not a company.
       */
      utilityContext={
        signedIn && user.data
          ? [overview.data?.customerName, user.data.branchName].filter(Boolean).join(' · ')
            || user.data.displayName
          : t('customerUtilityContext')
      }
      utilityBadge={signedIn ? t('customerAudienceBadge') : undefined}
      utilityActions={
        <>
          <div className={styles.language} role="group" aria-label={t('language')}>
            <button type="button" aria-pressed={i18n.language === 'en-US'} onClick={() => { void i18n.changeLanguage('en-US'); }}>EN</button>
            <span aria-hidden="true">|</span>
            <button type="button" aria-pressed={i18n.language === 'es-ES'} onClick={() => { void i18n.changeLanguage('es-ES'); }}>ES</button>
          </div>
          {!signedIn && <a href="/login">{t('signIn')}</a>}
        </>
      }
      accountLabel={t('yourAccount')}
      accountMenu={
        signedIn && user.data ? (
          <>
            {/* Only offered to a portal password account; an Entra customer manages
                their password at Microsoft, not here. */}
            {csrfToken() && (
              <DropdownMenuItem onSelect={() => navigate('/app/account')}>
                <ShieldCheck aria-hidden="true" />
                {t('accountSecurity')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled={leaving} onSelect={() => { void leave(); }}>
              <LogOut aria-hidden="true" />
              {t('signOut')}
            </DropdownMenuItem>
          </>
        ) : undefined
      }
      actions={
        signedIn ? undefined : (
          <Button size="sm" onClick={() => window.location.assign('/login')}>
            {t('signIn')}
          </Button>
        )
      }
      footerCopyright={t('customerCopyright', { year: new Date().getFullYear() })}
      navigationLabel={t('navigation')}
      menuLabel={t('menu')}
      closeLabel={t('close')}
      skipLabel={t('skip')}
    >
      {actionError && <p role="alert">{t('accessUnavailable')}</p>}
      {checking ? (
        <CustomerMeasure>
          <StatePanel title={t('loading')} />
        </CustomerMeasure>
      ) : (
        // Undefined for a visitor. Pages read it to decide what they may show.
        <Outlet context={signedIn ? user.data : undefined} />
      )}
    </CustomerShell>
  );
}

/**
 * Everything that is not the public landing page.
 *
 * A visitor is sent to sign in; a signed-in customer asking for a section that
 * has not shipped goes back to their dashboard rather than to a blank shell.
 */
export function CustomerSectionFallback() {
  const { t } = useTranslation();
  const session = useOutletContext<CustomerSession>();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/app/dashboard', { replace: true });
    else window.location.assign('/login');
  }, [session, navigate]);

  return (
    <CustomerMeasure>
      <StatePanel
        title={t('signInRequired')}
        action={<a href="/login">{t('signIn')}</a>}
      />
    </CustomerMeasure>
  );
}
