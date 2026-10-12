import type { TransportMode } from '../enums';
import type { TmsFetchResult, TmsPage, TmsSyncStatus, TmsTenantScope } from './tms-common';

/**
 * Port for shipment visibility: shipments, consols, containers and milestone events.
 *
 * These are the portal's shapes, not CargoWise's. A status or event that arrives as a
 * source code is translated through the `mapping_*` tables before it reaches this
 * interface — no CW1 code ever appears in a field typed here.
 *
 * Tenancy note: every read takes a `TmsTenantScope` the caller resolved from the portal
 * tenant. The shipment family is Pattern B — visibility comes from `shipment_visibility`,
 * not from a `customer_group_id` column — so the scope is the only boundary this port has.
 *
 * NOT IMPLEMENTED. Phase 2. The port exists so that business code written against it can
 * never bind to a CargoWise class, and so an implementation is a new file rather than a
 * refactor.
 */
export abstract class TmsTrackingAdapter {
  /** False when `CW1_TRANSPORT_TRACKING=none`, which the design treats as a first-class
   * state: the portal stays usable with no CargoWise connection at all. */
  abstract isConfigured(): boolean;

  abstract listShipments(
    scope: TmsTenantScope,
    query?: TmsShipmentQuery,
  ): Promise<TmsPage<TmsShipmentSummary>>;

  /** Null when the reference is unknown *or* outside the scope. The caller cannot tell the
   * difference, which is deliberate: a 404 must not confirm that a shipment exists. */
  abstract getShipment(scope: TmsTenantScope, shipmentRef: string): Promise<TmsShipmentDetail | null>;

  abstract listMilestones(scope: TmsTenantScope, shipmentRef: string): Promise<TmsMilestoneEvent[]>;

  abstract listContainers(scope: TmsTenantScope, shipmentRef: string): Promise<TmsContainerUnit[]>;

  abstract listConsols(scope: TmsTenantScope, query?: TmsConsolQuery): Promise<TmsPage<TmsConsol>>;

  /** Null when unknown or out of scope. A sea shipment's master bill lives here, not on the
   * shipment, which is why this read exists separately. */
  abstract getConsol(scope: TmsTenantScope, consolRef: string): Promise<TmsConsol | null>;

  /**
   * Catch-up poll for a transport with no push.
   *
   * Events rather than shipments: a shipment whose only change is a new milestone
   * would not appear in a shipment-level diff, and that milestone is the whole
   * point of tracking.
   */
  abstract listEventsChangedSince(
    scope: TmsTenantScope,
    since: Date,
    cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsMilestoneEvent>>>;

  /** Whether we are actually in touch with the source for this shipment. */
  abstract getShipmentStatus(shipmentRef: string): Promise<TmsFetchResult<TmsSyncStatus | null>>;
}

export interface TmsShipmentQuery {
  mode?: TransportMode;
  originCode?: string;
  destinationCode?: string;
  /** Inclusive lower bound on ETD. */
  etdFrom?: Date;
  /** Inclusive upper bound on ETA. */
  etaTo?: Date;
  cursor?: string;
  limit?: number;
}

export interface TmsShipmentSummary {
  /** The source system's shipment identifier. Opaque to us. */
  shipmentRef: string;
  /** Null when the source message does not carry it. Never guessed from the lane. */
  mode: TransportMode | null;
  houseBill: string | null;
  masterBill: string | null;
  originCode: string | null;
  destinationCode: string | null;
  etd: Date | null;
  eta: Date | null;
  /** Portal status vocabulary, already mapped. Null when the source code is unmapped. */
  status: string | null;
  /** Which organisation codes this shipment reached us under, for visibility linking. */
  orgCodes: string[];
}

export interface TmsShipmentDetail extends TmsShipmentSummary {
  consolRef: string | null;
  legs: TmsTransportLeg[];
  containers: TmsContainerUnit[];
  grossWeightKg: number | null;
  volumeM3: number | null;
  packageCount: number | null;
  customerReference: string | null;
}

export interface TmsTransportLeg {
  sequence: number;
  mode: TransportMode;
  originCode: string | null;
  destinationCode: string | null;
  vesselOrFlight: string | null;
  voyageOrService: string | null;
  departure: Date | null;
  arrival: Date | null;
  carrierCode: string | null;
}

export interface TmsContainerUnit {
  containerNumber: string;
  /** Portal container-type code, already mapped from the source catalogue. */
  containerType: string | null;
  sealNumber: string | null;
  grossWeightKg: number | null;
}

export interface TmsMilestoneEvent {
  /** Stable per source event so re-reads are idempotent. */
  sourceEventId: string;
  /** Portal event code, already mapped. An unmapped source code is dropped, not guessed. */
  eventCode: string;
  occurredAt: Date;
  locationCode: string | null;
  description: string | null;
  /** Events use an exclude-list (v4 rule 6); anything flagged here never reaches a customer. */
  internalOnly: boolean;
}

export interface TmsConsolQuery {
  mode?: TransportMode;
  /** Inclusive lower bound on ETD. */
  etdFrom?: Date;
  /** Inclusive upper bound on ETA. */
  etaTo?: Date;
  cursor?: string;
  limit?: number;
}

export interface TmsConsol {
  consolRef: string;
  mode: TransportMode;
  masterBill: string | null;
  etd: Date | null;
  eta: Date | null;
  shipmentRefs: string[];
}
