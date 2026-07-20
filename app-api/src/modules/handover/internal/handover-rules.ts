/** Advisory fuel reconciliation outcome (never blocking — FR-HAND-05/06). */
export interface FuelReconciliation {
  distanceKm: number;
  expectedLitres: number | null;
  actualLitres: number | null;
  deviationPercent: number | null;
  flagged: boolean;
}

/**
 * Reconciles expected vs observed fuel use. Expected litres come from the
 * odometer delta and the vehicle's efficiency; observed litres are supplied
 * (measured at refuel). The deviation is **advisory** and only computed when
 * both sides are known; the flag trips when it exceeds the PDP threshold. Pure.
 */
export function reconcileFuel(input: {
  startOdometer: number;
  endOdometer: number;
  efficiencyKmpl: number | null;
  observedLitres: number | null;
  thresholdPercent: number;
}): FuelReconciliation {
  const distanceKm = Math.max(0, input.endOdometer - input.startOdometer);
  const expectedLitres =
    input.efficiencyKmpl && input.efficiencyKmpl > 0 ? distanceKm / input.efficiencyKmpl : null;
  const actualLitres = input.observedLitres ?? null;
  let deviationPercent: number | null = null;
  let flagged = false;
  if (expectedLitres !== null && expectedLitres > 0 && actualLitres !== null) {
    deviationPercent = (Math.abs(actualLitres - expectedLitres) / expectedLitres) * 100;
    flagged = deviationPercent > input.thresholdPercent;
  }
  return { distanceKm, expectedLitres, actualLitres, deviationPercent, flagged };
}

/** Default odometer-conflict tolerance (km) — a data-quality epsilon, not a policy value. */
export const ODOMETER_CONFLICT_TOLERANCE_KM = 5;

/**
 * True when a manual odometer disagrees with the telematics system of record
 * beyond tolerance (FR-HAND-11). Telematics is authoritative and is never
 * overwritten; this only raises a data-quality flag. A null telematics reading
 * (no device data yet) is not a conflict.
 */
export function isOdometerConflict(
  manual: number,
  telematics: number | null,
  toleranceKm: number = ODOMETER_CONFLICT_TOLERANCE_KM,
): boolean {
  if (telematics === null) {
    return false;
  }
  return Math.abs(manual - telematics) > toleranceKm;
}

/** True when the actual return is after the booked return window (feeds behaviour scoring). */
export function isLateReturn(returnedAt: Date, bookedReturnAt: Date): boolean {
  return returnedAt.getTime() > bookedReturnAt.getTime();
}

/** Parses a numeric DB string to a number, or null. */
export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}
