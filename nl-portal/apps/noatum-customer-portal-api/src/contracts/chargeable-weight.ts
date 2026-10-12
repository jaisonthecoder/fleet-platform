import type { TransportMode } from './enums';

/**
 * Volumetric divisors, in kg per cubic metre.
 *
 * These are commercial terms, not physics. They live here so the SPA preview and the
 * rate request can never disagree - a customer seeing one number on screen and another
 * on the quote is a support call every time.
 */
export const VOLUMETRIC_DIVISORS: Record<TransportMode, number> = {
  // IATA volumetric weight: 1 m3 = 166.67 kg.
  air: 166.67,
  // Sea LCL is charged on revenue tons: 1 m3 = 1000 kg.
  sea: 1000,
  road: 333,
  rail: 333,
};

export interface ChargeableWeightInput {
  mode: TransportMode;
  grossWeightKg: number;
  /** Total volume in cubic metres. Omit when only actual weight is known. */
  volumeM3?: number;
}

/**
 * The single implementation of chargeable weight. Do not re-derive it anywhere else.
 *
 * Chargeable weight is the greater of actual gross weight and volumetric weight,
 * rounded up to three decimal places to match what the rate engine expects.
 */
export function chargeableWeight({
  mode,
  grossWeightKg,
  volumeM3,
}: ChargeableWeightInput): number {
  if (!Number.isFinite(grossWeightKg) || grossWeightKg < 0) {
    throw new RangeError(`grossWeightKg must be a non-negative number, received ${grossWeightKg}`);
  }
  if (volumeM3 !== undefined && (!Number.isFinite(volumeM3) || volumeM3 < 0)) {
    throw new RangeError(`volumeM3 must be a non-negative number, received ${volumeM3}`);
  }

  const volumetric = volumeM3 === undefined ? 0 : volumeM3 * VOLUMETRIC_DIVISORS[mode];

  return roundUpTo3(Math.max(grossWeightKg, volumetric));
}

/** Round half-up at three decimals, avoiding the usual float surprises. */
function roundUpTo3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
