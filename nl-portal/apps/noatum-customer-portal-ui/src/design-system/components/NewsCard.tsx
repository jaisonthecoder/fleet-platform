import type { ReactNode } from 'react';

import styles from './NewsCard.module.css';

export interface NewsCardProps {
  title: string;
  /** Plain-text excerpt. News bodies are authored content, so never pass raw HTML. */
  excerpt?: string;
  publishedAt?: Date | null;
  /** Pre-formatted date string. Supply it so the card does not guess the locale. */
  publishedLabel?: string;
  tag?: string;
  href?: string;
  onClick?: () => void;
  media?: ReactNode;
}

/**
 * A news item on the dashboard.
 *
 * Renders as an anchor when `href` is given and a button when `onClick` is, so keyboard
 * and middle-click behaviour match what the card actually does.
 */
export function NewsCard({
  title,
  excerpt,
  publishedAt,
  publishedLabel,
  tag,
  href,
  onClick,
  media,
}: NewsCardProps) {
  const body = (
    <>
      {media && <div className={styles.media}>{media}</div>}

      <div className={styles.body}>
        <div className={styles.meta}>
          {tag && <span className={styles.tag}>{tag}</span>}
          {(publishedLabel ?? publishedAt) && (
            <time dateTime={publishedAt?.toISOString()} className={styles.date}>
              {publishedLabel ?? publishedAt?.toISOString().slice(0, 10)}
            </time>
          )}
        </div>

        <h3 className={styles.title}>{title}</h3>
        {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
      </div>
    </>
  );

  if (href) {
    return (
      <a className={[styles.card, styles.interactive].join(' ')} href={href}>
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={[styles.card, styles.interactive].join(' ')}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return <article className={styles.card}>{body}</article>;
}
