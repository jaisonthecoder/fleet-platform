/**
 * The one live-region contract every loader in the kit uses.
 *
 * Three mistakes kept recurring and this exists to make them impossible:
 *
 * 1. A `role="status"` nested inside another `role="status"`, which announces
 *    twice. A loader that composes another passes `announce: false`.
 * 2. An `aria-label` on an element that also renders that same text, which
 *    overrides the visible label (WCAG 2.5.3). When the label is on screen the
 *    attribute is not set at all.
 * 3. Wrapping a whole card in the live region, so every prop change
 *    re-announces everything. Only the status line is the region.
 */

export interface BusyOptions {
  /** What is happening, e.g. "Asking 14 carriers for space on this lane". */
  label: string;
  /** The label is rendered on screen, so it must not also become an attribute. */
  labelIsVisible?: boolean;
  /** False when an ancestor already announces this wait. */
  announce?: boolean;
  /** Errors and failures interrupt; ordinary waits do not. */
  assertive?: boolean;
}

export interface BusyAttributes {
  role?: 'status' | 'alert';
  'aria-live'?: 'polite' | 'assertive';
  'aria-label'?: string;
  'aria-busy'?: true;
}

export function busyAttributes({
  label,
  labelIsVisible = false,
  announce = true,
  assertive = false,
}: BusyOptions): BusyAttributes {
  if (!announce) return {};
  return {
    role: assertive ? 'alert' : 'status',
    'aria-live': assertive ? 'assertive' : 'polite',
    'aria-busy': true,
    ...(labelIsVisible ? {} : { 'aria-label': label }),
  };
}
