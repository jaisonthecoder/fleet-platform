import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

import { Button, Input } from '../../../design-system';
import {
  LocalAuthError,
  beginMfaEnrolment,
  confirmMfaEnrolment,
  verifyMfa,
  type LocalSession,
} from '../api/local-auth';
import styles from './LocalAuthPanels.module.css';

type Panel = 'verify' | 'enrol' | 'recovery';

/**
 * The second factor, from either end: a session waiting for a code, or one that has
 * to set the factor up first. Both land on the same signed-in callback.
 */
export function MfaPanel({
  state,
  onAuthenticated,
}: {
  state: LocalSession['state'];
  onAuthenticated: () => void;
}) {
  const { t } = useTranslation('localAuth');
  const [panel, setPanel] = useState<Panel>(state === 'mfa_required' ? 'verify' : 'enrol');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  if (panel === 'recovery') {
    return (
      <section className={styles.panel} aria-labelledby="mfa-heading">
        <h2 id="mfa-heading">{t('recoveryHeading')}</h2>
        <p>{t('recoveryIntro')}</p>
        <ul className={styles.codes}>
          {recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Button onClick={onAuthenticated}>{t('recoveryDone')}</Button>
      </section>
    );
  }

  if (panel === 'enrol') {
    return (
      <EnrolPanel
        onEnrolled={(codes) => {
          setRecoveryCodes(codes);
          setPanel('recovery');
        }}
      />
    );
  }

  return <VerifyPanel onVerified={onAuthenticated} />;
}

function VerifyPanel({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation('localAuth');
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await verifyMfa(useRecovery ? { recoveryCode: value } : { code: value });
      onVerified();
    } catch (error) {
      setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
      setPending(false);
    }
  }

  return (
    <form className={styles.panel} onSubmit={(event) => void submit(event)} aria-labelledby="mfa-heading">
      <h2 id="mfa-heading">{t('mfaHeading')}</h2>
      <p>{t('mfaIntro')}</p>
      {useRecovery ? (
        <Input
          label={t('recoveryCode')}
          autoComplete="one-time-code"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <Input
          label={t('code')}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      )}
      <Button type="submit" loading={pending}>
        {t(pending ? 'verifying' : 'verify')}
      </Button>
      <button
        type="button"
        className={styles.link}
        onClick={() => {
          setUseRecovery((previous) => !previous);
          setValue('');
          setMessage(null);
        }}
      >
        {t(useRecovery ? 'useCode' : 'useRecovery')}
      </button>
      {message && (
        <p role="alert" className={styles.message}>
          {message}
        </p>
      )}
    </form>
  );
}

function EnrolPanel({ onEnrolled }: { onEnrolled: (codes: string[]) => void }) {
  const { t } = useTranslation('localAuth');
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const enrolment = await beginMfaEnrolment();
        if (cancelled) return;
        setSecret(enrolment.secret);
        // Rendered in the browser: the secret never goes to a third-party image service.
        setQr(await QRCode.toDataURL(enrolment.uri, { margin: 1, width: 192 }));
      } catch (error) {
        if (!cancelled) setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      onEnrolled(await confirmMfaEnrolment(code));
    } catch (error) {
      setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
      setPending(false);
    }
  }

  return (
    <form className={styles.panel} onSubmit={(event) => void submit(event)} aria-labelledby="mfa-heading">
      <h2 id="mfa-heading">{t('enrolHeading')}</h2>
      <p>{t('enrolIntro')}</p>
      {qr && <img src={qr} alt="" className={styles.qr} />}
      {secret && (
        <p className={styles.secret}>
          <span>{t('enrolSecretLabel')}</span>
          <code>{secret}</code>
        </p>
      )}
      <Input
        label={t('code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button type="submit" loading={pending} disabled={!secret}>
        {t(pending ? 'verifying' : 'enrolConfirm')}
      </Button>
      {message && (
        <p role="alert" className={styles.message}>
          {message}
        </p>
      )}
    </form>
  );
}
