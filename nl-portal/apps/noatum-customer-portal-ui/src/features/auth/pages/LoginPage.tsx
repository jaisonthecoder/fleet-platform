import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Globe2, LockKeyhole, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Button, Input } from '../../../design-system';
import { completeSignIn, hasSession, isSignInConfigured, signIn, type SignInAudience } from '../../../auth/sign-in';
import { getDevIdentity } from '../../../auth/dev-session';
import { recentStaffProfile } from '../../../auth/recent-staff';
import { AccessPanel } from '../components/AccessPanel';
import { DevIdentityPicker } from '../components/DevIdentityPicker';
import { LocalSignInForm } from '../../local-auth/components/LocalSignInForm';
import { initials } from '../../staff/role-labels';
import i18n from '../../../i18n';
import english from '../i18n/en-US.json';
import spanish from '../i18n/es-ES.json';
import localEnglish from '../../local-auth/i18n/en-US.json';
import localSpanish from '../../local-auth/i18n/es-ES.json';
import styles from './LoginPage.module.css';

i18n.addResourceBundle('en-US', 'login', english);
i18n.addResourceBundle('es-ES', 'login', spanish);
i18n.addResourceBundle('en-US', 'localAuth', localEnglish);
i18n.addResourceBundle('es-ES', 'localAuth', localSpanish);

// Pilot sign-in (ADR-006). Off by default, which leaves the Entra path exactly as it was.
const localAuthEnabled = import.meta.env.VITE_LOCAL_AUTH_ENABLED === 'true';

export default function LoginPage() {
  const { t } = useTranslation('login');
  const callbackAudience = window.location.pathname === '/login/customer' ? 'customer'
    : window.location.pathname === '/login/staff' ? 'staff' : null;
  const [audience, setAudience] = useState<SignInAudience>(callbackAudience ?? 'customer');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<'error' | 'unavailable' | null>(null);
  const [session, setSession] = useState<SignInAudience | null>(null);
  const [devPicked, setDevPicked] = useState(() => Boolean(getDevIdentity()));
  const [recentStaff] = useState(recentStaffProfile);
  // Microsoft is how staff sign in. The password form is the exception, so it stays
  // folded away until somebody asks for it rather than inviting customers to try it.
  const [staffPasswordShown, setStaffPasswordShown] = useState(false);

  // A registration may list the bare origin as its redirect URI, so the callback can
  // land here rather than on /login/<audience>. Adopt any session MSAL already holds.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const candidate of ['staff', 'customer'] as const) {
        // completeSignIn also consumes the redirect that Microsoft lands on the bare
        // origin with, which is why it runs before the plain session check.
        await completeSignIn(candidate).catch(() => null);
        if (await hasSession(candidate)) {
          if (!cancelled) setSession(candidate);
          return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // With portal sign-in on, a customer has no Microsoft session to report on, so the
  // access panel is a staff-only view.
  const resolvedAudience = callbackAudience ?? session ?? (devPicked ? 'staff' : null);
  const activeAudience = localAuthEnabled && resolvedAudience === 'customer' ? null : resolvedAudience;
  const displayedAudience = activeAudience ?? audience;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await startMicrosoftSignIn(audience);
  }

  async function startMicrosoftSignIn(
    target: SignInAudience,
    options?: { loginHint?: string; chooseAccount?: boolean },
  ) {
    setMessage(null);
    if (!isSignInConfigured(target)) { setMessage('unavailable'); return; }
    setPending(true);
    try {
      const hint = options?.loginHint ?? (target === 'customer' ? email : undefined);
      await signIn(target, hint, { chooseAccount: options?.chooseAccount ?? false });
    }
    catch { setMessage('error'); }
    finally { setPending(false); }
  }

  const form = (
    <form onSubmit={(event) => { void submit(event); }} className={styles.form}>
      <div>
        <h2>{t(audience === 'customer' ? 'welcome' : 'staffWelcome')}</h2>
        <p>{t(audience === 'customer' ? 'customerIntro' : 'staffIntro')}</p>
      </div>
      {audience === 'customer' && <Input label={t('email')} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />}
      {/* One icon. A padlock and an arrow on the same button is two metaphors
          competing over a four-word label. */}
      <Button
        type="submit"
        loading={pending}
        iconLeft={audience === 'staff' ? <MicrosoftMark /> : <LockKeyhole size={16} aria-hidden="true" />}
      >
        {t(pending ? 'pending' : audience === 'customer' ? 'continue' : 'corporateSignIn')}
      </Button>
      <p className={styles.note}>{t(audience === 'customer' ? 'passwordNote' : 'staffNote')}</p>
      {message && <p role="alert" className={styles.message}>{t(message)}</p>}
      {audience === 'customer' ? (
        <div className={styles.invitation}><ShieldCheck size={18} aria-hidden="true" /><p>{t('invitation')}</p></div>
      ) : null}
    </form>
  );

  const selectAudience = (next: SignInAudience) => {
    setAudience(next);
    setEmail('');
    setMessage(null);
    setStaffPasswordShown(false);
  };

  return (
    <div className={styles.loginPage}>
      <section className={styles.brandPane} aria-labelledby="login-heading">
        <a href="/login" className={styles.brandLogo} aria-label="Noatum Logistics">
          NOATUM <small>LOGISTICS</small>
        </a>

        <div className={styles.brandMessage}>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1 id="login-heading">{t('headline')}</h1>
          <div className={styles.rule} />
          <p className={styles.description}>{t('intro')}</p>
          <dl className={styles.brandFacts}>
            <div><dt>25+</dt><dd>{t('countries')}</dd></div>
            <div><dt>&le;&nbsp;3 h</dt><dd>{t('latency')}</dd></div>
            <div><dt>1</dt><dd>{t('singleLogin')}</dd></div>
          </dl>
        </div>

        <footer className={styles.brandFooter}>
          <span>{t('group')}</span>
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
        </footer>
      </section>

      <section className={styles.authPane} aria-label={t('method')}>
        <header className={styles.authHeader}>
          <span>{t('signInLabel')}</span>
          <div className={styles.authUtilities}>
            <span className={styles.trackLink}><Search aria-hidden="true" />{t('trackShipment')}</span>
            <label className={styles.languageSelect}>
              <Globe2 aria-hidden="true" />
              <span className="noa-visually-hidden">{t('language')}</span>
              <select value={i18n.language} onChange={(event) => { void i18n.changeLanguage(event.target.value); }}>
                <option value="en-US">{t('english')}</option>
                <option value="es-ES">{t('spanish')}</option>
              </select>
            </label>
          </div>
        </header>

        <main className={styles.authMain}>
          <div className={styles.authWorkspace}>
            {!activeAudience ? (
              <div className={styles.audienceSwitch} role="tablist" aria-label={t('method')}>
                <button type="button" role="tab" aria-selected={audience === 'customer'} className={audience === 'customer' ? styles.audienceActive : undefined} onClick={() => selectAudience('customer')}>
                  <span className={styles.audienceIcon}><Building2 aria-hidden="true" /></span>
                  <span><strong>{t('customerOption')}</strong><small>{t('customerOptionDescription')}</small></span>
                </button>
                <button type="button" role="tab" aria-selected={audience === 'staff'} className={audience === 'staff' ? styles.audienceActiveStaff : undefined} onClick={() => selectAudience('staff')}>
                  <span className={styles.audienceIcon}><UserRound aria-hidden="true" /></span>
                  <span><strong>{t('employeeOption')}</strong><small>{t('employeeOptionDescription')}</small></span>
                </button>
              </div>
            ) : null}

            <div className={displayedAudience === 'staff' ? styles.staffSignIn : styles.customerSignIn} id="sign-in" role="tabpanel">
              {activeAudience ? (
                <AccessPanel audience={activeAudience} />
              ) : audience === 'customer' && localAuthEnabled ? (
                <>
                  <LocalSignInForm />
                  <button className={styles.ssoAction} type="button" onClick={() => { void startMicrosoftSignIn('customer'); }}>
                    {t('continueSso')}
                  </button>
                  <div className={styles.invitation}>
                    <ShieldCheck aria-hidden="true" />
                    <p><strong>{t('invitationTitle')}</strong> {t('invitationDescription')}</p>
                  </div>
                </>
              ) : audience === 'staff' ? (
                <>
                  {recentStaff ? (
                    <div className={styles.recentAccount}>
                      {/* The remembered account is the shortcut, so the account itself
                          is the control - not a label beside one. */}
                      <button
                        type="button"
                        className={styles.recentResume}
                        disabled={pending}
                        onClick={() => { void startMicrosoftSignIn('staff', { loginHint: recentStaff.email }); }}
                      >
                        <span className={styles.recentAvatar} aria-hidden="true">{initials(recentStaff.displayName, recentStaff.email)}</span>
                        <span className={styles.recentIdentity}>
                          <strong>{recentStaff.displayName}</strong>
                          <small>{[recentStaff.email, recentStaff.branchName].filter(Boolean).join(' · ')}</small>
                        </span>
                      </button>
                      <button type="button" onClick={() => { void startMicrosoftSignIn('staff', { chooseAccount: true }); }}>{t('useAnotherAccount')}</button>
                    </div>
                  ) : null}
                  {form}
                  {/* Microsoft is how most staff arrive, so it stays first. This is for
                      the accounts it does not cover - shown only when asked for, so the
                      employee tab does not look like a second place customers may type
                      their own details. */}
                  {localAuthEnabled ? (
                    staffPasswordShown ? (
                      <LocalSignInForm audience="staff" />
                    ) : (
                      <button
                        type="button"
                        className={styles.ssoAction}
                        onClick={() => setStaffPasswordShown(true)}
                      >
                        {t('usePassword')}
                      </button>
                    )
                  ) : null}
                  {/* The seeded identities are all Noatum staff, so the shortcut belongs here. */}
                  <DevIdentityPicker onPicked={() => setDevPicked(true)} />
                  <div className={styles.staffAssurances}>
                    <div><strong>{t('branchBound')}</strong><p>{t('branchBoundDescription')}</p></div>
                    <div><strong>{t('auditedActions')}</strong><p>{t('auditedActionsDescription')}</p></div>
                  </div>
                </>
              ) : form}
            </div>
          </div>
        </main>

        <footer className={styles.authFooter}>
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          <a href="https://www.noatumlogistics.com/">{t('about')}</a>
        </footer>
      </section>
    </div>
  );
}

function MicrosoftMark() {
  return (
    <span className={styles.microsoftMark} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
