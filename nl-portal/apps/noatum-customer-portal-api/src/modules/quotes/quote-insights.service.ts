import { Injectable } from '@nestjs/common';

import { TenantRepository } from '../../common/tenancy/tenant.repository';
import {
  QUOTE_INSIGHT_SAMPLED,
  type QuoteInsightRateLaneDto,
  type QuoteInsightRecentDto,
  type QuoteInsightReuseDto,
  type QuoteInsightSpeedModeDto,
  type QuoteInsightWaitingDto,
  type QuoteInsightsDto,
} from '../../contracts';

const CURRENCY = 'EUR';
const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

/** Statuses that mean "still with us". */
const IN_PROGRESS = ['requested', 'claimed', 'priced', 'approved'] as const;

/**
 * What the quotations landing page says about this customer's quoting.
 *
 * Read, not generated, wherever the platform holds the answer — which here is
 * most of it. Time to price is a real median over `publishedAt - createdAt`;
 * the funnel is real counts; the waiting cards, the recent list and the lanes
 * worth repeating are real rows.
 *
 * Four figures are generated and say so through `sampled`: the saving against
 * market spot, the contract-versus-spot chart, the instant share, and the booked
 * step of the funnel. The first three need a rate store and a market feed that
 * v4 rule 1 says do not exist; the fourth needs a bookings table that has not
 * been built. Generating them quietly would put four invented numbers beside a
 * dozen real ones with nothing to tell them apart.
 */
@Injectable()
export class QuoteInsightsService {
  constructor(private readonly repo: TenantRepository) {}

  async insights(): Promise<QuoteInsightsDto> {
    return this.repo.run(async (tx) => {
      const now = new Date();
      const yearAgo = new Date(now.getTime() - 365 * DAY);
      const weekAhead = new Date(now.getTime() + 7 * DAY);

      const [open, live, expiring, accepted, priced, pricedTimes, recentRows, reuseRows, lapsed] =
        await Promise.all([
          tx.quote.count({ where: { status: { in: [...IN_PROGRESS] } } }),
          // Published and still holding: the ones with something to read.
          tx.quote.findMany({
            where: {
              status: 'published',
              OR: [{ validUntil: null }, { validUntil: { gte: now } }],
            },
            orderBy: [{ validUntil: 'asc' }, { publishedAt: 'desc' }],
            take: 6,
            include: { options: { select: { totalMinorUnits: true, currency: true } } },
          }),
          tx.quote.count({
            where: { status: 'published', validUntil: { gte: now, lte: weekAhead } },
          }),
          tx.quote.count({ where: { status: 'accepted', decidedAt: { gte: yearAgo } } }),
          tx.quote.count({ where: { publishedAt: { gte: yearAgo } } }),
          // Every priced quote's turnaround, for the medians.
          tx.quote.findMany({
            where: { publishedAt: { not: null }, createdAt: { gte: yearAgo } },
            select: { createdAt: true, publishedAt: true, mode: true, loadType: true },
          }),
          tx.quote.findMany({
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: {
              id: true,
              reference: true,
              originCode: true,
              destinationCode: true,
              mode: true,
              loadType: true,
              status: true,
              createdAt: true,
              validUntil: true,
              decidedAt: true,
              publishedAt: true,
              totalMinorUnits: true,
              currency: true,
            },
          }),
          // Lanes worth asking for again: settled requests, newest first.
          tx.quote.findMany({
            where: { status: { in: ['accepted', 'published', 'expired'] } },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              originCode: true,
              destinationCode: true,
              mode: true,
              loadType: true,
              status: true,
              decidedAt: true,
              publishedAt: true,
            },
          }),
          tx.quote.count({ where: { status: 'expired' } }),
        ]);

      const requested = await tx.quote.count({ where: { createdAt: { gte: yearAgo } } });

      /* ── the three real medians ─────────────────────────────────────────── */

      const hoursOf = (rows: { createdAt: Date; publishedAt: Date | null }[]) => {
        const values = rows
          .filter((row) => row.publishedAt)
          .map((row) => (row.publishedAt!.getTime() - row.createdAt.getTime()) / HOUR)
          .filter((value) => value >= 0)
          .sort((a, b) => a - b);
        if (values.length === 0) return null;
        const middle = Math.floor(values.length / 2);
        const median =
          values.length % 2 === 0 ? (values[middle - 1]! + values[middle]!) / 2 : values[middle]!;
        return Number(median.toFixed(1));
      };

      const speed: QuoteInsightSpeedModeDto[] = [
        { key: 'sea_fcl', match: (r: { mode: string; loadType: string | null }) => r.mode === 'sea' && r.loadType === 'FCL' },
        { key: 'sea_lcl', match: (r: { mode: string; loadType: string | null }) => r.mode === 'sea' && r.loadType !== 'FCL' },
        { key: 'air', match: (r: { mode: string; loadType: string | null }) => r.mode === 'air' },
        { key: 'road', match: (r: { mode: string; loadType: string | null }) => r.mode === 'road' },
        { key: 'rail', match: (r: { mode: string; loadType: string | null }) => r.mode === 'rail' },
      ].map((entry) => ({
        key: entry.key,
        hours: hoursOf(pricedTimes.filter(entry.match)),
        // SAMPLED: nothing is answered without a person today.
        instant: false,
      }));

      /* ── what is waiting, as cards ──────────────────────────────────────── */

      const cargoOf = (mode: string, loadType: string | null) =>
        [mode === 'sea' ? 'Sea' : mode === 'air' ? 'Air' : mode === 'road' ? 'Road' : 'Rail', loadType]
          .filter(Boolean)
          .join(' ');

      const daysTo = (date: Date | null) =>
        date ? Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY)) : null;

      const waiting: QuoteInsightWaitingDto[] = live.slice(0, 3).map((quote) => {
        const cheapest = quote.options
          .map((option) => Number(option.totalMinorUnits ?? 0))
          .filter((value) => value > 0)
          .sort((a, b) => a - b)[0];
        const left = daysTo(quote.validUntil);
        const soon = left !== null && left <= 5;

        return {
          id: quote.id,
          reference: quote.reference,
          originCode: quote.originCode,
          destinationCode: quote.destinationCode,
          summary: [
            cargoOf(quote.mode, quote.loadType),
            quote.options.length > 0 ? `${quote.options.length} options` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          state: soon ? ('expiring' as const) : ('options_ready' as const),
          badge: left === null ? 'Options ready' : soon ? `Expires in ${left} days` : 'Options ready',
          fromMinorUnits: cheapest ?? null,
          currency: quote.currency ?? CURRENCY,
          validUntil: quote.validUntil?.toISOString() ?? null,
          daysLeft: left,
          deskName: null,
        };
      });

      // Then whatever is still with the pricing desk, to fill the row.
      if (waiting.length < 3) {
        const withDesk = await tx.quote.findMany({
          where: { status: { in: [...IN_PROGRESS] } },
          orderBy: { createdAt: 'asc' },
          take: 3 - waiting.length,
          select: {
            id: true,
            reference: true,
            originCode: true,
            destinationCode: true,
            mode: true,
            loadType: true,
          },
        });
        waiting.push(
          ...withDesk.map((quote) => ({
            id: quote.id,
            reference: quote.reference,
            originCode: quote.originCode,
            destinationCode: quote.destinationCode,
            summary: cargoOf(quote.mode, quote.loadType),
            state: 'with_desk' as const,
            badge: 'With pricing desk',
            fromMinorUnits: null,
            currency: null,
            validUntil: null,
            daysLeft: null,
            deskName: null,
          })),
        );
      }

      /* ── the funnel ─────────────────────────────────────────────────────── */

      const share = (of: number, from: number) => (from === 0 ? null : Math.round((of / from) * 100));
      const funnel = [
        { key: 'requested', count: requested, movePercent: null },
        { key: 'priced', count: priced, movePercent: share(priced, requested) },
        { key: 'accepted', count: accepted, movePercent: share(accepted, priced) },
        // SAMPLED: there is no bookings table to count.
        { key: 'booked', count: null, movePercent: null },
      ];

      /* ── the recent list ────────────────────────────────────────────────── */

      const recent: QuoteInsightRecentDto[] = recentRows.map((quote) => ({
        id: quote.id,
        reference: quote.reference,
        originCode: quote.originCode,
        destinationCode: quote.destinationCode,
        mode: cargoOf(quote.mode, quote.loadType),
        sentAt: quote.createdAt.toISOString(),
        status: quote.status,
        priceMinorUnits: quote.totalMinorUnits === null ? null : Number(quote.totalMinorUnits),
        currency: quote.currency,
        next: nextFor(quote.status, quote.validUntil, quote.decidedAt),
      }));

      const reuse: QuoteInsightReuseDto[] = reuseRows.map((quote) => ({
        id: quote.id,
        originCode: quote.originCode,
        destinationCode: quote.destinationCode,
        mode: quote.mode,
        summary: cargoOf(quote.mode, quote.loadType),
        outcome: quote.status === 'accepted' ? 'Accepted' : quote.status === 'expired' ? 'Lapsed' : 'Quoted',
      }));

      return {
        asOf: now.toISOString(),
        currency: CURRENCY,
        sampled: [...QUOTE_INSIGHT_SAMPLED],
        kpis: {
          openRequests: open,
          withOptionsReady: live.length,
          expiringThisWeek: expiring,
          expiringReference: live[0]?.validUntil ? live[0].reference : null,
          expiringOn: live[0]?.validUntil?.toISOString() ?? null,
          accepted,
          priced,
          medianHoursToPrice: hoursOf(pricedTimes),
          // SAMPLED, both of them. No rate store, no market feed.
          instantPercent: 0,
          savedVsSpotMinorUnits: 0,
        },
        waiting,
        funnel,
        funnelNote:
          lapsed > 0
            ? `${lapsed} ${lapsed === 1 ? 'quotation has' : 'quotations have'} lapsed without a decision.`
            : null,
        rateLanes: rateLanes(live, now),
        speed,
        recent,
        reuse,
      };
    });
  }
}

/** What happens next on a quotation, in the words the listing uses. */
function nextFor(status: string, validUntil: Date | null, decidedAt: Date | null): string {
  // DD.MM.YYYY, the brand's only date form. ISO here would be the one place in
  // the product a customer is shown a date in a developer's format.
  const date = (value: Date) =>
    `${String(value.getUTCDate()).padStart(2, '0')}.${String(value.getUTCMonth() + 1).padStart(2, '0')}.${value.getUTCFullYear()}`;
  if (status === 'accepted') return decidedAt ? `Accepted ${date(decidedAt)}` : 'Accepted';
  if (status === 'rejected') return decidedAt ? `Declined ${date(decidedAt)}` : 'Declined';
  if (status === 'expired') return validUntil ? `Lapsed ${date(validUntil)}` : 'Lapsed';
  if (status === 'published') return validUntil ? `Decide by ${date(validUntil)}` : 'Waiting on you';
  return 'With the pricing desk';
}

/**
 * SAMPLED. Contract against market spot.
 *
 * There is no rate store and no market feed — v4 rule 1, confirmed at director
 * level. This draws the shape the panel is for on the customer's own live lanes,
 * so the page can be reviewed, and `sampled` tells the screen to mark it.
 *
 * Deliberately derived from a real published price where there is one, so the
 * contract line at least starts from a figure this customer was actually given.
 */
function rateLanes(
  live: { originCode: string; destinationCode: string; loadType: string | null; totalMinorUnits: bigint | null }[],
  now: Date,
): QuoteInsightRateLaneDto[] {
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
    return date.toISOString().slice(0, 10);
  });

  return live.slice(0, 3).map((quote, laneIndex) => {
    const base = Number(quote.totalMinorUnits ?? 0) || 250_000;
    // A contract rate barely moves; spot swings with the season, which is the
    // whole point the panel exists to make.
    const points = months.map((month, index) => {
      const season = Math.sin(((index + laneIndex * 3) / 12) * Math.PI * 2);
      return {
        month,
        contractMinorUnits: Math.round(base * (1 + season * 0.015)),
        spotMinorUnits: Math.round(base * (1.12 + Math.max(0, season) * 0.34)),
      };
    });
    const saving = Math.round(
      (1 -
        points.reduce((sum, point) => sum + point.contractMinorUnits, 0) /
          Math.max(1, points.reduce((sum, point) => sum + point.spotMinorUnits, 0))) *
        100,
    );

    return {
      key: `${quote.originCode}-${quote.destinationCode}`,
      label: `${quote.originCode} to ${quote.destinationCode}`,
      basis: quote.loadType ?? 'Shipment',
      currency: CURRENCY,
      points,
      savingPercent: saving,
    };
  });
}
