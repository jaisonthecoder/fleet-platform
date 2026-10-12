import { describe, expect, it } from 'vitest';

import { clampProgress, roundPercent, scaleToTrack, TRACK_END, TRACK_START } from './measure';

describe('clampProgress', () => {
  it('floors the maximum, so an empty container never reads as full', () => {
    // <progress max="0"> is invalid; the browser substitutes 1 and paints 100%.
    expect(clampProgress(0, 0)).toMatchObject({ value: 0, max: 1, percent: 0 });
  });

  it('survives a non-finite maximum', () => {
    expect(clampProgress(5, Number.NaN)).toMatchObject({ max: 1, value: 1 });
    expect(clampProgress(5, Number.POSITIVE_INFINITY)).toMatchObject({ max: 1 });
  });

  it('survives a non-finite value', () => {
    expect(clampProgress(Number.NaN, 10)).toMatchObject({ value: 0, percent: 0 });
  });

  it('clamps at both ends', () => {
    expect(clampProgress(-4, 10).value).toBe(0);
    expect(clampProgress(40, 10).value).toBe(10);
  });

  it('reports the ratio and percent together', () => {
    expect(clampProgress(3, 4)).toMatchObject({ ratio: 0.75, percent: 75 });
  });
});

describe('scaleToTrack', () => {
  it('puts nothing outside the drawn track', () => {
    expect(scaleToTrack(0)).toBe(TRACK_START);
    expect(scaleToTrack(100)).toBe(TRACK_END);
  });

  it('keeps the ends distinguishable rather than collapsing them', () => {
    expect(scaleToTrack(1)).toBeGreaterThan(TRACK_START);
    expect(scaleToTrack(99)).toBeLessThan(TRACK_END);
  });

  it('is the single mapping, so a bar and its marker cannot disagree', () => {
    for (const value of [0, 12.5, 33, 50, 87, 100]) {
      expect(scaleToTrack(value)).toBe(scaleToTrack(value));
    }
    expect(scaleToTrack(50)).toBe(TRACK_START + (TRACK_END - TRACK_START) / 2);
  });

  it('treats rubbish as zero rather than drawing off-track', () => {
    expect(scaleToTrack(Number.NaN)).toBe(TRACK_START);
    expect(scaleToTrack(-20)).toBe(TRACK_START);
    expect(scaleToTrack(400)).toBe(TRACK_END);
  });
});

describe('roundPercent', () => {
  it('stops a screen reader announcing every digit', () => {
    expect(roundPercent(33.33333333)).toBe(33);
    expect(roundPercent(33.33333333, 1)).toBe(33.3);
  });
});
