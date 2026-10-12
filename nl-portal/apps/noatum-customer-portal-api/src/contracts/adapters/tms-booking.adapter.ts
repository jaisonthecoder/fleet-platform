import type { TransportMode } from '../enums';
import type { TmsFetchResult, TmsSubmissionReceipt, TmsSyncStatus, TmsTenantScope } from './tms-common';

/**
 * Port for bookings.
 *
 * v4 rule 3: a booking is linked to a quote by quote number, one-to-many, and a booking is
 * not a shipment. There is deliberately no `convert(quote)` method — that call would build
 * the one-to-one chain the rule forbids. A booking carries an optional `quoteReference` and
 * nothing more.
 *
 * NOT IMPLEMENTED. Phase 3.
 */
export abstract class TmsBookingAdapter {
  /** False when no booking transport is configured; the caller holds the booking rather
   * than failing it. */
  abstract isConfigured(): boolean;

  abstract createBooking(booking: TmsBookingRequest): Promise<TmsSubmissionReceipt>;

  abstract updateBooking(booking: TmsBookingRequest): Promise<TmsSubmissionReceipt>;

  abstract cancelBooking(cancellation: TmsBookingCancellation): Promise<TmsSubmissionReceipt>;

  /** What the TMS has done with the booking we sent. */
  abstract getBookingStatus(reference: string): Promise<TmsFetchResult<TmsSyncStatus | null>>;

  /** Pull the TMS's own view, including its confirmation once it has one. */
  abstract fetchBooking(
    scope: TmsTenantScope,
    reference: string,
  ): Promise<TmsFetchResult<TmsBookingConfirmation | null>>;
}

export interface TmsBookingRequest {
  /** Portal reference, e.g. `B-000117`. */
  reference: string;
  idempotencyKey: string;
  orgCode: string;
  /** The quote this booking came from, when there was one. Many bookings may cite one quote. */
  quoteReference: string | null;
  mode: TransportMode;
  originCode: string;
  destinationCode: string;
  incoterm: string | null;
  /** When the cargo is actually available, not the requested arrival. */
  readyDate: Date | null;
  grossWeightKg: number | null;
  volumeM3: number | null;
  packageCount: number | null;
  shipperName: string | null;
  consigneeName: string | null;
  customerReference: string | null;
  notes: string | null;
}

export interface TmsBookingCancellation {
  reference: string;
  idempotencyKey: string;
  reason: string;
  cancelledAt: Date;
}

/**
 * What comes back when the TMS confirms a booking, whether synchronously or by a later
 * inbound message. Not a return type of any method above — under submit-then-acknowledge
 * there is no synchronous confirmation to return.
 */
export interface TmsBookingConfirmation {
  reference: string;
  externalReference: string;
  confirmedAt: Date;
  /** Present once the TMS has created the shipment; a booking is not a shipment until then. */
  shipmentRef: string | null;
  etd: Date | null;
  eta: Date | null;
}
