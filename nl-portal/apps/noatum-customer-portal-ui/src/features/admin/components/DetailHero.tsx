import type { ReactNode } from 'react';

import { Breadcrumb, type BreadcrumbItem } from '../../../shared/components/Breadcrumb';
import styles from './DetailHero.module.css';

export interface HeroColumn {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  /** Supporting detail under the value, one muted line each. */
  lines?: (string | null | undefined)[];
}

export interface DetailHeroProps {
  /** Top level first, this record last. The last step is the current page. */
  breadcrumb: BreadcrumbItem[];
  eyebrow?: string;
  /** The page identity and its current state live here, never in a second header. */
  title: string;
  status?: ReactNode;
  subline?: string;
  chips?: (string | null | undefined)[];
  columns: HeroColumn[];
  actions?: ReactNode;
  footnote?: string;
}

/**
 * The dark identity band that opens a detail page: the headline fact on the left,
 * supporting facts in columns, actions pinned right. It replaces the habit of
 * scattering the same facts through half a dozen stacked panels.
 */
export function DetailHero({ breadcrumb, eyebrow, title, status, subline, chips, columns, actions, footnote }: DetailHeroProps) {
  const tags = (chips ?? []).filter((chip): chip is string => Boolean(chip && chip.trim()));

  return (
    <section className={styles.hero}>
      <Breadcrumb tone="hero" className={styles.breadcrumb} items={breadcrumb} />

      <div className={styles.content}>
        <div className={styles.lead}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <div className={styles.titleRow}>
            <h1 className={styles.headline}>{title}</h1>
            {status}
          </div>
          {subline ? <p className={styles.subline}>{subline}</p> : null}
          {tags.length > 0 ? (
            <ul className={styles.chips}>
              {tags.map((chip) => <li key={chip} className={styles.chip}>{chip}</li>)}
            </ul>
          ) : null}
        </div>

        <dl className={styles.columns}>
          {columns.map((column) => (
            <div key={column.label} className={styles.column}>
              {column.icon ? <span className={styles.columnIcon} aria-hidden="true">{column.icon}</span> : null}
              <div className={styles.columnBody}>
                <dt className={styles.label}>{column.label}</dt>
                <dd className={styles.value}>{column.value}</dd>
                {(column.lines ?? [])
                  .filter((line): line is string => Boolean(line && line.trim()))
                  .map((line) => <dd key={line} className={styles.line}>{line}</dd>)}
              </div>
            </div>
          ))}
        </dl>

        {actions || footnote ? (
          <div className={styles.actions}>
            {actions}
            {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
