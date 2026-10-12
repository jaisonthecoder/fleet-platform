import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Languages, LayoutGrid, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger, StatePanel,
} from '../../design-system';
import { AppShell } from '../../shared/layouts/app-shell';
import { isSignInConfigured, signIn, signOut } from '../../auth/sign-in';
import { getDevIdentity, setDevIdentity } from '../../auth/dev-session';
import { rememberStaffProfile } from '../../auth/recent-staff';
import { AccessError, currentUser } from '../../features/auth/api/current-user';
import { csrfToken, signOut as localSignOut } from '../../features/local-auth/api/local-auth';
import { staffNavigation } from '../navigation/navigation';
import { initials, primaryRole, roleLabels } from '../../features/staff/role-labels';
import i18n from '../../i18n';
import english from '../../features/staff/i18n/en-US.json';
import spanish from '../../features/staff/i18n/es-ES.json';
import styles from './StaffPortalLayout.module.css';

i18n.addResourceBundle('en-US', 'staff', english);
i18n.addResourceBundle('es-ES', 'staff', spanish);

export function StaffPortalLayout() {
  const { t } = useTranslation();
  const { t: staffText } = useTranslation('staff');
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState(false);
  const devIdentity = getDevIdentity();
  // A portal session (ADR-006) is a third way in, alongside Microsoft and the dev picker.
  const localSession = Boolean(csrfToken());
  const configured = isSignInConfigured('staff') || Boolean(devIdentity) || localSession;

  const user = useQuery({
    queryKey: ['current-user', 'staff'],
    queryFn: ({ signal }) => currentUser('staff', signal),
    enabled: configured && !leaving,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const permissions = user.data?.permissions ?? [];
  // Entry to the shell is "you have at least one staff screen", not one particular
  // screen. Gating on admin.staff.read locked out every role that is not a staff
  // administrator - a pricing specialist holds pricing.queue.read and pricing.claim
  // and was refused at the door of the portal that holds their queue. The navigation
  // below is filtered by the same permissions, so this opens no screen on its own.
  const permitted =
    !user.error && user.data?.isInternal && !user.data.onBehalfOfUserId &&
    staffNavigation.some((item) => permissions.includes(item.permission));
  const state = !configured ? 'unavailable'
    : user.isPending ? 'loading'
    : user.error instanceof AccessError && user.error.kind !== 'accessUnavailable' ? 'denied'
    : user.error ? 'unavailable'
    : permissions.length === 0 ? 'pending'
    : 'denied';

  /*
   * A customer who lands on the staff portal is at the wrong door, not refused:
   * send them to their own shell instead of showing them a denial they can do
   * nothing about. The customer layout holds the mirror of this guard.
   */
  const isCustomer = Boolean(user.data && !user.data.isInternal);
  useEffect(() => {
    if (isCustomer && !leaving) window.location.replace('/app/dashboard');
  }, [isCustomer, leaving]);

  const active = location.pathname.split('/').filter(Boolean)[1] ?? 'staff';
  const role = primaryRole(user.data?.roleKeys ?? []);
  const roleName = role ? staffText(roleLabels[role] ?? 'unknownRole') : null;

  async function leave() {
    setLeaving(true);
    setActionError(false);
    if (user.data) {
      rememberStaffProfile({
        displayName: user.data.displayName,
        email: user.data.email,
        ...(user.data.branchName ? { branchName: user.data.branchName } : {}),
      });
    }
    await cache.cancelQueries();
    cache.clear();
    // End every credential this browser holds, not just the first one matched.
    // A locally picked identity has no Microsoft session to end, and a portal
    // session ends through our own endpoint - but both can be held at once, and
    // AuthGuard resolves the portal cookie ahead of the dev identity. Clearing
    // only one leaves the other signing the previous person back in.
    const hadDevIdentity = Boolean(devIdentity);
    const hadPortalSession = Boolean(localSession);

    if (hadPortalSession) await localSignOut().catch(() => undefined);
    if (hadDevIdentity) setDevIdentity(null);

    if (hadDevIdentity || hadPortalSession) {
      window.location.assign('/login');
      return;
    }

    try { await signOut('staff'); }
    catch { setActionError(true); setLeaving(false); }
  }

  const navigation = permitted && !leaving
    ? staffNavigation
        .filter((item) => permissions.includes(item.permission))
        .map(({ id, href, icon: Icon, group, available }) => ({
          id,
          href: available ? href : undefined,
          label: staffText(`nav_${id}`),
          icon: <Icon aria-hidden="true" />,
          group: staffText(`navGroup_${group}`),
          disabled: !available,
          statusLabel: available ? undefined : staffText('navUnavailable'),
        }))
    : [];
  const mobileNavigationIds = ['customers', 'organisations', 'branches', 'staff']
    .filter((id) => navigation.some((item) => item.id === id));

  return (
    <AppShell
      brand={<span className={styles.brand}>NOATUM <small>LOGISTICS</small></span>}
      utility={
        <>
          <span className={styles.context}>
            <span>
              {user.data?.branchName
                ? `${staffText('brandShort')} \u00b7 ${user.data.branchName}`
                : staffText('internalContext')}
            </span>
            {roleName && <span className={styles.roleBadge}>{roleName}</span>}
          </span>
          <div className="noa-utility-actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={styles.utilityMenu} aria-label={t('language')}>
                  <Languages aria-hidden="true" />
                  <span>{i18n.language === 'es-ES' ? 'ES' : 'EN'}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={i18n.language} onValueChange={(value) => { void i18n.changeLanguage(value); }}>
                  <DropdownMenuRadioItem value="en-US">{t('english')}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="es-ES">{t('spanish')}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {user.data ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.profileTrigger} aria-label={staffText('profile')}>
                    <span className={styles.utilityAvatar} aria-hidden="true">
                      {initials(user.data.displayName, user.data.email)}
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={styles.profileMenu}>
                  <DropdownMenuLabel>{user.data.displayName}</DropdownMenuLabel>
                  <span className={styles.profileEmail}>{user.data.email}</span>
                  <DropdownMenuSeparator />
                  {localSession && (
                    <DropdownMenuItem onSelect={() => navigate('/portal/account')}>
                      <ShieldCheck aria-hidden="true" />
                      {staffText('accountSecurity')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => { void leave(); }}>
                    <LogOut aria-hidden="true" />
                    {staffText('signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <button
              type="button"
              className={styles.signOutButton}
              aria-label={staffText('signOut')}
              title={staffText('signOut')}
              disabled={!configured || leaving}
              onClick={() => { void leave(); }}
            >
              <LogOut aria-hidden="true" size={14} />
            </button>
          </div>
        </>
      }
      actions={null}
      moduleNavigation={
        <nav className="noa-module-links" aria-label={staffText('moduleNavigation')}>
          <a href="/portal/staff" aria-current="page">
            <LayoutGrid aria-hidden="true" />
            <span>{staffText('moduleAdministration')}</span>
          </a>
        </nav>
      }
      context={null}
      navigation={navigation}
      mobileNavigationIds={mobileNavigationIds}
      mobileNavigationLabel={t('mobileNavigation')}
      mobileMenuLabel={t('mobileMenu')}
      activeId={active}
      onNavigate={(id) => {
        const target = staffNavigation.find((item) => item.id === id);
        if (target?.available) navigate(target.href);
      }}
      navigationLabel={t('navigation')}
      navigationNote={navigation.some((item) => item.disabled) ? staffText('navNote') : undefined}
      menuLabel={t('menu')}
      closeLabel={t('close')}
      skipLabel={t('skip')}
      collapseLabel={t('collapseMenu')}
      expandLabel={t('expandMenu')}
      footer={
        <>
          <span>{t('brand')}</span>
          <span>{staffText('internalContext')}</span>
        </>
      }
    >
      {actionError && <p role="alert">{staffText('unavailable')}</p>}
      {permitted && !leaving ? (
        <Outlet context={user.data} />
      ) : (
        <StatePanel
          title={staffText(leaving ? 'loading' : state)}
          action={configured && !leaving ? (
            <>
              <Button iconLeft={<RefreshCw aria-hidden="true" size={16} />} loading={user.isFetching} onClick={() => { void user.refetch(); }}>{staffText('retry')}</Button>
              <Button variant="outline" onClick={() => { void signIn('staff').catch(() => setActionError(true)); }}>{staffText('signIn')}</Button>
            </>
          ) : <a href="/login">{staffText('signIn')}</a>}
        />
      )}
    </AppShell>
  );
}
