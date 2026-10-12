/**
 * The permission vocabulary. One source of truth for the API guards, the SPA, and the
 * `permission` table seed.
 *
 * Naming: `<area>.<verb>`. Add a constant here first, then a seed row, then use it.
 * Never write a permission as a string literal - PermissionKey exists to stop that.
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_READ: 'dashboard.read',

  // Quotes and templates
  QUOTES_READ: 'quotes.read',
  QUOTES_CREATE: 'quotes.create',
  QUOTES_SUBMIT: 'quotes.submit',
  QUOTES_ACCEPT: 'quotes.accept',
  QUOTES_CANCEL: 'quotes.cancel',
  TEMPLATES_READ: 'templates.read',
  TEMPLATES_MANAGE: 'templates.manage',

  // Address book
  ADDRESS_BOOK_READ: 'address_book.read',
  ADDRESS_BOOK_MANAGE: 'address_book.manage',

  // Internal pricing (P1.09). Defined now so roles can be prepared; the routes
  // themselves arrive with the pricing stage.
  PRICING_QUEUE_READ: 'pricing.queue.read',
  PRICING_CLAIM: 'pricing.claim',
  PRICING_CLAIM_RELEASE: 'pricing.claim.release',
  PRICING_PRICE: 'pricing.price',
  PRICING_APPROVE: 'pricing.approve',
  /** Releasing a priced quote to the customer. Separate from pricing it. */
  PRICING_PUBLISH: 'pricing.publish',
  /** Work outside the user's own branch. Never implied by a pricing role. */
  PRICING_CROSS_BRANCH: 'pricing.cross_branch',
  /** See internal cost and margin. Never implied by administration. */
  PRICING_COST_VIEW: 'pricing.cost.view',

  // Future modules. The permissions exist in Phase 1 so access can be prepared
  // before the workflows are released (FR-NAV-002).
  SHIPMENTS_READ: 'shipments.read',
  SHIPMENTS_EXPORT: 'shipments.export',
  DOCUMENTS_READ: 'documents.read',
  DOCUMENTS_DOWNLOAD: 'documents.download',
  DOCUMENTS_UPLOAD: 'documents.upload',
  INVOICES_READ: 'invoices.read',
  INVOICES_DOWNLOAD: 'invoices.download',
  BOOKINGS_READ: 'bookings.read',
  BOOKINGS_CREATE: 'bookings.create',
  BOOKINGS_CANCEL: 'bookings.cancel',
  CLAIMS_READ: 'claims.read',
  CLAIMS_CREATE: 'claims.create',
  CLAIMS_COMMENT: 'claims.comment',

  // Reports and notifications
  REPORTS_READ: 'reports.read',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_ASSIGN: 'reports.assign',
  NOTIFICATIONS_MANAGE: 'notifications.manage',

  // Customer-side administration
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  API_KEYS_MANAGE: 'api_keys.manage',

  // Noatum-side administration. Internal roles only.
  ADMIN_STAFF_READ: 'admin.staff.read',
  ADMIN_STAFF_ROLES_MANAGE: 'admin.staff.roles.manage',
  ADMIN_CUSTOMERS_READ: 'admin.customers.read',
  ADMIN_CUSTOMERS_MANAGE: 'admin.customers.manage',
  ADMIN_ACCOUNTS_MANAGE: 'admin.accounts.manage',
  ADMIN_ORGANISATIONS_LINK: 'admin.organisations.link',
  /** Separate from linking: a bad import can deactivate organisations wholesale. */
  ADMIN_ORGANISATIONS_IMPORT: 'admin.organisations.import',
  ADMIN_FLAGS_MANAGE: 'admin.flags.manage',
  ADMIN_LOOKUPS_MANAGE: 'admin.lookups.manage',
  ADMIN_SETTINGS_READ: 'admin.settings.read',
  ADMIN_SETTINGS_MANAGE: 'admin.settings.manage',
  ADMIN_NEWS_MANAGE: 'admin.news.manage',
  ADMIN_IMPERSONATE: 'admin.impersonate',
  ADMIN_AUDIT_READ: 'admin.audit.read',
  ADMIN_INTEGRATION_READ: 'admin.integration.read',
  // Noatum operating structure: regions and branches. Read is split from manage
  // the same way admin.organisations.link is split from admin.organisations.import.
  ADMIN_OPERATING_READ: 'admin.operating.read',
  ADMIN_OPERATING_MANAGE: 'admin.operating.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];

/** Permissions no customer admin may grant, whatever their own role says. */
export const INTERNAL_ONLY_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.PRICING_QUEUE_READ,
  PERMISSIONS.PRICING_CLAIM,
  PERMISSIONS.PRICING_CLAIM_RELEASE,
  PERMISSIONS.PRICING_PRICE,
  PERMISSIONS.PRICING_APPROVE,
  PERMISSIONS.PRICING_PUBLISH,
  PERMISSIONS.PRICING_CROSS_BRANCH,
  PERMISSIONS.PRICING_COST_VIEW,
  PERMISSIONS.ADMIN_STAFF_READ,
  PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE,
  PERMISSIONS.ADMIN_CUSTOMERS_READ,
  PERMISSIONS.ADMIN_CUSTOMERS_MANAGE,
  PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
  PERMISSIONS.ADMIN_ORGANISATIONS_LINK,
  PERMISSIONS.ADMIN_ORGANISATIONS_IMPORT,
  PERMISSIONS.ADMIN_FLAGS_MANAGE,
  PERMISSIONS.ADMIN_LOOKUPS_MANAGE,
  PERMISSIONS.ADMIN_SETTINGS_READ,
  PERMISSIONS.ADMIN_SETTINGS_MANAGE,
  PERMISSIONS.ADMIN_NEWS_MANAGE,
  PERMISSIONS.ADMIN_IMPERSONATE,
  PERMISSIONS.ADMIN_INTEGRATION_READ,
  PERMISSIONS.ADMIN_OPERATING_READ,
  PERMISSIONS.ADMIN_OPERATING_MANAGE,
];

/**
 * Seeded roles. Keys match the `role.key` column and the presets named in the
 * functional baseline (FR sections 3, 5.1 and 5.2).
 */
export const ROLES = {
  // Internal presets, assignable only with admin.staff.roles.manage.
  PLATFORM_ADMIN: 'platform_admin',
  CUSTOMER_SUCCESS: 'customer_success',
  PRICING: 'pricing',
  PRICING_APPROVER: 'pricing_approver',
  OPS: 'ops',

  // Customer presets. Catalogued now so the permission framework is complete;
  // assignment arrives with customer onboarding.
  CUSTOMER_STANDARD: 'customer_standard',
  CUSTOMER_QUOTING_BOOKING: 'customer_quoting_booking',
  CUSTOMER_FINANCE: 'customer_finance',
  CUSTOMER_ANALYST: 'customer_analyst',
  CUSTOMER_CLAIMS: 'customer_claims',
  CUSTOMER_ADMIN: 'customer_admin',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

/** The internal presets, in the order the staff administration screen lists them. */
export const INTERNAL_ROLE_KEYS: readonly RoleKey[] = [
  ROLES.PLATFORM_ADMIN,
  ROLES.CUSTOMER_SUCCESS,
  ROLES.PRICING,
  ROLES.PRICING_APPROVER,
  ROLES.OPS,
];

/**
 * Every permission that is not reserved to Noatum staff.
 *
 * The complement of INTERNAL_ONLY_PERMISSIONS, so the two lists cannot drift:
 * adding a customer-facing permission adds it here, and marking one internal
 * removes it. This is what a Customer Admin holds.
 */
const CUSTOMER_ALL: readonly PermissionKey[] = ALL_PERMISSIONS.filter(
  (key) => !INTERNAL_ONLY_PERMISSIONS.includes(key),
);

const CUSTOMER_BASELINE: readonly PermissionKey[] = [
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.SHIPMENTS_READ,
  PERMISSIONS.DOCUMENTS_READ,
  PERMISSIONS.DOCUMENTS_DOWNLOAD,
  PERMISSIONS.NOTIFICATIONS_MANAGE,
];

/**
 * What each preset grants. The migration seeds `role_permission` from this shape,
 * and a test fails the build when the database and this file disagree.
 *
 * Platform Admin is governance only and never gains cost or commercial data. That
 * rule is load-bearing and unchanged.
 *
 * Customer Admin used to be the same shape on the customer side — people only, no
 * finance, no quoting — so that whoever grants access cannot also approve an
 * invoice. **Widened on 17.09.2026 by product direction**: the Customer Admin is
 * the customer's own owner of the portal and, in a pilot, usually its only user,
 * so a role that cannot quote, book or see an invoice leaves the account unable to
 * do anything on day one.
 *
 * The separation of duties that removes is real, and the way back is to move a
 * customer off the preset onto a narrower role rather than to re-narrow this one:
 * the other five customer presets already carry exactly one job each.
 */
export const ROLE_PRESETS: Record<RoleKey, readonly PermissionKey[]> = {
  [ROLES.PLATFORM_ADMIN]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ADMIN_STAFF_READ,
    PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE,
    PERMISSIONS.ADMIN_CUSTOMERS_READ,
    PERMISSIONS.ADMIN_CUSTOMERS_MANAGE,
    PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    PERMISSIONS.ADMIN_ORGANISATIONS_LINK,
    PERMISSIONS.ADMIN_ORGANISATIONS_IMPORT,
    PERMISSIONS.ADMIN_FLAGS_MANAGE,
    PERMISSIONS.ADMIN_LOOKUPS_MANAGE,
    PERMISSIONS.ADMIN_SETTINGS_READ,
    PERMISSIONS.ADMIN_SETTINGS_MANAGE,
    PERMISSIONS.ADMIN_NEWS_MANAGE,
    PERMISSIONS.ADMIN_AUDIT_READ,
    PERMISSIONS.ADMIN_INTEGRATION_READ,
    PERMISSIONS.ADMIN_OPERATING_READ,
    PERMISSIONS.ADMIN_OPERATING_MANAGE,
  ],
  [ROLES.CUSTOMER_SUCCESS]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.ADMIN_CUSTOMERS_READ,
    PERMISSIONS.ADMIN_CUSTOMERS_MANAGE,
    PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    PERMISSIONS.ADMIN_ORGANISATIONS_LINK,
    PERMISSIONS.ADMIN_NEWS_MANAGE,
    PERMISSIONS.ADMIN_IMPERSONATE,
    // Needed to choose a servicing office while onboarding; managing them is not.
    PERMISSIONS.ADMIN_OPERATING_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE,
  ],
  [ROLES.PRICING]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.PRICING_QUEUE_READ,
    PERMISSIONS.PRICING_CLAIM,
    PERMISSIONS.PRICING_PRICE,
    // A pricer publishes their own work below the threshold. Above it the service
    // refuses until a different person has approved, so this is not a way round
    // four-eyes - it is what makes the ordinary case one click rather than two people.
    PERMISSIONS.PRICING_PUBLISH,
  ],
  [ROLES.PRICING_APPROVER]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.PRICING_QUEUE_READ,
    PERMISSIONS.PRICING_APPROVE,
    PERMISSIONS.PRICING_PUBLISH,
    PERMISSIONS.PRICING_CLAIM_RELEASE,
  ],
  [ROLES.OPS]: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.SHIPMENTS_READ,
    PERMISSIONS.DOCUMENTS_READ,
  ],

  [ROLES.CUSTOMER_STANDARD]: CUSTOMER_BASELINE,
  [ROLES.CUSTOMER_QUOTING_BOOKING]: [
    ...CUSTOMER_BASELINE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_CREATE,
    PERMISSIONS.QUOTES_SUBMIT,
    PERMISSIONS.QUOTES_ACCEPT,
    PERMISSIONS.QUOTES_CANCEL,
    PERMISSIONS.TEMPLATES_READ,
    PERMISSIONS.TEMPLATES_MANAGE,
    PERMISSIONS.ADDRESS_BOOK_READ,
    PERMISSIONS.ADDRESS_BOOK_MANAGE,
    PERMISSIONS.BOOKINGS_READ,
    PERMISSIONS.BOOKINGS_CREATE,
    PERMISSIONS.BOOKINGS_CANCEL,
  ],
  [ROLES.CUSTOMER_FINANCE]: [
    ...CUSTOMER_BASELINE,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_DOWNLOAD,
    PERMISSIONS.REPORTS_READ,
  ],
  [ROLES.CUSTOMER_ANALYST]: [
    ...CUSTOMER_BASELINE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  [ROLES.CUSTOMER_CLAIMS]: [
    ...CUSTOMER_BASELINE,
    PERMISSIONS.CLAIMS_READ,
    PERMISSIONS.CLAIMS_CREATE,
    PERMISSIONS.CLAIMS_COMMENT,
  ],
  /*
   * Everything a customer can do, derived rather than listed.
   *
   * A hand-kept list would have to be extended every time a customer permission
   * is added, and the day somebody forgets is the day an administrator cannot
   * reach a feature their own colleagues can. Deriving it from the internal-only
   * list states the rule instead of a snapshot of it: what is not internal is
   * the customer's, and the customer's owner holds all of it.
   */
  [ROLES.CUSTOMER_ADMIN]: CUSTOMER_ALL,
};
