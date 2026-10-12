import styles from './StepRibbon.module.css';

export interface RibbonStep {
  id: string;
  label: string;
  done: boolean;
  /** Supporting line: who completed it, or why it is still outstanding. */
  note?: string | null;
}

export interface StepRibbonProps {
  steps: RibbonStep[];
  title: string;
  note?: string;
}

/**
 * The outstanding-work band. It only earns its place while something is missing,
 * so callers drop it once every step is done.
 */
export function StepRibbon({ steps, title, note }: StepRibbonProps) {
  return (
    <section className={styles.ribbon} aria-label={title}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>

      <ul className={styles.steps}>
        {steps.map((step) => (
          <li key={step.id} className={styles.step} data-done={step.done}>
            <span className={styles.marker} aria-hidden>{step.done ? '✓' : ''}</span>
            <span className={styles.body}>
              <span className={styles.label}>{step.label}</span>
              {step.note ? <span className={styles.reason}>{step.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
