import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../../design-system';
import { isSignInConfigured, signIn, signOut, type SignInAudience } from '../../../auth/sign-in';
import { getDevIdentity, setDevIdentity } from '../../../auth/dev-session';
import { csrfToken, signOut as localSignOut } from '../../local-auth/api/local-auth';
import { AccessError, currentUser } from '../api/current-user';
import { staffNavigation } from '../../../app/navigation/navigation';
import styles from '../pages/LoginPage.module.css';

function AccessContent({ audience }: { audience: SignInAudience }) {
  const { t } = useTranslation('login');
  const cache = useQueryClient();
  const devIdentity = getDevIdentity();
  const configured = isSignInConfigured(audience) || Boolean(devIdentity);
  const [leaving, setLeaving] = useState(false);
  const [actionError, setActionError] = useState(false);
  const query = useQuery({
    queryKey: ['current-user', audience],
    queryFn: ({ signal }) => currentUser(audience, signal),
    enabled: configured && !leaving,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const state = !configured ? 'unavailable' : query.isFetching ? 'checkingAccess'
    : query.error ? query.error instanceof AccessError ? query.error.kind : 'accessUnavailable'
    : query.data ? query.data.permissions.length === 0 ? 'accessPending' : 'accessConfirmed'
    : 'checkingAccess';

  /*
   * Where this person actually belongs: the first staff screen their permissions
   * open, not a fixed one. Requiring admin.staff.read sent every internal role that
   * is not a staff administrator here and left them - a pricing specialist holds
   * pricing.queue.read and pricing.claim, and landed on "access confirmed" with
   * nothing to press, which is exactly what the note below says must never happen.
   * The same list drives the navigation, so this reaches no screen the shell would
   * not already show them.
   */
  const me = query.data;
  const staffLanding =
    audience === 'staff' && me?.isInternal && !me.onBehalfOfUserId
      ? staffNavigation.find((item) => me.permissions.includes(item.permission))?.href
      : undefined;

  const mayEnterStaff = Boolean(
    !leaving && !query.isFetching && !query.error && staffLanding,
  );

  /*
   * A customer with any permission at all belongs in the customer portal. Until
   * that shell existed this branch had nowhere to send them, so they sat on
   * "access confirmed" with nothing to press — the one outcome this panel is
   * meant to prevent.
   *
   * isInternal is the fork: it is the API's own answer to which kind of account
   * this is, so the two shells can never both claim the same person.
   */
  const mayEnterCustomer = Boolean(
    !leaving && !query.isFetching && !query.error &&
    query.data && !query.data.isInternal && query.data.permissions.length > 0,
  );

  // Anyone entitled to the portal goes there, whether they have just signed in or were
  // already signed in. Leaving them on a page that says "access confirmed" with nothing
  // to press is the one outcome this panel must never produce. Sign out lives in the
  // portal's profile menu, so switching account is still reachable.
  // `replace`, not `assign`, so Back does not land on a page that redirects again.
  useEffect(() => {
    if (mayEnterStaff && staffLanding) window.location.replace(staffLanding);
    else if (mayEnterCustomer) window.location.replace('/app/dashboard');
  }, [mayEnterStaff, staffLanding, mayEnterCustomer]);

  async function leave() {
    setLeaving(true);
    setActionError(false);
    await cache.cancelQueries();
    cache.clear();
    // End every credential this browser holds, not just the first one matched.
    // A locally picked identity has no Microsoft session to end, and a portal
    // session ends through our own endpoint - but both can be held at once, and
    // AuthGuard resolves the portal cookie ahead of the dev identity. Clearing
    // only one leaves the other signing the previous person back in.
    const hadDevIdentity = Boolean(devIdentity);
    const hadPortalSession = Boolean(csrfToken());

    if (hadPortalSession) await localSignOut().catch(() => undefined);
    if (hadDevIdentity) setDevIdentity(null);

    if (hadDevIdentity || hadPortalSession) {
      window.location.assign('/login');
      return;
    }

    try { await signOut(audience); }
    catch { setActionError(true); setLeaving(false); }
  }

  return (
    <section className={styles.form} aria-labelledby="access-heading" aria-busy={query.isFetching || leaving}>
      <ShieldCheck size={28} aria-hidden="true" />
      <div role="status" aria-live="polite">
        <h2 id="access-heading">{t(leaving ? 'signingOut' : state)}</h2>
        {['accessPending', 'accessConfirmed', 'accessDenied', 'accessUnavailable', 'signInRequired'].includes(state) && !leaving && <p>{t(`${state}Description`)}</p>}
      </div>
      {configured && !leaving && state !== 'signInRequired' && <Button iconLeft={<RefreshCw size={16} aria-hidden="true" />} loading={query.isFetching} onClick={() => { void query.refetch(); }}>{t('checkAgain')}</Button>}
      {state === 'signInRequired' && <Button onClick={() => { setActionError(false); void signIn(audience).catch(() => setActionError(true)); }}>{t('signInAgain')}</Button>}
      {configured && <Button variant="outline" iconLeft={<LogOut size={16} aria-hidden="true" />} disabled={leaving} onClick={() => { void leave(); }}>{t('signOut')}</Button>}
      {actionError && <p role="alert" className={styles.message}>{t('accountActionError')}</p>}
      {!leaving && <a href="/login">{t('backToSignIn')}</a>}
    </section>
  );
}

export function AccessPanel({ audience }: { audience: SignInAudience }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AccessContent audience={audience} />
    </QueryClientProvider>
  );
}
