/**
 * Types every TMS port shares.
 *
 * They live in one file rather than three copies so that a change to what a submission
 * means cannot drift between quotes, bookings and decisions.
 *
 * Two conventions hold across every port in this folder:
 *  - money is minor units as `bigint`, always paired with an ISO-4217 code. Never a float,
 *    never a bare symbol;
 *  - a date is a `Date`. Parsing whatever the source system emits is the transport's job.
 */

/** ISO-4217 alphabetic code, e.g. `EUR`. Kept as a string because the list is data. */
export type CurrencyCode = string;

export interface Money {
  /** Minor units, e.g. cents. */
  amountMinorUnits: bigint;
  currency: CurrencyCode;
}

/**
 * What we learned by handing something to the TMS.
 *
 * Deliberately says only whether it arrived, not what the TMS decided about it. Under a
 * file drop or a submit-then-acknowledge transport there is no synchronous business
 * answer, so a port that promised one would be lying on three of the five mechanisms in
 * the CargoWise integration design.
 */
export interface TmsSubmissionReceipt {
  /**
   * `recorded` is the honest answer while the transport is held: we have the
   * message safely, we have not sent it. A port that said `accepted` instead
   * would be lying, and the lie surfaces as a customer believing CargoWise has
   * their quote.
   */
  outcome: 'recorded' | 'received' | 'accepted' | 'rejected';
  /** The `integration_message` row this produced, so a caller can ask about it later. */
  messageId: string | null;
  /** The TMS reference when it gives one back immediately; null when it does not. */
  externalReference: string | null;
  /** Our idempotency key, echoed so the caller can correlate a later acknowledgement. */
  idempotencyKey: string;
  /** Operator-readable reason, present on `rejected`. */
  detail?: string;
}

/**
 * What came back from asking the TMS something.
 *
 * `source` exists so a caller can always tell a real answer from an absent one.
 * Without it a screen renders "no shipments" when the truth is "we could not
 * ask", which is the same pixels and the opposite meaning.
 */
export interface TmsFetchResult<T> {
  data: T;
  retrievedAt: Date;
  source: 'cw1' | 'cache' | 'unavailable';
}

/** The empty, honest answer for a port with no configured transport. */
export function unavailable<T>(data: T): TmsFetchResult<T> {
  return { data, retrievedAt: new Date(), source: 'unavailable' };
}

/**
 * What the TMS has done with something we sent it.
 *
 * Deliberately coarse and shared across every port: we are reporting whether our
 * message landed, not modelling another system's workflow. `unknown` is a real
 * answer and must stay distinguishable from `pending`.
 */
export interface TmsSyncStatus {
  /** Our reference, e.g. `Q-000042`. */
  reference: string;
  state: 'pending' | 'received' | 'in_progress' | 'answered' | 'rejected' | 'unknown';
  externalReference: string | null;
  detail: string | null;
  observedAt: Date;
}

/**
 * Cursor paging, not offset: TMS result sets move under us while a customer reads them,
 * and an offset silently skips rows when that happens.
 */
export interface TmsPage<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * The tenant boundary as the TMS understands it.
 *
 * Every read port takes this, and the caller must have resolved the codes from the portal
 * tenant first. An empty list means "no data", never "everything" — implementations fail
 * closed.
 */
export interface TmsTenantScope {
  /** Organisation codes the caller is entitled to. Never taken from user input. */
  orgCodes: string[];
}
