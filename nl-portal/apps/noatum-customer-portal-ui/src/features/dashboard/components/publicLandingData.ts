/* ────────────────────────────────────────────────────────────────────────────
 * Page furniture for the public landing.
 *
 * What is left here is what a server would never send: icon paths and the
 * accent colours that go with them. Everything with a fact in it — the
 * counters, the reference kinds, the tracking result, the emissions figures —
 * now arrives over HTTP through `src/api/public`, so that switching to the real
 * endpoints is a configuration change rather than a rewrite.
 *
 * The sample dataset that used to live here moved to
 * `src/api/public/mock/data.ts`, behind the transport, where the page cannot
 * reach it.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Icon paths, verbatim from the design. */
export const ICON = {
  sea: 'M2 20c2 1 4 1 6-1 2 2 6 2 8 0 2 2 4 2 6 1M4 16l1-5h14l1 5M8 11V7h8v4',
  air: 'M2 14l8 1 4 7 2-1-1-7 6-3c1-1 1-2 0-3l-7 2-5-5-2 1 3 6-8 1z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  quote: 'M7 3h10l3 4v14H4V7zM4 7h16M9 12h6M12 15v-6',
  doc: 'M7 3h10l3 4v14H4V7zM4 7h16M9 13h6M9 17h4',
  bell: 'M12 4a6 6 0 0 1 6 6v4l2 3H4l2-3v-4a6 6 0 0 1 6-6zM10 20h4',
  search: 'M20 20l-3.5-3.5',
  arrow: 'M4 12h14l-4-4M14 16l4-4',
  tick: 'M5 13l4 4 10-10',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
} as const;

export const FEATURES = [
  { id: 'visibility', icon: ICON.eye, accent: 'var(--color-accent-navy)', wash: 'var(--noa-navy-050)' },
  { id: 'quote', icon: ICON.quote, accent: 'var(--color-primary)', wash: 'var(--red-050)' },
  { id: 'paperwork', icon: ICON.doc, accent: 'var(--noa-green-600)', wash: 'var(--noa-green-050)' },
  { id: 'alerts', icon: ICON.bell, accent: 'var(--noa-amber-600)', wash: 'var(--noa-amber-050)' },
] as const;

/** The coloured rail on each hero counter, by the id the API sends. */
export const STAT_RAIL: Record<string, string> = {
  tracked: 'var(--color-primary)',
  feeds: 'var(--noa-mint-400)',
  lag: 'var(--noa-amber-400)',
};
