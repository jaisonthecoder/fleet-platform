import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../design-system';
import { formatMoney } from '../money';
import { optionTotal, type DraftOption } from './OptionEditor';
import styles from './CustomerPreview.module.css';

interface Props {
  option: DraftOption | undefined;
  /** Which option is open, for the header. */
  number: number;
  originCode: string;
  destinationCode: string;
  /** quotations.disclose - whether the customer is told who carries it. */
  disclosesCarrier: boolean;
}

/**
 * What the customer will see.
 *
 * Built from the same draft the pricer is editing, so it moves as they type. It
 * deliberately shows LESS than the editor: no cost, no margin, and no carrier
 * unless the disclose setting is on for this branch. A pricer who cannot see
 * what they are about to send is a pricer who sends the wrong thing.
 */
export function CustomerPreview({
  option, number, originCode, destinationCode, disclosesCarrier,
}: Props) {
  const { t } = useTranslation('staff');

  const priced = option && option.lines.some((line) => line.description.trim() !== '');
  const transit = option
    ? [option.transitDaysMin, option.transitDaysMax].filter(Boolean).join('–')
    : '';

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>{t('customerPreview')}</span>
        <span className={styles.which}>{t('previewWhich', { number })}</span>
      </div>

      <div className={styles.body}>
        {!option || !priced ? (
          <p className={styles.empty}>{t('previewEmpty')}</p>
        ) : (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.name}>
                {option.name.trim() || t('optionNumber', { number })}
              </span>
              <span className={styles.total}>
                {formatMoney(optionTotal(option), option.currency)}
              </span>
            </div>

            <p className={styles.carrier}>
              {/* Not a blank when withheld: "disclosed on booking" is an answer,
                  an empty line looks like we forgot. */}
              {[
                disclosesCarrier ? option.carrierName.trim() : t('previewCarrierHidden'),
                option.serviceRouting.trim(),
              ].filter(Boolean).join(' · ') || t('previewNoService')}
            </p>

            <div className={styles.lane}>
              <span className={styles.port}>{originCode}</span>
              <span className={styles.line}>
                {transit && (
                  <span className={styles.transit}>{t('previewTransitDays', { range: transit })}</span>
                )}
              </span>
              <span className={styles.port}>{destinationCode}</span>
            </div>

            <ul className={styles.chips}>
              {option.freeTimeDays && (
                <li data-good="true">{t('previewFreeTimeDays', { days: option.freeTimeDays })}</li>
              )}
              {option.validUntil && (
                <li>{t('previewValidTo', { date: formatDate(option.validUntil) })}</li>
              )}
              {option.termsPayment.trim() && <li>{option.termsPayment}</li>}
            </ul>

            {option.termsExcluded.trim() && (
              <p className={styles.excluded}>{option.termsExcluded}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
