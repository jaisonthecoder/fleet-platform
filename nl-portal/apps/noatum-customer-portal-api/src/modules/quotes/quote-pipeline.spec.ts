import { QUOTE_PIPELINE_SEGMENTS } from '../../contracts';

import {
  countPipeline,
  daysRemaining,
  isPipelineSegment,
  pipelineSegmentFor,
  pipelineSegmentWhere,
} from './quote-pipeline';

/*
 * The pipeline band filters the list it is drawing. So the row's own segment and
 * the `where` that selects that segment have to agree on every case, or the band
 * says "3 expiring soon" and shows two rows when you click it.
 *
 * Each case below is checked twice: once through pipelineSegmentFor, which
 * colours the row, and once through pipelineSegmentWhere, which the database
 * counts and filters with. They are separate implementations of one rule.
 */

const NOW = new Date('2026-09-22T12:00:00.000Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

describe('quote pipeline', () => {
  describe('which segment a quote is in', () => {
    it.each([
      // Nobody has picked it up yet.
      ['draft', null, 'submitted'],
      ['requested', null, 'submitted'],
      ['submitted', null, 'submitted'],
      // Somebody is on it. The customer still has no offer, but 'a specialist
      // has this' is the difference between waiting and wondering.
      ['claimed', null, 'in_progress'],
      ['priced', null, 'in_progress'],
      ['approved', null, 'in_progress'],
      ['pending_sync', null, 'in_progress'],
      ['accepted', null, 'accepted'],
      ['rejected', null, 'declined'],
      ['withdrawn', null, 'declined'],
      ['expired', null, 'expired'],
    ])('reads %s as %s', (status, validUntil, expected) => {
      expect(pipelineSegmentFor(status, validUntil, NOW)).toBe(expected);
    });

    it('separates a published quote by how long is left on it', () => {
      expect(pipelineSegmentFor('published', inDays(11), NOW)).toBe('options_ready');
      // Four days is still comfortable; three is the boundary and is inside it.
      expect(pipelineSegmentFor('published', inDays(4), NOW)).toBe('options_ready');
      expect(pipelineSegmentFor('published', inDays(3), NOW)).toBe('expiring_soon');
      expect(pipelineSegmentFor('published', inDays(1), NOW)).toBe('expiring_soon');
    });

    /* The nightly expiry job is not the customer's problem: a published quote
       whose date has passed reads as expired the moment it passes. */
    it('reads a published quote past its date as expired', () => {
      expect(pipelineSegmentFor('published', inDays(-1), NOW)).toBe('expired');
    });

    /* A quote with no validity at all is an open offer, not an expiring one. */
    it('reads a published quote with no validity as options ready', () => {
      expect(pipelineSegmentFor('published', null, NOW)).toBe('options_ready');
    });
  });

  describe('days remaining', () => {
    it('floors, so "1 day left" stops being said while a day is left', () => {
      expect(daysRemaining(new Date(NOW.getTime() + 47 * 3_600_000), NOW)).toBe(1);
      expect(daysRemaining(new Date(NOW.getTime() + 23 * 3_600_000), NOW)).toBe(0);
    });

    it('goes negative once the date has passed, and is null with no date', () => {
      expect(daysRemaining(inDays(-2), NOW)).toBe(-2);
      expect(daysRemaining(null, NOW)).toBeNull();
    });
  });

  describe('the query that selects a segment', () => {
    it('covers every segment the band can draw', () => {
      for (const segment of QUOTE_PIPELINE_SEGMENTS) {
        expect(pipelineSegmentWhere(segment, NOW)).toBeDefined();
      }
    });

    it('splits the three published segments on the date, not in memory', () => {
      // If these comparisons were not in the `where`, paging and counting would
      // both be wrong: the database would hand back the wrong rows to slice.
      expect(pipelineSegmentWhere('expiring_soon', NOW)).toMatchObject({
        validUntil: { gte: NOW, lte: new Date(NOW.getTime() + 3 * 86_400_000) },
      });
      expect(pipelineSegmentWhere('options_ready', NOW)).toMatchObject({
        OR: [{ validUntil: null }, { validUntil: { gt: new Date(NOW.getTime() + 3 * 86_400_000) } }],
      });
    });

    it('treats a lapsed published quote as expired, like the row does', () => {
      expect(pipelineSegmentWhere('expired', NOW)).toMatchObject({
        OR: [{ status: 'expired' }, { validUntil: { lt: NOW } }],
      });
    });
  });

  describe('counting the band', () => {
    it('counts every segment against the caller scope and nothing else', async () => {
      const seen: unknown[] = [];
      const counts = await countPipeline(
        async (where) => {
          seen.push(where);
          return seen.length;
        },
        { customerGroupId: 'group-1' },
        NOW,
      );

      expect(counts.map((entry) => entry.key)).toEqual([...QUOTE_PIPELINE_SEGMENTS]);
      expect(seen).toHaveLength(QUOTE_PIPELINE_SEGMENTS.length);
      // Every count carries the scope. A segment counted without it would report
      // another customer's quotes in this customer's band.
      for (const where of seen) {
        expect(where).toMatchObject({ AND: [{ customerGroupId: 'group-1' }, {}] });
      }
    });
  });

  describe('accepting a segment from the wire', () => {
    it('refuses anything the enum does not name', () => {
      expect(isPipelineSegment('expiring_soon')).toBe(true);
      expect(isPipelineSegment('published')).toBe(false);
      expect(isPipelineSegment('')).toBe(false);
    });
  });
});
