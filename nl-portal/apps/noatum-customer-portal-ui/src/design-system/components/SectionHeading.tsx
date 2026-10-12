import type { ReactNode } from 'react';

import styles from './SectionHeading.module.css';

export interface SectionHeadingProps {
  title: string;
  description?: string;
  /** Right-aligned actions, typically a Button or two. */
  actions?: ReactNode;
  /** Heading level. Pick the one the document outline needs, not the size you want. */
  as?: 'h1' | 'h2' | 'h3';
  size?: 'sm' | 'md' | 'lg';
}

export function SectionHeading({
  title,
  description,
  actions,
  as: Tag = 'h2',
  size = 'md',
}: SectionHeadingProps) {
  return (
    <header className={styles.wrapper}>
      <div className={styles.text}>
        <Tag className={[styles.title, styles[size]].join(' ')}>{title}</Tag>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
