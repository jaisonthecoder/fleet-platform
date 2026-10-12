import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LockKeyhole, Mail } from 'lucide-react';

import { Button, Input } from '../../../design-system';
import { LocalAuthError, signIn, type LocalSession } from '../api/local-auth';
import { MfaPanel } from './MfaPanel';
import styles from './LocalAuthPanels.module.css';

/**
 * Email and password. Most staff sign in through Microsoft, but some Noatum accounts
 * have no Microsoft identity at all - the first administrator, who cannot be invited
 * because there is nobody to invite them, a contractor outside the tenant, and the
 * fictional staff a demonstration environment carries. The same form serves both tabs;
 * only the wording differs, so neither audience is told it is signing in as the other.
 */
export function LocalSignInForm({ audience = 'customer' }: { audience?: 'customer' | 'staff' }) {
  const { t } = useTranslation('localAuth');
  const [email, setEmail] = useState(() => localStorage.getItem('noatum.remembered-email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(localStorage.getItem('noatum.remembered-email')));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <section className={styles.panel} aria-labelledby="local-sign-in">
        <h2 id="local-sign-in">{t('signedInHeading')}</h2>
        <p>{t('signedInIntro')}</p>
        {/* /app, not /portal: the customer shell forwards a staff account to the
            operator portal, so one destination is right for both audiences. */}
        <Button onClick={() => window.location.assign('/app')}>{t('continueToPortal')}</Button>
      </section>
    );
  }

  if (session && session.state !== 'authenticated') {
    return <MfaPanel state={session.state} onAuthenticated={() => setDone(true)} />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      if (rememberEmail) localStorage.setItem('noatum.remembered-email', email.trim().toLowerCase());
      else localStorage.removeItem('noatum.remembered-email');
      const result = await signIn(email, password, audience);
      if (result.state === 'authenticated') {
        setDone(true);
        return;
      }
      setSession(result);
    } catch (error) {
      // Always our own wording: the API answers in English, and identically for an
      // unknown address and a wrong password.
      setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
      setPending(false);
    }
  }

  return (
    <form className={styles.panel} onSubmit={(event) => void submit(event)} aria-labelledby="local-sign-in">
      <div>
        <h2 id="local-sign-in">{t(audience === 'staff' ? 'staffSignInHeading' : 'signInHeading')}</h2>
        <p>{t(audience === 'staff' ? 'staffSignInIntro' : 'signInIntro')}</p>
      </div>
      <div className={styles.inputWrap}>
        <Mail aria-hidden="true" />
        <Input
          label={t('email')}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className={styles.passwordField}>
        <div className={styles.passwordHeader}>
          <span aria-hidden="true">{t('password')}</span>
          <a href="/forgot-password">{t('forgotPassword')}</a>
        </div>
        <Input
          label={t('password')}
          labelHidden
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((current) => !current)}>
          {t(showPassword ? 'hidePassword' : 'showPassword')}
        </button>
      </div>
      <label className={styles.remember}>
        <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} />
        <span>{t('rememberEmail')}</span>
      </label>
      <Button type="submit" loading={pending} iconLeft={<LockKeyhole size={16} aria-hidden="true" />}>
        {t(pending ? 'signingIn' : 'signIn')}
      </Button>
      {message && (
        <p role="alert" className={styles.message}>
          {message}
        </p>
      )}
    </form>
  );
}
