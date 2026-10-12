import type { TmsFetchResult, TmsPage } from './tms-common';

/**
 * Port for the CargoWise organisation directory.
 *
 * The directory is already imported today, but by reading a file export directly.
 * Putting it behind a port makes a refresh work the same way as everything else,
 * and means the day a feed is agreed we write a transport rather than rewriting
 * the import service.
 *
 * v4 rule 9: linking is at organisation level only. Addresses hang beneath an
 * organisation and are never linked individually, which is why an address here is
 * a child record and has no identity of its own outside its parent.
 *
 * NOT IMPLEMENTED. Every method answers `unavailable` while the transport is held.
 */
export abstract class TmsOrganisationAdapter {
  /** False while no organisation transport is configured. */
  abstract isConfigured(): boolean;

  abstract listOrganisations(
    query?: TmsOrganisationQuery,
  ): Promise<TmsFetchResult<TmsPage<TmsOrganisation>>>;

  /** Null when the code is unknown to the source. */
  abstract fetchOrganisation(orgCode: string): Promise<TmsFetchResult<TmsOrganisation | null>>;

  /** Catch-up poll, so a refresh does not re-read the whole directory. */
  abstract listOrganisationsChangedSince(
    since: Date,
    cursor?: string,
  ): Promise<TmsFetchResult<TmsPage<TmsOrganisation>>>;
}

export interface TmsOrganisationQuery {
  /** Free text over code and name. */
  search?: string;
  countryCode?: string;
  cursor?: string;
  limit?: number;
}

export interface TmsOrganisation {
  /** The source system's organisation code. The only key a link may ever cite. */
  orgCode: string;
  name: string;
  countryCode: string | null;
  /**
   * True only when this record came from the source system.
   *
   * A hand-typed organisation is a guess at a future CargoWise key, and the link
   * gate refuses to grant access on a guess - so this can never be defaulted true.
   */
  isSourceConfirmed: boolean;
  addresses: TmsOrganisationAddress[];
  updatedAt: Date | null;
}

export interface TmsOrganisationAddress {
  /** Source address code. Never linked to a customer on its own. */
  addressCode: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  countryCode: string | null;
  isActive: boolean;
}
