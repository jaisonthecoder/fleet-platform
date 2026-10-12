import { useTranslation } from 'react-i18next';
import styles from './Journey.module.css';

/** The five stages, in the words the API uses for status. */
export const STAGES = ['requested', 'claimed', 'priced', 'approved', 'published'] as const;

export type Stage = (typeof STAGES)[number];

interface Props {
  /** Where the quote is now. Anything terminal counts every stage as reached. */
  status: string;
  /** The second line under each stage: who, when, or why it does not apply. */
  notes: Partial<Record<Stage, string>>;
}

function reached(status: string): number {
  const found = STAGES.indexOf(status as Stage);
  return found === -1 ? STAGES.length : found;
}

/**
 * The journey, as the staff mockup draws it.
 *
 * It is the one place on the screen that says what has already happened to this
 * request and who did it — a pricer opening a quote somebody else claimed needs
 * that before anything else on the page means much.
 */
export function Journey({ status, notes }: Props) {
  const { t } = useTranslation('staff');
  const here = reached(status);

  return (
    <div className={styles.card}>
      <ol className={styles.track} aria-label={t('quoteProgress')}>
        {STAGES.map((stage, index) => {
          const state = index < here ? 'done' : index === here ? 'current' : 'ahead';
          return (
            <li key={stage} className={styles.stage} data-state={state}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{t(`stage_${stage}`)}</span>
              {/* Never blank: "—" says the stage has not happened, rather than
                  leaving the reader to wonder whether something failed to load. */}
              <span className={styles.note}>{notes[stage] ?? '—'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
