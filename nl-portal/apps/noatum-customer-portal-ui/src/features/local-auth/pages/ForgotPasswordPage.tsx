import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '../../../design-system';
import { requestPasswordReset } from '../api/local-auth';
import styles from '../components/LocalAuthPanels.module.css';

export function ForgotPasswordPage() {
  const { t } = useTranslation('localAuth');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    // Whether the address is known is never disclosed, so the answer is the same
    // either way - including when the request itself fails.
    await requestPasswordReset(email).catch(() => undefined);
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <section className={styles.panel} aria-labelledby="forgot-heading">
        <h2 id="forgot-heading">{t('forgotHeading')}</h2>
        <p role="status">{t('forgotSent')}</p>
        <a className={styles.link} href="/login">
          {t('back')}
        </a>
      </section>
    );
  }

  return (
    <form className={styles.panel} onSubmit={(event) => void submit(event)} aria-labelledby="forgot-heading">
      <div>
        <h2 id="forgot-heading">{t('forgotHeading')}</h2>
        <p>{t('forgotIntro')}</p>
      </div>
      <Input
        label={t('email')}
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" loading={pending}>
        {t('send')}
      </Button>
      <a className={styles.link} href="/login">
        {t('back')}
      </a>
    </form>
  );
}
