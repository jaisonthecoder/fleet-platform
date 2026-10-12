import type { TransportMode } from '../enums';

/**
 * Port for CO2 estimation.
 *
 * DEFERRED SCOPE, signature only. OQ-20 has not settled the methodology, the provider or
 * the disclaimer, and publishing a number without those is a claim we cannot stand behind.
 * The port exists so that the decision, when it comes, is one new file.
 *
 * The result carries `methodology`, `providerVersion` and `confidence` because an emissions
 * figure is automated output: the human-in-the-loop rule requires provenance stored with
 * it, and a human able to override it with a reason while the original is kept.
 */
export abstract class EmissionsAdapter {
  abstract estimate(request: EmissionsRequest): Promise<EmissionsResult>;

  /** True when a real provider is configured, so a screen can say so honestly. */
  abstract isConfigured(): boolean;
}

export interface EmissionsRequest {
  mode: TransportMode;
  originCode: string;
  destinationCode: string;
  grossWeightKg: number;
  volumeM3?: number;
  /** Set when estimating for an existing shipment rather than a hypothetical lane. */
  shipmentRef?: string;
}

export interface EmissionsResult {
  /** Grams as minor units, matching the money rule: an exact integer, never a float. */
  co2eGrams: bigint;
  distanceKm: number | null;
  /** e.g. `GLEC v3`. Stored with the figure; never displayed without it. */
  methodology: string;
  providerVersion: string;
  confidence: 'low' | 'medium' | 'high' | null;
  calculatedAt: Date;
}
