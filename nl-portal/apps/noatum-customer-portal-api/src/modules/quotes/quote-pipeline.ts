import type { Prisma } from '@prisma/client';

import {
  QUOTE_EXPIRING_SOON_DAYS,
  QUOTE_PIPELINE_SEGMENTS,
  type QuotePipelineSegment,
  type QuoteStatus,
} from '../../contracts';

/* ────────────────────────────────────────────────────────────────────────────
 * The pipeline band, in one place.
 *
 * Three of the seven segments are the same database status - `published` - told
 * apart only by where the validity date sits relative to now. That derivation
 * therefore exists exactly once: the row's own segment, the `where` that filters
 * on a segment, and the count under each chip all come from here.
 *
 * Writing it twice is how a band says "3 expiring soon" and then shows two rows
 * when you click it, which teaches a pricer not to trust the filter.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Three days out, as a moment. Everything here compares against the same clock. */
export function expirySoonCutoff(now: Date): Date {
  return new Date(now.getTime() + QUOTE_EXPIRING_SOON_DAYS * 86_400_000);
}

/**
 * Whole days until the offer lapses, floored.
 *
 * Floored rather than rounded because "1 day left" has to stop being said while
 * a day is still left. Zero or less means it has lapsed; null means nothing has
 * been published to lapse.
 */
export function daysRemaining(validUntil: Date | null, now: Date): number | null {
  if (validUntil === null) return null;
  return Math.floor((validUntil.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Which band a quote belongs to.
 *
 * A published quote whose validity has passed reads as expired even though the
 * status column still says `published`: the row is dead either way, and the
 * nightly expiry job is not the customer's problem.
 */
export function pipelineSegmentFor(
  status: QuoteStatus | string,
  validUntil: Date | null,
  now: Date,
): QuotePipelineSegment {
  switch (status) {
    case 'accepted':
      return 'accepted';
    case 'rejected':
    case 'withdrawn':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'published':
    case 'quoted':
    case 'rated': {
      if (validUntil === null) return 'options_ready';
      if (validUntil.getTime() < now.getTime()) return 'expired';
      return validUntil.getTime() <= expirySoonCutoff(now).getTime()
        ? 'expiring_soon'
        : 'options_ready';
    }
    // Somebody is on it. The customer has no offer yet either way, but "a
    // specialist has picked this up" is the difference between waiting and
    // wondering whether it arrived at all.
    case 'claimed':
    case 'priced':
    case 'approved':
    case 'pending_sync':
    case 'rate_failed':
      return 'in_progress';
    default:
      // draft, requested, submitted: we have it, nobody has started.
      return 'submitted';
  }
}

/**
 * The same seven definitions as a query.
 *
 * Returned as a `where` fragment rather than a status list, because the three
 * published segments need the date comparison to go to the database - filtering
 * them in memory would page wrongly and count wrongly.
 */
export function pipelineSegmentWhere(
  segment: QuotePipelineSegment,
  now: Date,
): Prisma.QuoteWhereInput {
  const cutoff = expirySoonCutoff(now);
  const live = ['published', 'quoted', 'rated'] as const;

  switch (segment) {
    case 'accepted':
      return { status: 'accepted' };
    case 'declined':
      return { status: { in: ['rejected', 'withdrawn'] } };
    case 'expired':
      return {
        OR: [
          { status: 'expired' },
          { status: { in: [...live] }, validUntil: { lt: now } },
        ],
      };
    case 'options_ready':
      return {
        status: { in: [...live] },
        OR: [{ validUntil: null }, { validUntil: { gt: cutoff } }],
      };
    case 'expiring_soon':
      return { status: { in: [...live] }, validUntil: { gte: now, lte: cutoff } };
    case 'in_progress':
      return {
        status: { in: ['claimed', 'priced', 'approved', 'pending_sync', 'rate_failed'] },
      };
    case 'submitted':
    default:
      return { status: { in: ['draft', 'requested', 'submitted'] } };
  }
}

export const isPipelineSegment = (value: string): value is QuotePipelineSegment =>
  (QUOTE_PIPELINE_SEGMENTS as readonly string[]).includes(value);

/**
 * Counts for the band, over whatever scope the caller already applies.
 *
 * Seven indexed counts rather than one clever pivot: `quote` is indexed on
 * (customer_group_id, status, created_at), each of these is a range scan on it,
 * and the seven run together. A `groupBy` could not express the date comparison
 * that separates the three published segments anyway.
 */
export async function countPipeline(
  count: (where: Prisma.QuoteWhereInput) => Promise<number>,
  scope: Prisma.QuoteWhereInput,
  now: Date,
): Promise<{ key: QuotePipelineSegment; count: number }[]> {
  const counts = await Promise.all(
    QUOTE_PIPELINE_SEGMENTS.map((key) =>
      count({ AND: [scope, pipelineSegmentWhere(key, now)] }),
    ),
  );

  return QUOTE_PIPELINE_SEGMENTS.map((key, index) => ({ key, count: counts[index] ?? 0 }));
}
