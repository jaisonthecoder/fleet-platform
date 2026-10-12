import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';

import { Badge, Button, Input, SectionHeading, StatePanel } from '../../../design-system';
import i18n from '../../../i18n';
import english from '../i18n/en-US.json';
import spanish from '../i18n/es-ES.json';
import {
  LocalAuthError,
  accountStatus,
  changePassword,
  confirmMfaEnrolment,
  regenerateRecoveryCodes,
  removeMfa,
  replaceMfa,
  signOutEverywhere,
  type AccountStatus,
  type MfaEnrolment,
} from '../api/local-auth';
import { PASSWORD_MIN_LENGTH, meetsPasswordRule } from '../password-rule';
import styles from './AccountSecurityPage.module.css';

i18n.addResourceBundle('en-US', 'localAuth', english);
i18n.addResourceBundle('es-ES', 'localAuth', spanish);

const MIN_LENGTH = PASSWORD_MIN_LENGTH;
/** Below this, a lost phone is one bad week away from a support call. */
const LOW_RECOVERY_CODES = 3;

export default function AccountSecurityPage() {
  const { t } = useTranslation('localAuth');
  const status = useQuery({
    queryKey: ['local-account'],
    retry: false,
    queryFn: ({ signal }) => accountStatus(signal),
  });

  if (status.isPending) {
    return <StatePanel title={t('checking')} />;
  }

  if (status.error || !status.data) {
    const denied = status.error instanceof LocalAuthError && status.error.kind === 'rejected';
    return <StatePanel title={t(denied ? 'accountSignInFirst' : 'unavailable')} />;
  }

  return (
    <div className={styles.page}>
      <SectionHeading title={t('accountHeading')} />
      <p className={styles.intro}>{t('accountIntro', { email: status.data.email })}</p>

      <PasswordCard status={status.data} />
      <MfaCard status={status.data} />
      <SessionsCard status={status.data} />
    </div>
  );
}

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h2>{title}</h2>
      <p className={styles.help}>{description}</p>
      {children}
    </section>
  );
}

function PasswordCard({ status }: { status: AccountStatus }) {
  const { t } = useTranslation('localAuth');
  const cache = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent(''); setNext(''); setConfirmation(''); setDone(true);
      void cache.invalidateQueries({ queryKey: ['local-account'] });
    },
    onError: (error) => setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable')),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setDone(false);
    if (!meetsPasswordRule(next)) { setMessage(t('passwordRule')); return; }
    if (next !== confirmation) { setMessage(t('mismatch')); return; }
    change.mutate();
  }

  return (
    <Card title={t('accountPasswordTitle')} description={t('accountPasswordHelp')}>
      {status.passwordSetAt && (
        <p className={styles.note}>
          {t('accountPasswordSet', { date: new Date(status.passwordSetAt).toLocaleDateString('en-GB').replaceAll('/', '.') })}
        </p>
      )}
      <form className={styles.form} onSubmit={submit}>
        <Input
          label={t('accountCurrentPassword')} type="password" autoComplete="current-password"
          required value={current} onChange={(event) => setCurrent(event.target.value)}
        />
        <Input
          label={t('newPassword')} type="password" autoComplete="new-password" minLength={MIN_LENGTH}
          required value={next} onChange={(event) => setNext(event.target.value)} hint={t('passwordRule')}
        />
        <Input
          label={t('confirmPassword')} type="password" autoComplete="new-password" minLength={MIN_LENGTH}
          required value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" loading={change.isPending}>{t('accountChangePassword')}</Button>
        {done && <p role="status" className={styles.done}>{t('accountPasswordChanged')}</p>}
        {message && <p role="alert" className={styles.message}>{message}</p>}
      </form>
    </Card>
  );
}

/**
 * Three states in one card: no factor yet, a factor in place, and a replacement part
 * way through. Splitting them across screens would lose the half-finished one.
 */
function MfaCard({ status }: { status: AccountStatus }) {
  const { t } = useTranslation('localAuth');
  const cache = useQueryClient();
  const [password, setPassword] = useState('');
  const [enrolment, setEnrolment] = useState<MfaEnrolment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enrolment) return;
    let cancelled = false;
    // Drawn in the browser: the secret never reaches an image service.
    void QRCode.toDataURL(enrolment.uri, { margin: 1, width: 192 }).then((value) => {
      if (!cancelled) setQr(value);
    });
    return () => { cancelled = true; };
  }, [enrolment]);

  const fail = (error: unknown) =>
    setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable'));
  const refresh = () => cache.invalidateQueries({ queryKey: ['local-account'] });

  const start = useMutation({
    mutationFn: () => replaceMfa(password),
    onSuccess: (value) => { setEnrolment(value); setPassword(''); setMessage(null); },
    onError: fail,
  });

  const confirm = useMutation({
    mutationFn: () => confirmMfaEnrolment(code),
    onSuccess: (value) => { setCodes(value); setEnrolment(null); setCode(''); void refresh(); },
    onError: fail,
  });

  const reissue = useMutation({
    mutationFn: regenerateRecoveryCodes,
    onSuccess: (value) => { setCodes(value); void refresh(); },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: () => removeMfa(password),
    onSuccess: () => { setPassword(''); setCodes(null); void refresh(); },
    onError: fail,
  });

  if (codes) {
    return (
      <Card title={t('recoveryHeading')} description={t('recoveryIntro')}>
        <ul className={styles.codes}>{codes.map((value) => <li key={value}>{value}</li>)}</ul>
        <Button onClick={() => setCodes(null)}>{t('recoveryDone')}</Button>
      </Card>
    );
  }

  if (enrolment) {
    return (
      <Card title={t('enrolHeading')} description={t('enrolIntro')}>
        {enrolment && qr && <img src={qr} alt="" className={styles.qr} />}
        <p className={styles.secret}>
          <span>{t('enrolSecretLabel')}</span>
          <code>{enrolment.secret}</code>
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => { event.preventDefault(); setMessage(null); confirm.mutate(); }}
        >
          <Input
            label={t('code')} inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]{6}" maxLength={6} required
            value={code} onChange={(event) => setCode(event.target.value)}
          />
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={() => { setEnrolment(null); setCode(''); }}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={confirm.isPending}>{t('enrolConfirm')}</Button>
          </div>
          {message && <p role="alert" className={styles.message}>{message}</p>}
        </form>
      </Card>
    );
  }

  return (
    <Card title={t('accountMfaTitle')} description={t('accountMfaHelp')}>
      <p className={styles.state}>
        <Badge tone={status.mfaEnrolled ? 'success' : 'warning'}>
          {t(status.mfaEnrolled ? 'accountMfaOn' : 'accountMfaOff')}
        </Badge>
        {status.mfaEnrolled && (
          <Badge tone={status.recoveryCodesLeft < LOW_RECOVERY_CODES ? 'warning' : 'neutral'}>
            {t('accountRecoveryLeft', { count: status.recoveryCodesLeft })}
          </Badge>
        )}
      </p>

      <form
        className={styles.form}
        onSubmit={(event) => { event.preventDefault(); setMessage(null); start.mutate(); }}
      >
        <Input
          label={t('accountCurrentPassword')} type="password" autoComplete="current-password"
          required value={password} onChange={(event) => setPassword(event.target.value)}
          hint={t('accountMfaPasswordHint')}
        />
        <div className={styles.actions}>
          <Button type="submit" loading={start.isPending}>
            {t(status.mfaEnrolled ? 'accountMfaReplace' : 'accountMfaSetUp')}
          </Button>
          {status.mfaEnrolled && !status.mfaRequired && (
            <Button
              type="button" variant="outline" loading={remove.isPending}
              onClick={() => { setMessage(null); remove.mutate(); }}
            >
              {t('accountMfaRemove')}
            </Button>
          )}
        </div>
      </form>

      {status.mfaEnrolled && (
        <Button variant="outline" loading={reissue.isPending} onClick={() => { setMessage(null); reissue.mutate(); }}>
          {t('accountRecoveryReissue')}
        </Button>
      )}
      {status.mfaRequired && <p className={styles.note}>{t('accountMfaRequired')}</p>}
      {message && <p role="alert" className={styles.message}>{message}</p>}
    </Card>
  );
}

function SessionsCard({ status }: { status: AccountStatus }) {
  const { t } = useTranslation('localAuth');
  const cache = useQueryClient();
  const [revoked, setRevoked] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const end = useMutation({
    mutationFn: signOutEverywhere,
    onSuccess: (count) => {
      setRevoked(count);
      void cache.invalidateQueries({ queryKey: ['local-account'] });
    },
    onError: (error) => setMessage(error instanceof LocalAuthError ? t(error.kind) : t('unavailable')),
  });

  return (
    <Card title={t('accountSessionsTitle')} description={t('accountSessionsHelp')}>
      <p className={styles.state}>
        <Badge tone="neutral">{t('accountSessionsCount', { count: status.activeSessions })}</Badge>
      </p>
      <Button variant="outline" loading={end.isPending} onClick={() => { setMessage(null); end.mutate(); }}>
        {t('accountSignOutOthers')}
      </Button>
      {revoked !== null && (
        <p role="status" className={styles.done}>{t('accountSignedOutOthers', { count: revoked })}</p>
      )}
      {message && <p role="alert" className={styles.message}>{message}</p>}
    </Card>
  );
}
