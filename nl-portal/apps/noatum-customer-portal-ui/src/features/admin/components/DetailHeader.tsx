import type { ReactNode } from 'react';

import { Breadcrumb, type BreadcrumbItem } from '../../../shared/components/Breadcrumb';
import styles from './DetailHeader.module.css';

export interface DetailHeaderProps {
  /** Top level first, this record last. The last step is the current page. */
  breadcrumb: BreadcrumbItem[];
  title: string;
  status?: ReactNode;
  /** Dot-separated identity line. Empty entries are dropped, so callers can pass nullables. */
  meta?: (string | null | undefined)[];
  actions?: ReactNode;
}

/**
 * The standing head of every administration detail page: breadcrumb, title with the
 * brand rule, and one identity line instead of facts scattered down the page.
 */
export function DetailHeader({ breadcrumb, title, status, meta, actions }: DetailHeaderProps) {
  const trail = (meta ?? []).filter((entry): entry is string => Boolean(entry && entry.trim()));

  return (
    <header className={styles.header}>
      <Breadcrumb items={breadcrumb} />

      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {status}
      </div>

      {trail.length > 0 ? (
        <p className={styles.meta}>
          {trail.map((entry, index) => (
            <span key={entry}>
              {index > 0 ? <span className={styles.dot} aria-hidden>·</span> : null}
              {entry}
            </span>
          ))}
        </p>
      ) : null}

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
