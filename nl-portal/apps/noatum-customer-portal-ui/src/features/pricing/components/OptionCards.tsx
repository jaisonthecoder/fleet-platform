import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMoney } from '../money';
import { optionTotal, type DraftOption } from './OptionEditor';
import styles from './OptionCards.module.css';

interface Props {
  options: DraftOption[];
  open: number;
  onOpen: (index: number) => void;
}

/**
 * The option cards.
 *
 * One option is edited at a time. Stacking every editor down the page made two
 * options twice as long to read and three of them unnavigable, and it hid the
 * thing that actually matters when there are several — how they compare. The
 * cards carry that comparison: price, carrier, transit and free time side by
 * side, with the open one marked.
 */
export function OptionCards({ options, open, onOpen }: Props) {
  const { t } = useTranslation('staff');

  return (
    <>
      <div className={styles.strip}>
        <button
          type="button"
          className={styles.arrow}
          aria-label={t('optionPrevious')}
          disabled={open === 0}
          onClick={() => onOpen(open - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>

        <div className={styles.cards}>
          {options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              className={styles.card}
              data-open={index === open ? 'true' : undefined}
              aria-current={index === open ? 'true' : undefined}
              onClick={() => onOpen(index)}
            >
              <span className={styles.cardHead}>
                <span className={styles.number}>{t('optionNumber', { number: index + 1 })}</span>
                {option.isRecommended && (
                  <span className={styles.recommended}>{t('optionRecommended')}</span>
                )}
              </span>
              <span className={styles.name}>
                {option.name.trim() === '' ? t('optionUnnamed') : option.name}
              </span>
              <span className={styles.meta}>
                {[
                  option.carrierName.trim() || null,
                  option.transitDaysMin || option.transitDaysMax
                    ? t('optionTransitShort', {
                        min: option.transitDaysMin || option.transitDaysMax,
                        max: option.transitDaysMax || option.transitDaysMin,
                      })
                    : null,
                  option.freeTimeDays ? t('optionFreeShort', { days: option.freeTimeDays }) : null,
                ].filter(Boolean).join(' · ') || t('optionNothingYet')}
              </span>
              <span className={styles.total}>
                {formatMoney(optionTotal(option), option.currency)}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.arrow}
          aria-label={t('optionNext')}
          disabled={open >= options.length - 1}
          onClick={() => onOpen(open + 1)}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Only worth drawing once there is a choice to make. */}
      {options.length > 1 && (
        <ul className={styles.dots}>
          {options.map((option, index) => (
            <li key={option.key}>
              <button
                type="button"
                className={styles.dot}
                data-open={index === open ? 'true' : undefined}
                aria-label={t('optionNumber', { number: index + 1 })}
                onClick={() => onOpen(index)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
