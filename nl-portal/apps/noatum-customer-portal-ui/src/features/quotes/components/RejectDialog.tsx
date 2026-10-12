import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import styles from './RejectDialog.module.css';

/** The four reasons a quotation is actually turned down. */
const REASONS = ['price', 'transit', 'elsewhere', 'cancelled'] as const;

interface Props {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Rejecting a quotation, with the reason.
 *
 * The reason is the point: a rejection with no reason tells the desk to guess,
 * and guessing is how the second quotation misses for the same cause as the
 * first. So the confirm stays disabled until one is picked, and the free text
 * asks for the thing that actually helps - a target rate, a transit, a competing
 * offer.
 */
export function RejectDialog({ busy, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [wantRevision, setWantRevision] = useState(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = () => {
    if (reason === null) return;
    // One sentence for the desk: the reason, what else they said, and whether
    // they want another go at it.
    const parts = [
      t(`optReason_${reason}`),
      note.trim() === '' ? null : note.trim(),
      wantRevision ? t('optWantRevision') : null,
    ].filter(Boolean);
    onConfirm(parts.join(' · '));
  };

  return (
    <>
      <button type="button" className={styles.scrim} aria-label={t('cancel')} onClick={onCancel} />

      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="reject-title">
        <div className={styles.head}>
          <h2 className={styles.title} id="reject-title">{t('optRejectTitle')}</h2>
          <p className={styles.note}>{t('optRejectNote')}</p>
        </div>

        <div className={styles.body}>
          <fieldset className={styles.reasons}>
            <legend className={styles.label}>{t('optReason')}</legend>
            {REASONS.map((key) => (
              <button
                key={key}
                type="button"
                className={styles.reason}
                data-on={reason === key ? 'true' : undefined}
                aria-pressed={reason === key}
                onClick={() => setReason(key)}
              >
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.reasonText}>{t(`optReason_${key}`)}</span>
              </button>
            ))}
          </fieldset>

          <div>
            <label className={styles.label} htmlFor="reject-note">
              {t('optAnythingElse')} <span className={styles.optional}>{t('optOptional')}</span>
            </label>
            <textarea
              id="reject-note"
              className={styles.textarea}
              rows={3}
              maxLength={400}
              placeholder={t('optNotePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <button
            type="button"
            className={styles.revision}
            data-on={wantRevision ? 'true' : undefined}
            aria-pressed={wantRevision}
            onClick={() => setWantRevision((on) => !on)}
          >
            <span className={styles.box} aria-hidden="true">
              {wantRevision && <Check size={10} strokeWidth={3.4} />}
            </span>
            <span className={styles.revisionText}>{t('optAskRevision')}</span>
          </button>
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onCancel}>{t('cancel')}</button>
          <button
            type="button" className={styles.confirm}
            disabled={reason === null || busy} onClick={submit}
          >
            {t('optRejectConfirm')}
          </button>
        </div>
      </div>
    </>
  );
}
