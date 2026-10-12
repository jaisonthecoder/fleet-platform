/**
 * Measurement helpers shared by the kit's charts, meters and loaders.
 *
 * Every proportional component in the kit answers the same two questions —
 * "how full is this?" and "where along the track does that sit?" — and each one
 * used to answer them itself. Three separate clamps existed, all of which
 * floored the value and none of which floored the maximum, so a zero or NaN
 * maximum rendered as full. Two SVG mappings existed inside single components,
 * so a bar and its marker disagreed at every value.
 *
 * These are internal: they are not exported from the design system's public
 * barrel, because a consumer should reach for a component, not the maths.
 */

/** A value and the maximum it is measured against, both known good. */
export interface Measure {
  /** Clamped to 0…max, always finite. */
  value: number;
  /** At least 1, always finite. */
  max: number;
  /** value / max, 0…1. */
  ratio: number;
  /** ratio as 0…100. */
  percent: number;
}

const finite = (input: unknown, fallback: number): number =>
  typeof input === 'number' && Number.isFinite(input) ? input : fallback;

/**
 * Makes a value and maximum safe to render.
 *
 * `<progress max="0">` is invalid, so the browser silently substitutes 1 and
 * paints a full bar — an empty container that reads as completely full. A NaN
 * maximum blanks the element entirely. Both are flattened here so no component
 * has to remember.
 */
export function clampProgress(value: number, max: number): Measure {
  const safeMax = Math.max(1, finite(max, 1));
  const safeValue = Math.min(safeMax, Math.max(0, finite(value, 0)));
  const ratio = safeValue / safeMax;
  return { value: safeValue, max: safeMax, ratio, percent: ratio * 100 };
}

/** The kit draws its route tracks between these two x coordinates. */
export const TRACK_START = 2;
export const TRACK_END = 98;

/**
 * Maps 0…100 onto the drawn track.
 *
 * Writing a percentage straight into an SVG `x2` looks right in the middle and
 * wrong at both ends: 0–2% and 98–100% collapse into the cap, and at 0 the
 * "done" line starts to the left of the track it is meant to sit on. Anything
 * that positions itself along a route — the line, the marker, a call along a
 * rotation — goes through here, so they cannot drift apart.
 */
export function scaleToTrack(percent: number): number {
  const { ratio } = clampProgress(finite(percent, 0), 100);
  return TRACK_START + ratio * (TRACK_END - TRACK_START);
}

/**
 * Rounds for display and for an accessible name.
 *
 * `RingGauge` announced "Fill: 33.33333333%". A screen reader reads every one
 * of those digits.
 */
export function roundPercent(percent: number, fractionDigits = 0): number {
  const factor = 10 ** fractionDigits;
  return Math.round(finite(percent, 0) * factor) / factor;
}
