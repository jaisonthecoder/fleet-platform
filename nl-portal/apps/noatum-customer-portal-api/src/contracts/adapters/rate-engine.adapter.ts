import type { TransportMode } from '../enums';

export interface RateRequest {
  mode: TransportMode;
  originCode: string;
  destinationCode: string;
  grossWeightKg: number;
  chargeableKg: number;
  volumeM3?: number;
  currency: string;
  /** CW1 organisation code of the account the quote is for. */
  cw1OrgCode: string;
}

export interface RateLine {
  code: string;
  description: string;
  /** Minor units, e.g. cents. Never a float. */
  amountMinorUnits: bigint;
  currency: string;
}

export interface RateResult {
  lines: RateLine[];
  totalMinorUnits: bigint;
  currency: string;
  validUntil: Date;
  /** The provider response verbatim, stored on the quote for audit. */
  raw: unknown;
}

/**
 * Port for the rating provider.
 *
 * Rating is synchronous by design: the user is waiting on the screen, and a stale rate
 * is worse than a slow one. Timeouts surface as a `rate_failed` quote the user can
 * retry, not as a 500.
 *
 * Implemented by Cw1RateAdapter in src/integration/cw1, and by a stub in tests.
 * Feature code depends on this interface only - never on XML or HTTP details.
 *
 * No rate source is configured, and on director-level evidence of 17.09.2026 none exists
 * to configure. The port stays as the seam behind `quotations.instant_rate`; nothing may
 * assume a price returns automatically.
 */
export abstract class RateEngineAdapter {
  /** False while no rate source is configured, which today is always. Every other
   * port reports this, and a caller should not have to special-case one of them. */
  abstract isConfigured(): boolean;

  abstract rate(request: RateRequest): Promise<RateResult>;
}
