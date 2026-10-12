import { describe, expect, it } from 'vitest';

import { timeAgo } from './relative-time';

/*
 * `now` is a parameter, which is the only reason these assertions can be exact.
 * A function that read the clock itself could only be tested approximately —
 * and it is the same property that lets the page drive it from a ticking clock.
 */
const NOW = Date.parse('2026-09-16T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('timeAgo', () => {
  it('picks the largest unit that fits', () => {
    expect(timeAgo(ago(38 * 60_000), 'en-GB', NOW)).toMatch(/38 min/);
    expect(timeAgo(ago(2 * 3_600_000), 'en-GB', NOW)).toMatch(/2 hr|2 hours/);
    expect(timeAgo(ago(3 * 86_400_000), 'en-GB', NOW)).toMatch(/3 days?/);
  });

  it('moves as the clock does', () => {
    const stamp = ago(60_000);
    expect(timeAgo(stamp, 'en-GB', NOW)).not.toBe(timeAgo(stamp, 'en-GB', NOW + 3_600_000));
  });

  it('handles a future timestamp, which an ETA is', () => {
    expect(timeAgo(new Date(NOW + 2 * 86_400_000).toISOString(), 'en-GB', NOW)).toMatch(/2 days?/);
  });

  it('translates rather than returning English', () => {
    expect(timeAgo(ago(38 * 60_000), 'es-ES', NOW)).not.toBe(timeAgo(ago(38 * 60_000), 'en-GB', NOW));
  });

  it('returns null for anything that is not a timestamp', () => {
    expect(timeAgo(null, 'en-GB', NOW)).toBeNull();
    expect(timeAgo(undefined, 'en-GB', NOW)).toBeNull();
    expect(timeAgo('', 'en-GB', NOW)).toBeNull();
    expect(timeAgo('not a date', 'en-GB', NOW)).toBeNull();
  });

  it('does not fall through to an empty string at the boundary', () => {
    // Under one second still has to say something.
    expect(timeAgo(ago(200), 'en-GB', NOW)).toBeTruthy();
  });
});
