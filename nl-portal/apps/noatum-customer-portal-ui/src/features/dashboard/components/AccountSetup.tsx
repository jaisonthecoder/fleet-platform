import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

import type { AccountSetupStep } from '../api/overview';
import styles from './AccountSetup.module.css';

/** Where each step sends the customer. Routes, so they stay with the router. */
const STEP_HREF: Record<AccountSetupStep['id'], string> = {
  profile: '/app/account',
  users: '/app/team',
  addresses: '/app/team',
  alerts: '/app/account',
  quote: '/app/quotations/new',
};

export interface AccountSetupProps {
  steps: readonly AccountSetupStep[];
  onGo: (href: string) => void;
  /** Lets the page place the card - its own row, a column, a sidebar. */
  className?: string;
}

/**
 * The five things that make the portal useful on day one.
 *
 * Each step carries `trackable` from the API, and it matters: a step the
 * platform cannot yet observe is offered without a state, rather than drawn as
 * outstanding. Marking "add your addresses" as not done when there is no
 * address book to look at would be inventing a fact about the customer.
 *
 * So the ring and the percentage count only the steps we can actually see.
 */
export function AccountSetup({ steps, onGo, className }: AccountSetupProps) {
  const { t } = useTranslation();

  const tracked = steps.filter((step) => step.trackable);
  const done = tracked.filter((step) => step.done).length;
  const percent = tracked.length === 0 ? 0 : Math.round((done / tracked.length) * 100);

  return (
    <section className={[styles.card, className ?? ''].filter(Boolean).join(' ')} aria-labelledby="setup-title">
      <header className={styles.head}>
        <div className={styles.lede}>
          <h2 id="setup-title" className={styles.title}>{t('setupTitle')}</h2>
          <p className={styles.note}>
            {done === tracked.length
              ? t('setupNoteDone')
              : t('setupNoteLeft', { count: tracked.length - done })}
          </p>
        </div>
        <div className={styles.progress}>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ inlineSize: `${percent}%` }} />
          </span>
          <span className={styles.percent}>{t('setupPercent', { percent })}</span>
        </div>
      </header>

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.id} className={styles.step} data-done={step.done ? 'true' : undefined}>
            <div className={styles.stepHead}>
              <span className={styles.badge} aria-hidden="true">
                {step.done ? <Check className={styles.tick} /> : index + 1}
              </span>
              <span className={styles.tag} data-state={step.done ? 'done' : step.trackable ? 'todo' : 'untracked'}>
                {step.done ? t('setupDone') : step.trackable ? t('setupTodo') : t('setupWhenReady')}
              </span>
            </div>
            <h3 className={styles.stepTitle}>{t(`setupStep_${step.id}`)}</h3>
            <p className={styles.stepNote}>{t(`setupStepNote_${step.id}`)}</p>
            <button
              type="button"
              className={styles.stepAction}
              onClick={() => onGo(STEP_HREF[step.id])}
            >
              {t(`setupStepCta_${step.id}`)} <span aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
