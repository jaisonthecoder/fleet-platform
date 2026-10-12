import type { Prisma } from '@prisma/client';

import { TRANSPORT_MODES } from '../../contracts';

/**
 * The advanced filters both quotation listings offer.
 *
 * Shared so the customer's drawer and the branch's drawer cannot come to mean
 * different things: "Sea, requested in September" has to select the same set of
 * quotes whichever side of the desk asks for it.
 *
 * Every value arrives from a query string, so every value is treated as a
 * suggestion: an unknown mode and an unparseable date are ignored rather than
 * refused. A filter the caller cannot see and cannot clear must never be able to
 * empty the list.
 */
export interface QuoteFilterParams {
  mode?: string;
  /** ISO date, inclusive. Anything not a date is ignored. */
  requestedFrom?: string;
  /** ISO date, inclusive - the whole of that day, not midnight at its start. */
  requestedTo?: string;
}

const isMode = (value: string): boolean => (TRANSPORT_MODES as readonly string[]).includes(value);

/** A calendar date at the start of its day, UTC. Null for anything else. */
function startOfDay(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function quoteFilterWhere(params: QuoteFilterParams): Prisma.QuoteWhereInput[] {
  const clauses: Prisma.QuoteWhereInput[] = [];

  if (params.mode && isMode(params.mode)) {
    clauses.push({ mode: params.mode as Prisma.QuoteWhereInput['mode'] });
  }

  const from = startOfDay(params.requestedFrom);
  const to = startOfDay(params.requestedTo);

  if (from || to) {
    clauses.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        // "to 30.09" means through the end of the 30th. Using midnight would
        // silently drop everything raised on the day the reader asked about.
        ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}),
      },
    });
  }

  return clauses;
}
