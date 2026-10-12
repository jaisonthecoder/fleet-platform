import { useTranslation } from 'react-i18next';
import { Spinner } from '../../../design-system';
import { formatMoney } from '../money';
import { optionTotal, type DraftOption } from './OptionEditor';
import styles from './PublishPanel.module.css';

interface Props {
  options: DraftOption[];
  /** cw1 or direct - how the quote actually reaches the customer. */
  publicationMode: string;
  publishedAt: string | null;
  customerName: string | null;
  /** Outstanding checks that stop a send. */
  blocking: number;
  /** Outstanding checks that only improve it. */
  advisory: number;
  /** Over the threshold and not yet approved. */
  awaitingApproval: boolean;
  /** The acting user priced it, so four eyes says somebody else approves. */
  mayApprove: boolean;
  /** quotations.portal_pricing - whether this branch prices in the portal. */
  mayPrice: boolean;
  /** Unsaved work in the editor. */
  dirty: boolean;
  saved: boolean;
  busy: boolean;
  failure: string | null;
  onSave: () => void;
  onApprove: () => void;
  onSendBack: () => void;
  onPublish: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  openIndex: number;
  removable: boolean;
}

/**
 * Publication and send.
 *
 * Everything that decides whether this quotation can go out, and the acts that
 * send it. It sits at the head of the side column and stays there while the
 * price is typed, because the answer to "can I send this yet" is what a pricer
 * checks most and it used to be at the very bottom of the page.
 */
export function PublishPanel({
  options, publicationMode, publishedAt, customerName, blocking, advisory,
  awaitingApproval, mayApprove, mayPrice, dirty, saved, busy, failure,
  onSave, onApprove, onSendBack, onPublish, onDuplicate, onRemove, openIndex, removable,
}: Props) {
  const { t } = useTranslation('staff');

  const recommended = options.find((option) => option.isRecommended);
  const cheapest = options.reduce<number | null>((best, option) => {
    const total = optionTotal(option);
    return best === null || total < best ? total : best;
  }, null);

  const tone = blocking > 0 ? 'blocked' : advisory > 0 ? 'open' : 'clear';
  const note = awaitingApproval
    ? mayApprove ? t('publishAwaitingYou') : t('publishAwaitingOther')
    : blocking > 0
      ? t('publishBlocked', { count: blocking })
      : advisory > 0
        ? t('publishOpenChecks', { count: advisory })
        : t('publishAllClear');

  return (
    <div className={styles.panel}>
      <div className={styles.state}>
        <span className={styles.stateRow}>
          <span className={styles.label}>{t('publication')}</span>
          <span className={styles.pill} data-sent={publishedAt ? 'true' : undefined}>
            {publishedAt ? t('publicationSent') : t('publicationDraft')}
          </span>
        </span>
        <span className={styles.approval}>
          <span className={styles.dot} data-tone={tone} aria-hidden="true" />
          {/* The dot repeats what this sentence says; the sentence is the signal. */}
          <span>{note}</span>
        </span>
      </div>

      <div className={styles.body}>
        <div>
          <div className={styles.summary}>{t('publishOptionCount', { count: options.length })}</div>
          <div className={styles.detail}>
            {recommended
              ? t('publishRecommending', {
                  name: recommended.name.trim() || t('optionUnnamed'),
                  amount: formatMoney(optionTotal(recommended), recommended.currency),
                })
              : t('publishNoneRecommended', {
                  amount: formatMoney(cheapest, options[0]?.currency ?? 'EUR'),
                })}
          </div>
        </div>

        {/* Saving is not sending, and the wording says so on both buttons. */}
        <button
          type="button"
          className={styles.secondary}
          disabled={!mayPrice || busy || !dirty}
          onClick={onSave}
        >
          {dirty ? t('savePricing') : t('pricingSavedShort')}
        </button>

        {awaitingApproval && mayApprove ? (
          <>
            <button type="button" className={styles.send} disabled={busy} onClick={onApprove}>
              {busy && <Spinner className={styles.spinner} size={14} label={t('loading')} />}
              {t('approve')}
            </button>
            <button type="button" className={styles.secondary} data-quiet="true" disabled={busy} onClick={onSendBack}>
              {t('sendBack')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.send}
            disabled={busy || blocking > 0 || awaitingApproval}
            onClick={onPublish}
          >
            {busy && <Spinner className={styles.spinner} size={14} label={t('loading')} />}
            {t('publishOptions', { count: options.length })}
          </button>
        )}

        <button type="button" className={styles.secondary} disabled={busy} onClick={onDuplicate}>
          {t('publishDuplicate', { number: openIndex + 1 })}
        </button>
        {removable && (
          <button
            type="button" className={styles.secondary} data-quiet="true" disabled={busy} onClick={onRemove}
          >
            {t('publishRemove', { number: openIndex + 1 })}
          </button>
        )}

        {saved && <span className={styles.saved} role="status">{t('pricingSaved')}</span>}
        {failure && <p className={styles.error} role="alert">{failure}</p>}

        <span className={styles.scope}>
          {t(publicationMode === 'cw1' ? 'pubModeCw1' : 'pubModeDirect')}{' '}
          {customerName && t('publishVisibleTo', { customer: customerName })}
        </span>
      </div>
    </div>
  );
}
