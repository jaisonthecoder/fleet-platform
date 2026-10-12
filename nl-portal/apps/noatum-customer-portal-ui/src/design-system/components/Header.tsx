import type { ReactNode } from 'react';

import styles from './Header.module.css';

export interface HeaderProps {
  /** Brand mark. Keep it an <img> or inline SVG the app supplies. */
  logo: ReactNode;
  productName?: string;
  /**
   * Primary navigation links. The header supplies the <nav> landmark, so pass
   * the links themselves — wrapping them in a second <nav> gives the page two
   * navigation landmarks with the same contents.
   */
  nav?: ReactNode;
  /** Names that landmark. Translated by the caller. */
  navLabel?: string;
  /** Account menu, locale switcher, notifications. */
  actions?: ReactNode;
  /**
   * Impersonation banner. When set, the header shows a persistent, unmissable strip -
   * a Noatum user acting as a customer must never forget they are doing so, and the
   * customer must be able to see it in a screenshot.
   */
  impersonationNotice?: ReactNode;
  /**
   * `measure` keeps the row inside the brand container; `full` lets it run to
   * both edges. A public marketing surface wants the full width so the brand
   * bar spans the viewport rather than floating in the middle of it.
   */
  width?: 'measure' | 'full';
}

export function Header({
  logo,
  productName,
  nav,
  navLabel = 'Main',
  actions,
  impersonationNotice,
  width = 'measure',
}: HeaderProps) {

  return (
    <>
      {impersonationNotice && (
        <div className={styles.impersonation} role="status">
          {impersonationNotice}
        </div>
      )}

      <header className={styles.header}>
        <div className={`${styles.inner} ${width === 'full' ? styles.full : ''}`.trim()}>
          <div className={styles.brand}>
            {logo}
            {productName && <span className={styles.productName}>{productName}</span>}
          </div>

          {nav && (
            <nav className={styles.nav} aria-label={navLabel}>
              {nav}
            </nav>
          )}

          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
    </>
  );
}
