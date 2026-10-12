import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';
import { formatDate } from '../../../design-system';
import { formatMoney } from '../../pricing/money';
import type { CustomerQuoteOption } from '../api/quotes';
import styles from './OptionDetail.module.css';

interface Props {
  option: CustomerQuoteOption;
  index: number;
  count: number;
  reference: string;
  currency: string | null;
  /** Already resolved: the carrier, or "disclosed on booking". */
  carrier: string;
  transit: string | null;
  canDecide: boolean;
  busy: boolean;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onDownload: () => void;
}

/**
 * One option, in full.
 *
 * Everything the card shows, plus the terms and the service detail that would
 * not fit on it. It opens beside the comparison rather than replacing it,
 * because reading one option is a step inside choosing between them.
 */
export function OptionDetail({
  option, index, count, reference, currency, carrier, transit,
  canDecide, busy, onClose, onAccept, onReject, onDownload,
}: Props) {
  const { t } = useTranslation();

  // Escape closes it, like every other sheet in the product.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // "transit 28–34 days" reads right beside the carrier on a card; under a row
  // labelled "Transit" it says the word twice.
  const transitPlain = (() => {
    const range = [option.transitDaysMin, option.transitDaysMax].filter((value) => value !== null);
    return range.length === 0 ? null : t('optDaysRange', { range: [...new Set(range)].join('–') });
  })();

  const total = formatMoney(option.totalMinorUnits, option.currency ?? currency);
  const validUntil = option.validUntil ? formatDate(option.validUntil) : '—';

  const facts = [
    [t('optCompare_carrier'), carrier],
    [t('optCompare_routing'), option.serviceRouting],
    [t('optCompare_transit'), transitPlain],
    [t('optCompare_departures'), option.nextDepartures],
    [
      t('optCompare_freeTime'),
      option.freeTimeDays === null ? null : t('optFreeDays', { days: option.freeTimeDays }),
    ],
    [t('optCompare_validUntil'), validUntil],
    [t('optQuotation'), t('optVersionCurrent', { reference, number: 1 })],
  ] as const;

  return (
    <>
      <button type="button" className={styles.scrim} aria-label={t('close')} onClick={onClose} />

      <aside className={styles.sheet} role="dialog" aria-modal="true" aria-label={option.name ?? reference}>
        <div className={styles.head}>
          <div>
            <p className={styles.eyebrow}>
              {t('optDetailEyebrow', { reference, number: index + 1, count })}
            </p>
            <h2 className={styles.name}>
              {option.name ?? t('optUnnamed', { number: index + 1 })}
            </h2>
            <p className={styles.sub}>{[carrier, transit].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" className={styles.close} aria-label={t('close')} onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <div className={`${styles.card} ${styles.totalCard}`}>
            <div>
              <div className={styles.label}>{t('optTotalPerShipment')}</div>
              <div className={styles.total}>{total}</div>
            </div>
            <div className={styles.validity}>
              <div className={styles.label}>{t('optCompare_validUntil')}</div>
              <div className={styles.validityValue}>{validUntil}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.label}>{t('optService')}</span>
            </div>
            <dl className={styles.facts}>
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.label}>{t('optCharges')}</span>
              <span className={styles.cardNote}>{t('optChargesNote')}</span>
            </div>
            <ul className={styles.lines}>
              {option.chargeLines.map((line) => (
                <li key={line.id}>
                  <span>{line.description}</span>
                  <strong>{formatMoney(line.amountMinorUnits, line.currency ?? currency)}</strong>
                </li>
              ))}
              <li className={styles.linesTotal}>
                <span>{t('optTotal')}</span>
                <strong>{total}</strong>
              </li>
            </ul>
          </div>

          {(option.termsIncluded || option.termsExcluded) && (
            <div className={`${styles.card} ${styles.terms}`}>
              <div>
                <div className={`${styles.label} ${styles.termsIncluded}`}>{t('optIncluded')}</div>
                <p className={styles.termsBody}>{option.termsIncluded ?? '—'}</p>
              </div>
              <div>
                <div className={`${styles.label} ${styles.termsExcluded}`}>{t('optNotIncluded')}</div>
                <p className={styles.termsBody}>{option.termsExcluded ?? '—'}</p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.foot}>
          {/* Waiting on a document renderer. Here because the drawer is laid out
              around it; pressing it says so rather than doing nothing. */}
          <button type="button" className={styles.download} onClick={onDownload}>
            <Download size={13} aria-hidden="true" />
            {t('optDownloadThis', { number: index + 1 })}
          </button>

          {canDecide && (
            <span className={styles.footActions}>
            <button type="button" className={styles.reject} disabled={busy} onClick={onReject}>
              {t('optReject')}
            </button>
            <button
              type="button" className={styles.accept}
              disabled={busy || option.isExpired} onClick={onAccept}
            >
              {t('optAcceptThis')}
            </button>
            </span>
          )}
        </div>
      </aside>
    </>
  );
}
