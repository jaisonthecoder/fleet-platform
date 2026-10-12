import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

import styles from './Breadcrumb.module.css';

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last item — the page you are already on is not a link. */
  to?: string;
}

export interface BreadcrumbProps {
  /**
   * Top level first, current page last. The last entry is rendered as the
   * current page whether or not it carries a `to`, so a caller can pass the
   * same array it uses elsewhere without trimming it.
   */
  items: BreadcrumbItem[];
  /** `hero` for the dark identity band, `surface` for a normal page. */
  tone?: 'surface' | 'hero';
  /** Optional explicit destination for the rounded back control. */
  backTo?: string;
  className?: string;
}

/**
 * One breadcrumb for the whole product.
 *
 * There were two implementations with three different looks — one on the page
 * surface, two fighting each other inside the same hero stylesheet — and both
 * were hard-capped at parent and current page. Both also named the landmark
 * after the parent, so a screen reader announced "Customers navigation" instead
 * of a breadcrumb, and neither used a list, so the steps had no order.
 *
 * This takes any depth, marks the last step `aria-current="page"`, and hides
 * the separators from assistive technology.
 */
export function Breadcrumb({ items, tone = 'surface', backTo, className }: BreadcrumbProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const trail = items.filter((item) => item.label.trim().length > 0);
  if (trail.length === 0) return null;
  const linkedParent = [...trail.slice(0, -1)].reverse().find((item) => item.to)?.to;

  const goBack = () => {
    const target = backTo ?? linkedParent;
    if (target) navigate(target);
    else navigate(-1);
  };

  return (
    <div className={[styles.root, styles[tone], className ?? ''].filter(Boolean).join(' ')}>
      <button type="button" className={styles.back} aria-label={t('back')} title={t('back')} onClick={goBack}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <nav aria-label={t('breadcrumb')} className={styles.nav}>
        <ol className={styles.list}>
          {trail.map((item, index) => {
            const isFirst = index === 0;
            const isCurrent = index === trail.length - 1;
            const content = isFirst ? (
              <>
                <Home aria-hidden="true" />
                <span className="noa-visually-hidden">{item.label}</span>
              </>
            ) : item.label;
            return (
              <Fragment key={`${item.label}-${index}`}>
                {!isFirst && <span aria-hidden="true" className={styles.connector} />}
                <li className={styles.item}>
                  {isCurrent || !item.to ? (
                    <span
                      className={[styles.label, isFirst ? styles.start : '', isCurrent ? styles.current : ''].filter(Boolean).join(' ')}
                      aria-current={isCurrent ? 'page' : undefined}
                      title={item.label}
                    >
                      {content}
                    </span>
                  ) : (
                    <Link to={item.to} className={[styles.label, isFirst ? styles.start : ''].filter(Boolean).join(' ')} title={item.label}>
                      {content}
                    </Link>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
