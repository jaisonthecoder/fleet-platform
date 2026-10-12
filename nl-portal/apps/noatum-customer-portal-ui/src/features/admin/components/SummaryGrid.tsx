import type { ReactNode } from 'react';

import styles from './SummaryGrid.module.css';

export interface SummaryFact {
  label: string;
  value: ReactNode;
  /** One short line explaining what the value means, or where it comes from. */
  hint?: string;
  mono?: boolean;
}

/** The overview ribbon: labelled facts in a grid, so nothing has to be hunted for. */
export function SummaryGrid({ facts, columns = 3 }: { facts: SummaryFact[]; columns?: 2 | 3 | 4 }) {
  return (
    <dl className={styles.grid} data-columns={columns}>
      {facts.map((fact) => (
        <div key={fact.label} className={styles.fact}>
          <dt className={styles.label}>{fact.label}</dt>
          <dd className={fact.mono ? styles.valueMono : styles.value}>{fact.value}</dd>
          {fact.hint ? <dd className={styles.hint}>{fact.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
