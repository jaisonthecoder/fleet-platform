import type { QuoteCargoDto } from '../../contracts';

/**
 * The cargo caption for a listing row, in parts.
 *
 * Both quotation lists show one quiet line under the route - "2 x 40HC ·
 * furniture", "860 kg · spare parts", "18.4 m³ LCL · textiles". What goes in it
 * depends on how the request was made, not on who is looking, so the selection
 * happens once here and the browser does the wording.
 *
 * Nothing is formatted. A string assembled in the API can only be assembled in
 * one language, and every string on these screens has to exist in Spanish too.
 */

/** The `include` the builder needs. Kept beside it so a caller cannot forget one. */
export const CARGO_SELECT = {
  loadType: true,
  grossWeightKg: true,
  volumeM3: true,
  payload: true,
  equipment: { select: { quantity: true, containerType: true, position: true } },
} as const;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cargoFor(row: {
  loadType: string | null;
  grossWeightKg: unknown;
  volumeM3: unknown;
  payload: unknown;
  equipment?: { quantity: number; containerType: string; position?: number }[];
}): QuoteCargoDto {
  const payload = (row.payload ?? {}) as Record<string, unknown>;

  return {
    units: [...(row.equipment ?? [])]
      .sort((first, second) => (first.position ?? 0) - (second.position ?? 0))
      .map((unit) => ({ quantity: unit.quantity, containerType: unit.containerType })),
    grossWeightKg: toNumber(row.grossWeightKg),
    volumeM3: toNumber(row.volumeM3),
    loadType: row.loadType,
    // Captured with the request and never rewritten, so it is the customer's own
    // word for what is in the box - which is what makes the line worth showing.
    commodity: typeof payload.commodity === 'string' && payload.commodity ? payload.commodity : null,
  };
}
