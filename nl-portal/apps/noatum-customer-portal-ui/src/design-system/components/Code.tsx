import type { ReactNode } from 'react';

import styles from './Code.module.css';

export interface CodeProps {
  children: ReactNode;
  /**
   * `strong` when the identifier is the subject of the row - an organisation
   * code, a shipment reference. `muted` when it supports a name above it, such
   * as a slug under a customer or a mapping under a branch.
   */
  tone?: 'strong' | 'muted';
  className?: string;
}

/**
 * A system identifier.
 *
 * Before this existed, eight class names across five stylesheets set the same
 * kind of string, and they disagreed: half reached for a token that resolved to
 * the sans face, so CargoWise codes rendered proportional on four screens and
 * monospaced on two. Use this and the question never comes up again.
 */
export function Code({ children, tone = 'strong', className }: CodeProps) {
  return (
    <span className={[styles.code, styles[tone], className ?? ''].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
