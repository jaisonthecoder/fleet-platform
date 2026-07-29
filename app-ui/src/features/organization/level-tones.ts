/**
 * Shared per-level colour tone so a level's identity colour is identical in the
 * hierarchy-level strip and the organisation tree badge. Cycles for any number
 * of levels (N-level safe).
 */
export interface LevelTone {
  /** Solid bar/fill (e.g. card top edge). */
  bar: string
  /** Foreground text/icon colour. */
  text: string
  /** Soft tinted background (badges, icon tiles). */
  soft: string
}

const TONES: LevelTone[] = [
  { bar: 'bg-brand', text: 'text-brand', soft: 'bg-brand/10' },
  { bar: 'bg-success', text: 'text-success', soft: 'bg-success/10' },
  { bar: 'bg-signal', text: 'text-signal', soft: 'bg-signal/10' },
  { bar: 'bg-info', text: 'text-info', soft: 'bg-info/10' },
]

/** Returns the colour tone for a zero-based level index (wraps for deep trees). */
export function levelTone(index: number): LevelTone {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length]
}
