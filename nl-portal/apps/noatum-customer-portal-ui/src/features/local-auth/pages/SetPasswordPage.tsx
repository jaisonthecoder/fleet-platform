import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '../../../design-system';
import {
  LocalAuthError,
  activationSubject,
  setPassword,
  type ActivationSubject,
  type LocalSession,
  type SetPasswordPurpose,
} from '../api/local-auth';
import { MfaPanel } from '../components/MfaPanel';
import { PASSWORD_MIN_LENGTH, meetsPasswordRule } from '../password-rule';
import styles from '../components/LocalAuthPanels.module.css';

const MIN_LENGTH = PASSWORD_MIN_LENGTH;

/**
 * One screen for the three links that end in a password: accepting an invitation,
 * setting up the first administrator, and recovering an account. They differ only in
 * wording and in which endpoint spends the token.
 */
export function SetPasswordPage({ purpose, token }: { purpose: SetPasswordPurpose; token: string }) {
  const { t } = useTranslation('localAuth');
  const [subject, setSubject] = useState<ActivationSubject | null>(null);
  const [loading, setLoading] = useState(purpose === 'activation');
  const [password, setValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);

  // Only the activation link can be read before it is spent; the others reveal
  // nothing until a password is actually set.
  useEffect(() => {
    if (purpose !== 'activation') return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await activationSubject(token);
        if (!cancelled) setSubject(found);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purpose, token, t]);

  if (session && session.state !== 'authenticated') {
    return <MfaPanel state={session.state} onAuthenticated={() => window.location.assign('/app')} />;
  }

  if (session) {
    return (
      <section className={styles.panel} aria-labelledby="set-password-heading">
        <h2 id="set-password-heading">{t('signedInHeading')}</h2>
        <p>{t('signedInIntro')}</p>
        {/* /app, not /portal: the customer shell forwards a staff account onward. */}
        <Button onClick={() => window.location.assign('/app')}>{t('continueToPortal')}</Button>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={styles.panel} aria-busy="true">
        <p role="status">{t('checking')}</p>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetsPasswordRule(password)) {
      setMessage(t('passwordRule'));
      return;
    }
    if (password !== confirmation) {
      setMessage(t('mismatch'));
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      setSession(await setPassword(purpose, token, password));
    } catch (error) {
      setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
      setPending(false);
    }
  }

  const headingKey = { activation: 'activationHeading', bootstrap: 'bootstrapHeading', reset: 'resetHeading' }[purpose];
  const introKey = { activation: 'activationIntro', bootstrap: 'bootstrapIntro', reset: 'resetIntro' }[purpose];
  const unusable = purpose === 'activation' && !subject;

  return (
    <form className={styles.panel} onSubmit={(event) => void submit(event)} aria-labelledby="set-password-heading">
      <div>
        <h2 id="set-password-heading">{t(headingKey)}</h2>
        {!unusable && (
          <p>{t(introKey, { name: subject?.displayName ?? '', email: subject?.email ?? '' })}</p>
        )}
      </div>
      {!unusable && (
        <>
          {/* Both fields reveal together: checking one against the other is the whole
              point of a confirm box, and two independent toggles make that harder. */}
          <div className={styles.passwordField}>
            <Input
              label={t('newPassword')}
              type={reveal ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
              value={password}
              onChange={(event) => setValue(event.target.value)}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-pressed={reveal}
              onClick={() => setReveal((current) => !current)}
            >
              {t(reveal ? 'hidePassword' : 'showPassword')}
            </button>
          </div>
          <Input
            label={t('confirmPassword')}
            type={reveal ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <p className={styles.note}>{t('passwordRule')}</p>
          <Button type="submit" loading={pending}>
            {t(pending ? 'saving' : 'setPassword')}
          </Button>
        </>
      )}
      {message && (
        <p role="alert" className={styles.message}>
          {message}
        </p>
      )}
      <a className={styles.link} href="/login">
        {t('back')}
      </a>
    </form>
  );
}
