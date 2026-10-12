import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '../../utils';
import styles from './ListingHero.module.css';

/**
 * CH-14 · Listing hero, with the pipeline band.
 *
 * The band that opens a list page: who is looking, what they are looking at, and
 * one bar showing where everything in the list stands. The listing itself then
 * climbs into the empty foot of the band, which is what makes the two read as
 * one object.
 *
 * The band is the status filter. That is the point of it: a bar that only
 * reported would be a decoration, and the screen would still need a status
 * control somewhere else. Picking a segment dims the others rather than hiding
 * them, so the shape of the whole list stays visible while you work inside one
 * part of it.
 *
 * Every string arrives as a prop. The customer and staff listings use different
 * i18n namespaces and both use this.
 */

export interface PipelineSegment {
  /** Stable key, e.g. `expiring_soon`. Also picks the colour token. */
  key: string;
  label: string;
  count: number;
}

export interface ListingHeroProps {
  /**
   * The trail back up, drawn above everything else in the band. Pass the shared
   * `Breadcrumb` with `tone="hero"` - the band is dark and the surface variant
   * would be invisible on it.
   */
  breadcrumb?: ReactNode;
  /** e.g. "YOUR QUOTATIONS · IBERIA RETAIL GROUP SL". Upper-cased by the band. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One sentence saying what the list is and what the bar means. */
  subtitle?: ReactNode;
  /** Band-level actions: an export, and the page's primary call to action. */
  actions?: ReactNode;

  /** e.g. "YOUR PIPELINE · 10 QUOTATIONS". */
  pipelineTitle?: ReactNode;
  /** The one thing worth saying about the shape, e.g. "2 unclaimed". */
  pipelineNote?: ReactNode;
  /** Segments carrying a zero are dropped: an empty band tells you nothing. */
  segments?: PipelineSegment[];
  /** The picked segment's key, or null for "all of them". */
  activeSegment?: string | null;
  onSegmentChange?: (key: string | null) => void;
  /** Names the group for assistive technology, e.g. "Filter by state". */
  segmentsLabel?: string;
  clearLabel?: string;
  /** Announces one segment, e.g. `(n, label) => "3 options ready"`. */
  segmentTitle?: (count: number, label: string) => string;

  /** The listing, and anything else that rises into the band's foot. */
  children: ReactNode;
  /** The line under the listing explaining the whole grid. */
  footnote?: ReactNode;
}

/** The colour of a segment, from its key. Unknown keys fall back to neutral. */
const toneOf = (key: string): CSSProperties =>
  ({ '--tone': `var(--noa-pipe-${key.replaceAll('_', '-')}, var(--noa-pipe-requested))` }) as CSSProperties;

export function ListingHero({
  breadcrumb,
  eyebrow,
  title,
  subtitle,
  actions,
  pipelineTitle,
  pipelineNote,
  segments = [],
  activeSegment = null,
  onSegmentChange,
  segmentsLabel,
  clearLabel,
  segmentTitle,
  children,
  footnote,
}: ListingHeroProps) {
  /*
   * Every state, always, including the ones at zero.
   *
   * The band is a legend as much as a filter: "no quotes are expiring" is a fact
   * worth reading, and it can only be read if the chip is there to carry the
   * zero. Dropping empty states also made the legend change shape from one visit
   * to the next, so nobody could learn where to look.
   *
   * The BAR is different - a zero cannot occupy width - so it draws only the
   * states that have something in them, and the chips below carry the full set.
   */
  const occupied = segments.filter((segment) => segment.count > 0);
  const total = occupied.reduce((sum, segment) => sum + segment.count, 0);
  const filtered = activeSegment !== null;

  const pick = (key: string) => onSegmentChange?.(activeSegment === key ? null : key);

  return (
    /*
     * `data-bleed` tells a shell that pads its content area to stop padding for
     * this page: the band has to reach the rail and the window edge, and its own
     * measure is what keeps the content off them. The customer shell is already
     * full-bleed and ignores it.
     */
    <div className={styles.page} data-bleed="true">
      <section className={styles.band}>
        <div className={styles.pattern} aria-hidden="true" />

        <div className={styles.inner}>
          <div className={styles.measure}>
            {breadcrumb && <div className={styles.breadcrumb}>{breadcrumb}</div>}

            <div className={styles.headline}>
              <div className={styles.lede}>
                {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
                <h1 className={styles.title}>{title}</h1>
                {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
              </div>
              {actions && <div className={styles.actions}>{actions}</div>}
            </div>


            {segments.length > 0 && (
              <div className={cn(styles.pipeline, filtered && styles.dimmed)}>
                <div className={styles.pipelineHead}>
                  {pipelineTitle && <span className={styles.pipelineTitle}>{pipelineTitle}</span>}
                  {pipelineNote && <span className={styles.pipelineNote}>{pipelineNote}</span>}
                </div>

                {/*
                 * The bar and the chips are the same control twice over, so the
                 * bar is hidden from assistive technology and the chips below
                 * carry the labels. Announcing both would read every state out
                 * twice to anyone who cannot see that they are one row of colour.
                 */}
                <div className={styles.bar} aria-hidden="true">
                  {occupied.map((segment) => (
                    <button
                      type="button"
                      key={segment.key}
                      tabIndex={-1}
                      className={styles.segment}
                      style={{ ...toneOf(segment.key), width: `${(segment.count / total) * 100}%` }}
                      aria-pressed={activeSegment === segment.key}
                      onClick={() => pick(segment.key)}
                      title={segmentTitle?.(segment.count, segment.label)}
                    />
                  ))}
                </div>

                <div className={styles.chips} role="group" aria-label={segmentsLabel}>
                  {segments.map((segment) => {
                    // A state with nothing in it is reported, not offered: the
                    // chip still carries its colour and its zero, but filtering
                    // to it could only ever produce an empty grid.
                    const empty = segment.count === 0;
                    return (
                      <button
                        type="button"
                        key={segment.key}
                        className={styles.chip}
                        style={toneOf(segment.key)}
                        data-empty={empty ? 'true' : undefined}
                        disabled={empty}
                        aria-pressed={empty ? undefined : activeSegment === segment.key}
                        onClick={() => pick(segment.key)}
                      >
                        <span className={styles.chipMark} aria-hidden="true" />
                        <span className={styles.chipLabel}>{segment.label}</span>
                        <span className={styles.chipCount}>{segment.count}</span>
                      </button>
                    );
                  })}
                  {filtered && clearLabel && (
                    <button
                      type="button"
                      className={styles.clear}
                      // The label is the accessible name and the tooltip; the
                      // glyph is what a sighted user reads in a row of counts.
                      aria-label={clearLabel}
                      title={clearLabel}
                      onClick={() => onSegmentChange?.(null)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={styles.rise}>
        {children}
        {footnote && <p className={styles.footnote}>{footnote}</p>}
      </div>
    </div>
  );
}
