import type { TFunction } from 'i18next';

/**
 * What the two quotation listings agree on.
 *
 * The customer's list and the branch's list draw the same row from opposite
 * sides of the desk: same pipeline segments, same cargo caption, same validity
 * wording. Only the actions and the internal columns differ. This is that shared
 * part, in `shared/` rather than in either feature, because a page reaching into
 * another feature's folder is how the second copy gets made.
 *
 * It holds no API types. Both lists generate their own client from the OpenAPI
 * document and pass in the pieces.
 */

/** The seven pipeline segments, in the order the band draws them. */
export const QUOTE_SEGMENTS = [
  'submitted',
  'in_progress',
  'options_ready',
  'expiring_soon',
  'accepted',
  'declined',
  'expired',
] as const;

export type QuoteSegment = (typeof QUOTE_SEGMENTS)[number];

/**
 * How far through the process a segment sits, as a share of the route track.
 *
 * Not a voyage: nothing on this screen has sailed. It is how far the quotation
 * itself has travelled, which is why "declined" and "accepted" both read as
 * finished and "submitted" barely starts.
 */
const PROGRESS: Record<QuoteSegment, number> = {
  submitted: 16,
  in_progress: 40,
  options_ready: 68,
  expiring_soon: 68,
  accepted: 100,
  declined: 100,
  expired: 80,
};

export const segmentProgress = (segment: string): number =>
  PROGRESS[segment as QuoteSegment] ?? PROGRESS.submitted;

/** The cargo parts, as the API sends them. Mirrors QuoteCargoDto. */
export interface QuoteCargo {
  units: { quantity: number; containerType: string }[];
  grossWeightKg: number | null;
  volumeM3: number | null;
  loadType: string | null;
  commodity: string | null;
}

/**
 * The quiet line under the route: what is being moved.
 *
 * Assembled here rather than in the API because it is a sentence, and a sentence
 * assembled server-side can only ever exist in one language. The order is the
 * order a forwarder reads it: how much, then of what.
 *
 *   2 × 40HC · furniture
 *   860 kg · spare parts
 *   18.4 m³ LCL · textiles
 *
 * Containers win over weight when both are known: on a full load the box count
 * is the shipment and the weight is a detail of it.
 */
export function cargoCaption(
  cargo: QuoteCargo | undefined,
  t: TFunction,
  locale: string,
): string {
  if (!cargo) return '';

  const number = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

  const measure = (() => {
    if (cargo.units.length > 0) {
      return cargo.units
        .map((unit) => t('quoteCargoUnit', { count: unit.quantity, type: unit.containerType }))
        .join(t('quoteCargoSeparator'));
    }
    if (cargo.volumeM3 !== null) {
      const volume = t('quoteCargoVolume', { volume: number(cargo.volumeM3) });
      // "18.4 m³ LCL" - the load type qualifies the measure rather than standing
      // beside it, because a cubic metre means something different on a full load.
      return cargo.loadType ? `${volume} ${cargo.loadType}` : volume;
    }
    if (cargo.grossWeightKg !== null) {
      return t('quoteCargoWeight', { weight: number(cargo.grossWeightKg) });
    }
    return '';
  })();

  return [measure, cargo.commodity].filter(Boolean).join(t('quoteCargoSeparator'));
}

/**
 * How long is left, in words.
 *
 * Three answers, and they are genuinely different things: nothing has been
 * offered, the offer has lapsed, or it runs out in so many days. Collapsing the
 * first two into one dash is what makes a customer ask whether the screen is
 * broken.
 */
export function validityLabel(days: number | null, t: TFunction): string {
  if (days === null) return t('quoteNotPriced');
  if (days <= 0) return t('quoteLapsed');
  return t('quoteDaysLeft', { count: days });
}
