import type { CustomerTier } from './enums';

/**
 * Feature flags, and what each tier gets by default.
 *
 * A customer group starts from its tier defaults; Noatum admins then override individual
 * flags per group. Resolution order is: tier default, then the group override.
 */
export const FEATURE_FLAGS = {
  QUOTES: 'quotes',
  TEMPLATES: 'templates',
  ADDRESS_BOOK: 'addressBook',
  TRACKING: 'tracking',
  DOCUMENTS: 'documents',
  INVOICES: 'invoices',
  BOOKINGS: 'bookings',
  CLAIMS: 'claims',
  REPORTS: 'reports',
  API_ACCESS: 'apiAccess',
  MULTI_ACCOUNT: 'multiAccount',
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type FeatureFlagSet = Record<FeatureFlag, boolean>;

const NONE: FeatureFlagSet = {
  quotes: false,
  templates: false,
  addressBook: false,
  tracking: false,
  documents: false,
  invoices: false,
  bookings: false,
  claims: false,
  reports: false,
  apiAccess: false,
  multiAccount: false,
};

export const TIER_DEFAULT_FLAGS: Record<CustomerTier, FeatureFlagSet> = {
  basic: {
    ...NONE,
    quotes: true,
    addressBook: true,
    tracking: true,
  },
  standard: {
    ...NONE,
    quotes: true,
    templates: true,
    addressBook: true,
    tracking: true,
    documents: true,
    invoices: true,
    multiAccount: true,
  },
  premium: {
    quotes: true,
    templates: true,
    addressBook: true,
    tracking: true,
    documents: true,
    invoices: true,
    bookings: true,
    claims: true,
    reports: true,
    apiAccess: true,
    multiAccount: true,
  },
};

/**
 * Effective flags for a group. Unknown keys in `overrides` are ignored rather than
 * trusted, so a stale flag left in the database cannot switch on a removed feature.
 */
export function resolveFlags(
  tier: CustomerTier,
  overrides: Record<string, unknown> = {},
): FeatureFlagSet {
  const defaults = TIER_DEFAULT_FLAGS[tier];
  const resolved = { ...defaults };

  for (const key of Object.keys(defaults) as FeatureFlag[]) {
    const override = overrides[key];
    if (typeof override === 'boolean') {
      resolved[key] = override;
    }
  }

  return resolved;
}
