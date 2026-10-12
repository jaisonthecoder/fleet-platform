import type { CustomerTier } from '../enums';
import type { FeatureFlagSet } from '../feature-flags';

export interface CustomerGroupDto {
  id: string;
  name: string;
  slug: string;
  tier: CustomerTier;
  /** Already resolved against the tier defaults - the SPA never resolves flags itself. */
  flags: FeatureFlagSet;
  isActive: boolean;
}

export interface CustomerAccountDto {
  id: string;
  name: string;
  cw1OrgCode: string;
  countryCode: string | null;
  isActive: boolean;
}

/**
 * A CW1 organisation search hit, used when an admin links an account.
 *
 * Not yet wired to a route: the directory endpoints are ORG-04. Kept aligned with
 * the ORG-02 columns so it does not quietly drift from the table it describes.
 */
export interface MasterOrgDto {
  id: string;
  sourceCode: string;
  sourceInstance: string;
  name: string;
  countryCode: string | null;
  city: string | null;
  isCustomer: boolean;
  isActive: boolean;
  /** Only a source-confirmed organisation may be linked to a customer. */
  isSourceConfirmed: boolean;
}
