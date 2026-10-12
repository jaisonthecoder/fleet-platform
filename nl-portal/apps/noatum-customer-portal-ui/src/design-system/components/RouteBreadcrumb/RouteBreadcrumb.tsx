import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Home } from 'lucide-react';

import { cn } from '../../utils';
import styles from './RouteBreadcrumb.module.css';

export interface RouteBreadcrumbStep {
  id: string;
  label: ReactNode;
  /** Omit on the current step, which is never a link. */
  href?: string;
  onNavigate?: () => void;
}

export interface RouteBreadcrumbProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  /** Names the trail, e.g. "Breadcrumb". */
  label: string;
  /** Where the house icon goes. */
  homeHref: string;
  /** Names the house icon, e.g. "Dashboard". */
  homeLabel: string;
  onHomeNavigate?: () => void;
  steps: readonly RouteBreadcrumbStep[];
  /** `dark` sits on a hero band, `light` on the page ground. */
  tone?: 'dark' | 'light';
}

/**
 * CH-04 · Breadcrumb, route line.
 *
 * The trail drawn as a journey: a house, hairline connectors, an open ring for
 * each place passed through and a filled marker on where you are. It reads as a
 * route because that is what a freight customer is already looking at all day.
 *
 * The last step is the current page and carries `aria-current`, so the marker
 * and the tint are never the only signal.
 */
export const RouteBreadcrumb = forwardRef<HTMLElement, RouteBreadcrumbProps>(
  function RouteBreadcrumb(
    { label, homeHref, homeLabel, onHomeNavigate, steps, tone = 'dark', className, ...rest },
    ref,
  ) {
    const last = steps.length - 1;

    return (
      <nav
        ref={ref}
        aria-label={label}
        data-tone={tone}
        className={cn(styles.trail, className)}
        {...rest}
      >
        <a
          className={styles.home}
          href={homeHref}
          aria-label={homeLabel}
          onClick={(event) => {
            if (!onHomeNavigate) return;
            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
              event.preventDefault();
              onHomeNavigate();
            }
          }}
        >
          <Home aria-hidden="true" className={styles.homeIcon} />
        </a>

        {steps.map((step, index) => {
          const current = index === last;
          return (
            <span key={step.id} className={styles.segment}>
              <span className={styles.link} aria-hidden="true" />
              {current || !step.href ? (
                <span className={styles.step} data-current={current ? 'true' : undefined} aria-current={current ? 'page' : undefined}>
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.label}>{step.label}</span>
                </span>
              ) : (
                <a
                  className={styles.step}
                  href={step.href}
                  onClick={(event) => {
                    if (!step.onNavigate) return;
                    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
                      event.preventDefault();
                      step.onNavigate();
                    }
                  }}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.label}>{step.label}</span>
                </a>
              )}
            </span>
          );
        })}
      </nav>
    );
  },
);
