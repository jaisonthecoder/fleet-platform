import type { ReactNode } from 'react';

import styles from './Footer.module.css';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterProps {
  /** Already localised and year-substituted by the caller. */
  copyright: string;
  links?: FooterLink[];
  /** Build or release identifier - useful when a customer reports an issue. */
  version?: string;
  children?: ReactNode;
}

export function Footer({ copyright, links = [], version, children }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.copyright}>{copyright}</span>

        {links.length > 0 && (
          <nav className={styles.links} aria-label="Footer">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.link}
                // noreferrer alongside noopener: no referrer leakage to third parties.
                {...(link.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {children}

        {version && <span className={styles.version}>{version}</span>}
      </div>
    </footer>
  );
}
