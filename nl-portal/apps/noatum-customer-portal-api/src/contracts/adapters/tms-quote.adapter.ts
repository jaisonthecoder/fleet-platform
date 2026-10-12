import type { TransportMode } from '../enums';
import type {
  CurrencyCode,
  TmsFetchResult,
  TmsPage,
  TmsSubmissionReceipt,
  TmsSyncStatus,
  TmsTenantScope,
} from './tms-common';

/**
 * Port for the quotation round trip with the TMS.
 *
 * Shaped by the director's direction of 17.09.2026: the organisation has no rate database,
 * no rate storage, no standard format and no standardised quoting process. So this port
 * carries a request out and an opaque human answer back. It models no tariff, no charge
 * code and no approval chain, because there is nothing to model them against.
 *
 * A price line is free text plus an amount, deliberately. See
 * docs/plans/Quotation-Module-Phase-Plan.md §7 before adding structure here.
 *
 * NOT IMPLEMENTED. Phases Q4 and Q5. Both directions run as queued jobs; nothing calls
 * this inline.
 */
export abstract class TmsQuoteAdapter {
  /** False while no transport is configured. The caller records the intent and carries
   * on; the quote's own state never depends on this. */
  abstract isConfigured(): boolean;

  /** Copy of the customer's request, so whoever prices it can see it. */
  abstract createRequest(request: TmsQuoteRequest): Promise<TmsSubmissionReceipt>;

  /** The customer amended the request before it was answered. */
  abstract updateRequest(request: TmsQuoteRequest): Promise<TmsSubmissionReceipt>;

  /** Withdrawn before it was answered. */
  abstract cancelRequest(reference: string, reason: string | null): Promise<TmsSubmissionReceipt>;

  /** A price recorded in the portal is written back. */
  abstract submitPricedQuote(quote: TmsPricedQuote): Promise<TmsSubmissionReceipt>;

  /** The customer's commercial outcome, sent onward. */
  abstract recordDecision(decision: TmsQuoteDecision): Promise<TmsSubmissionReceipt>;

  /**
   * What has CargoWise done with our copy.
   *
   * Asked for by name by the product owner: the copy we send should be
   * answerable, and while the transport is held the honest answer is that it is
   * still pending.
   */
  abstract getQuoteStatus(reference: string): Promise<TmsFetchResult<TmsQuoteSyncStatus | null>>;

  /** Pull a quote that was priced in CargoWise rather than in the portal. */
  abstract fetchQuote(
    scope: TmsTenantScope,
    reference: string,
  ): Promise<TmsFetchResult<TmsQuoteSnapshot | null>>;

  /** Catch-up poll, for a transport with no push. */
  abstract listQuotesChangedSince(
    scope: TmsTenantScope,
    since: Date,
    cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsQuoteSnapshot>>>;
}

/** CargoWise's view of a message we sent, not our own quote status. */
export type TmsQuoteSyncStatus = TmsSyncStatus;

/** A quote as CargoWise holds it, pulled inbound. */
export interface TmsQuoteSnapshot {
  reference: string;
  externalReference: string | null;
  orgCode: string;
  priced: TmsPricedQuote | null;
  status: TmsQuoteSyncStatus;
}

export interface TmsQuoteRequest {
  /** Portal reference, e.g. `Q-000042`. The customer's and our shared handle. */
  reference: string;
  /** `<reference>:v<version>` — stable across retries, new on a re-price. */
  idempotencyKey: string;
  /** Organisation code the request is filed against. Resolved server-side, never client input.
   *  Null when the customer has several organisations and named none - the far end
   *  cannot file it, and an empty string would hide that behind a value that looks real. */
  orgCode: string | null;
  mode: TransportMode;
  /** FCL, LCL, FTL, LTL. Absent for air. */
  loadType: string | null;
  /** What is being shipped. Nothing can be priced without it. */
  commodity: string | null;
  originCode: string;
  destinationCode: string;
  incoterm: string | null;
  readyDate: Date | null;
  grossWeightKg: number | null;
  volumeM3: number | null;
  chargeableKg: number | null;
  packages: TmsQuotePackage[];
  /** Containers, when the request is a full load. Alternative to `packages`. */
  equipment: TmsQuoteEquipment[];
  /**
   * Declared hazards. Carried because whoever prices this in CargoWise must see
   * them - a request copied without its hazards is a worse record than no copy.
   * This is pricing information, never a dangerous goods declaration.
   */
  dangerousGoods: TmsQuoteDangerousGoods[];
  temperatureControl: TmsQuoteTemperature | null;
  oversizeItems: TmsQuoteOversizeItem[];
  customerReference: string | null;
  serviceLevel: string | null;
  notes: string | null;
  requestedAt: Date;
}

export interface TmsQuoteEquipment {
  unitId: string;
  containerType: string;
  quantity: number;
  grossWeightPerUnitKg: number | null;
}

export interface TmsQuoteDangerousGoods {
  unNumber: string;
  hazardClass: string;
  subsidiaryRisks: string[];
  /** Nullable because the column is: rows predating the required-field rule exist
   *  and a copy that invented a name would be worse than one that admits the gap. */
  properShippingName: string | null;
  packingGroup: string | null;
  technicalName: string | null;
  flashpointCelsius: number | null;
  emsCode: string | null;
  isMarinePollutant: boolean;
  packagingType: string | null;
  unPackagingCode: string | null;
  packageCount: number | null;
  netQuantityPerPackage: number | null;
  quantityUnit: string | null;
  transportRegime: string | null;
  isInOverpack: boolean;
  /** Cargo line or container ids this applies to. */
  appliesToLines: string[];
}

export interface TmsQuoteTemperature {
  setPointCelsius: number;
  toleranceCelsius: number | null;
  ventilation: string | null;
  controlledAtmosphere: boolean;
  preCoolingRequired: boolean;
  dataLogger: string | null;
}

export interface TmsQuoteOversizeItem {
  description: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  liftingMethod: string | null;
}

export interface TmsQuotePackage {
  quantity: number;
  /** Portal package-type code, already mapped. */
  packageType: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number;
  description: string | null;
}

/**
 * A quote answer, from either direction.
 *
 * Valid with an amount, or with an attached document, or both — never with neither. That
 * rule is enforced in the quotes service, not here, because it is a business rule rather
 * than a transport concern.
 */
export interface TmsPricedQuote {
  reference: string;
  idempotencyKey: string;
  orgCode: string;
  totalMinorUnits: bigint | null;
  currency: CurrencyCode | null;
  validUntil: Date | null;
  /** Free-form. No charge codes: there is no standard format to map to. */
  lines: TmsQuotePriceLine[];
  /** What the customer reads alongside the number. */
  notes: string | null;
  /** References of documents already stored by us, for the TMS to pull or for audit. */
  documentRefs: string[];
}

export interface TmsQuotePriceLine {
  description: string;
  amountMinorUnits: bigint;
  currency: CurrencyCode;
}

export interface TmsQuoteDecision {
  reference: string;
  idempotencyKey: string;
  /** The vocabulary of the quote status machine, not a transport's own words. */
  outcome: 'accepted' | 'rejected' | 'withdrawn';
  /** Mandatory on `rejected`; the business wants to know why it lost. */
  reason: string | null;
  decidedAt: Date;
}
