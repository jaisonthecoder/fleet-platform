import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { formatDate } from '../../../design-system';
import { optionTotal, type DraftOption } from './OptionEditor';
import styles from './SendChecks.module.css';

/**
 * A check is either met or not, and either stops the send or does not.
 *
 * `blocking` is not our opinion: those are the things the API itself refuses, or
 * that would reach the customer plainly broken - a quote that expired yesterday,
 * a price with no lines. Everything else is advice a pricer may knowingly ignore,
 * and the panel says which is which rather than colouring them the same.
 */
export interface Check {
  key: string;
  met: boolean;
  blocking: boolean;
  /** The detail line: what was found, in this quote's own numbers. */
  note: string;
}

interface Args {
  options: DraftOption[];
  /** The draft differs from what was last saved. */
  dirty: boolean;
  /** quotations.disclose - whether the customer is told who carries it. */
  disclosesCarrier: boolean;
  message: string;
  needsApproval: boolean;
  approved: boolean;
}

/** Today at midnight, so a quote valid until today still counts as valid. */
function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export function useChecks({
  options, dirty, disclosesCarrier, message, needsApproval, approved,
}: Args): Check[] {
  const { t } = useTranslation('staff');
  const today = startOfToday();

  // A line needs both halves: a description with no rate prices nothing, and a
  // rate with no description is a number the customer cannot question.
  const unpriced = options.filter(
    (option) => !option.lines.some((line) => line.description.trim() !== '') || optionTotal(option) === 0,
  );

  const expired = options.filter(
    (option) => option.validUntil === '' || new Date(option.validUntil).getTime() < today,
  );
  const earliest = options
    .map((option) => option.validUntil)
    .filter((date) => date !== '')
    .sort()[0];

  const unnamedCarrier = options.filter((option) => option.carrierName.trim() === '');
  const noTransit = options.filter(
    (option) => option.transitDaysMin === '' && option.transitDaysMax === '',
  );

  return [
    {
      key: 'priced',
      met: unpriced.length === 0,
      blocking: true,
      note: unpriced.length === 0
        ? t('checkNote_pricedOk', { count: options.length })
        : t('checkNote_pricedMissing', { count: unpriced.length }),
    },
    {
      key: 'validity',
      met: expired.length === 0,
      blocking: true,
      // `earliest` always exists when nothing has expired: every option then
      // carries a date, and the soonest of them is what the customer is held to.
      note: expired.length > 0 || earliest === undefined
        ? t('checkNote_validityMissing', { count: expired.length })
        : t('checkNote_validityOk', { date: formatDate(earliest) }),
    },
    {
      key: 'saved',
      met: !dirty,
      blocking: true,
      note: dirty ? t('checkNote_savedNo') : t('checkNote_savedYes'),
    },
    {
      key: 'approval',
      met: !needsApproval || approved,
      blocking: true,
      note: !needsApproval
        ? t('checkNote_approvalNotNeeded')
        : approved
          ? t('checkNote_approvalGiven')
          : t('checkNote_approvalWaiting'),
    },
    {
      // Several prices with nothing marked leaves the customer to guess what we
      // would do. One option needs no recommendation - it is the recommendation.
      key: 'recommended',
      met: options.length < 2 || options.some((option) => option.isRecommended),
      blocking: false,
      note: options.length < 2
        ? t('checkNote_recommendedSingle')
        : options.some((option) => option.isRecommended)
          ? t('checkNote_recommendedSet', {
              name: options.find((option) => option.isRecommended)?.name.trim()
                || t('optionUnnamed'),
            })
          : t('checkNote_recommendedNone', { count: options.length }),
    },
    {
      key: 'transit',
      met: noTransit.length === 0,
      blocking: false,
      note: noTransit.length === 0 ? t('checkNote_transitOk') : t('checkNote_transitMissing', { count: noTransit.length }),
    },
    {
      // Only when the customer will actually see it. Where the carrier is withheld,
      // an empty field is the correct state, not an omission.
      key: 'carrier',
      met: !disclosesCarrier || unnamedCarrier.length === 0,
      blocking: false,
      note: !disclosesCarrier
        ? t('checkNote_carrierHidden')
        : unnamedCarrier.length === 0
          ? t('checkNote_carrierOk')
          : t('checkNote_carrierMissing', { count: unnamedCarrier.length }),
    },
    {
      key: 'message',
      met: message.trim() !== '',
      blocking: false,
      note: message.trim() === ''
        ? t('checkNote_messageNone')
        : t('checkNote_messageLength', { count: message.trim().length }),
    },
  ];
}

/**
 * Checks before sending.
 *
 * Pricing is done in one long sitting and sent at the end, and what goes wrong is
 * never the arithmetic - it is the validity date left on last month, the second
 * option nobody marked, the carrier the customer was promised and never told. The
 * panel states all of it at once, before the publish dialog rather than inside it,
 * because a dialog that lists problems has already asked too late.
 */
export function SendChecks({ checks, muted }: { checks: Check[]; muted?: boolean }) {
  const { t } = useTranslation('staff');
  const open = checks.filter((check) => !check.met);

  return (
    <div className={styles.panel} data-muted={muted ? 'true' : undefined}>
      <div className={styles.head}>
        <span className={styles.title}>{t('checksTitle')}</span>
        <span className={styles.count} role="status">
          {open.length === 0 ? t('checksAllDone') : t('checksOpen', { count: open.length })}
        </span>
      </div>

      <ul className={styles.list}>
        {checks.map((check) => (
          <li
            key={check.key}
            className={styles.row}
            data-met={check.met ? 'true' : 'false'}
            data-blocking={check.blocking ? 'true' : 'false'}
          >
            <span className={styles.dot} aria-hidden="true">
              {check.met && <Check size={9} strokeWidth={3.6} />}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{t(`check_${check.key}`)}</span>
              <span className={styles.note}>
                {!check.met && (
                  <span className={styles.state}>
                    {check.blocking ? t('checkNeeded') : t('checkSuggested')}
                  </span>
                )}
                {check.note}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
