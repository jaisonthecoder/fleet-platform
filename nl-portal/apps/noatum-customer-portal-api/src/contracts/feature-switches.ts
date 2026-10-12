/**
 * Platform feature switches.
 *
 * Distinct from FEATURE_FLAGS in `feature-flags.ts`, which answers "may this
 * customer use Quotations". A switch answers "may anyone at Noatum use this
 * optional capability at all". Platform wide, administrator controlled.
 *
 * The catalogue is code and the state is data: an administrator can change a
 * switch but cannot invent one, and a stored key missing from here is ignored.
 *
 * Three things deliberately never appear:
 *  - deployment configuration (the dev sign-in bypass, the CargoWise endpoint),
 *    because a database row can be changed in production and an environment
 *    variable cannot;
 *  - anything needing a scope or precedence, which is a setting under D-18;
 *  - anything in PROTECTED_CAPABILITIES below.
 */

export const FEATURE_SWITCH_CATEGORIES = [
  'organisations',
  'lookups',
  'access',
  'communication',
  'quotations',
  'documents',
  'dashboard',
] as const;

export type FeatureSwitchCategory = (typeof FEATURE_SWITCH_CATEGORIES)[number];

export interface FeatureSwitchDefinition {
  category: FeatureSwitchCategory;
  /** English fallback. The SPA translates by key and falls back to this. */
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** Turning this on requires a recorded approval reference (privacy, legal, sponsor). */
  requiresApproval: boolean;
}

export const FEATURE_SWITCHES = {
  'organisations.import.file': {
    category: 'organisations',
    label: 'Import organisations from a file',
    description: 'Lets staff upload a CargoWise extract into the organisation directory.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'organisations.import.feed': {
    category: 'organisations',
    label: 'Fetch organisations from CargoWise',
    description: 'Lets staff trigger the CargoWise organisation feed. Needs a configured source.',
    defaultEnabled: false,
    requiresApproval: false,
  },
  'organisations.manual_entry': {
    category: 'organisations',
    label: 'Add organisations manually',
    description:
      'Lets staff create a provisional organisation by hand. Provisional records can never be linked to a customer until an import confirms them.',
    defaultEnabled: false,
    requiresApproval: false,
  },
  'organisations.contacts.import': {
    category: 'organisations',
    label: 'Import organisation contacts',
    description:
      'Ingests contact records from the source. Personal data, so it stays off until a legal basis is recorded.',
    defaultEnabled: false,
    requiresApproval: true,
  },
  'lookups.type_creation': {
    category: 'lookups',
    label: 'Create lookup types',
    description: 'Lets staff add new lookup types. Editing values is unaffected.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'access.impersonation': {
    category: 'access',
    label: 'View as a customer user',
    description:
      'Read-only, time-boxed and fully audited support access. Writes are refused while impersonating.',
    defaultEnabled: false,
    requiresApproval: true,
  },
  'communication.ai_drafting': {
    category: 'communication',
    label: 'AI email drafting',
    description:
      'Calls the external drafting service for a suggested message. A person still edits and sends; a template is used when this is off.',
    defaultEnabled: false,
    requiresApproval: false,
  },
  'quotations.instant_rate': {
    category: 'quotations',
    label: 'Instant rates',
    description:
      'Prices a quote automatically. No rate source is configured, so this stays off until one exists and every quote is priced by a person.',
    defaultEnabled: false,
    requiresApproval: true,
  },
  'quotations.dangerous_goods': {
    category: 'quotations',
    label: 'Dangerous goods requests',
    description:
      'Lets a customer declare dangerous goods on a quote request. On by default because the request wizard treats it as normal; turn it off for a branch that does not accept hazardous cargo, and the API then refuses a request carrying it. This captures data for pricing only - it is never a dangerous goods declaration.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'quotations.portal_pricing': {
    category: 'quotations',
    label: 'Price quotes in the portal',
    description:
      'Lets staff record a price in the portal, like the spreadsheet it replaces. On by default: this is the main path. With it off the portal is a window - requests still go to CargoWise and priced quotes still come back, and claiming is unaffected because who is handling a request matters on either path.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'quotations.multi_option': {
    category: 'quotations',
    label: 'Several options on one quote',
    description:
      'Lets a quote carry more than one priced option. With it off a second option is refused outright rather than silently dropped. The stored shape is the same either way, so a quote already priced with several options keeps showing all of them.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'quotations.cw1_request_sync': {
    category: 'quotations',
    label: 'Copy quote requests to CargoWise',
    description:
      'Hands every submitted request to the CargoWise adapter. With it off the message is still written and marked skipped, so the record that we chose not to send it survives. Nothing the customer sees depends on this either way.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'quotations.ai_intake': {
    category: 'quotations',
    label: 'AI quote intake assistant',
    description:
      'Lets a customer upload an invoice or packing list, or paste an enquiry, and have the request form filled in as an editable draft. The assistant reads the document; the container and Incoterm rules are ours and run afterwards. It never proposes a price and never submits the request. Off by default because the document is read by a third-party model.',
    defaultEnabled: false,
    requiresApproval: true,
  },
  'pricing.ai_assist': {
    category: 'quotations',
    label: 'AI pricing assistant',
    description:
      'Gives the pricing desk an assistant that briefs the pricer on a request, sets up the charge lines a lane needs with every rate left blank, reads a carrier reply into draft options, and drafts the covering note. It never proposes a rate of its own, never recommends an option and never publishes. Cost is never sent to the model. Off by default because the carrier reply is read by a third-party model.',
    defaultEnabled: false,
    requiresApproval: true,
  },
  'documents.customer_upload': {
    category: 'documents',
    label: 'Customer document attachments',
    description:
      'Lets a customer attach papers to a quote request - a packing list, a safety data sheet. Off by default because it changes what a customer can send us, and because uploaded files are not scanned for malware yet.',
    defaultEnabled: false,
    requiresApproval: true,
  },
  'documents.quote_answer': {
    category: 'documents',
    label: 'Answer a quote with a document',
    description:
      'Lets a branch attach its own quotation document instead of, or alongside, a typed price. On by default: some branches have always answered this way and the portal accepts a document as a complete answer.',
    defaultEnabled: true,
    requiresApproval: false,
  },
  'dashboard.analytics': {
    category: 'dashboard',
    label: 'Customer analytics dashboard',
    description:
      'The charts on the customer landing page - volumes, on-time arrival, transit by lane, spend, ageing and emissions. On by default because the mockups treat it as the dashboard. Until the CargoWise shipment and finance tables exist the figures are a generated sample and the response says so; turn this off for an environment where a customer must not see sample figures at all, and the API then refuses the call rather than trusting the screen to caveat it.',
    defaultEnabled: true,
    requiresApproval: false,
  },
} as const satisfies Record<string, FeatureSwitchDefinition>;

export type FeatureSwitchKey = keyof typeof FEATURE_SWITCHES;

export const FEATURE_SWITCH_KEYS = Object.keys(FEATURE_SWITCHES) as [
  FeatureSwitchKey,
  ...FeatureSwitchKey[],
];

export const isFeatureSwitchKey = (value: string): value is FeatureSwitchKey =>
  Object.hasOwn(FEATURE_SWITCHES, value);

/**
 * Capabilities that are invariants rather than options, listed so the page can
 * explain why they are absent. An auditor should not have to guess whether an
 * omission was deliberate.
 */
export const PROTECTED_CAPABILITIES = [
  {
    id: 'tenancy',
    label: 'Tenant isolation and row level security',
    reason: 'One customer must never see another customer data. There is no safe reason to disable this.',
  },
  {
    id: 'permissions',
    label: 'Permission checks on every endpoint',
    reason: 'Access is decided by the server on every request, not by configuration.',
  },
  {
    id: 'audit',
    label: 'Audit of significant writes',
    reason: 'An action that cannot be attributed afterwards is not an action we allow.',
  },
  {
    id: 'human_send',
    label: 'A person sends every customer email',
    reason: 'Automation may draft, never send.',
  },
  {
    id: 'cost_privacy',
    label: 'Internal cost data stays internal',
    reason: 'Cost is stripped for customer surfaces in one place, by construction.',
  },
  {
    id: 'accepted_immutability',
    label: 'Accepted quotes are immutable',
    reason: 'A published commercial record cannot be rewritten after the customer accepted it.',
  },
  {
    id: 'link_gate',
    label: 'Only source-confirmed organisations can be linked',
    reason: 'A hand-typed code is a guess at a future CargoWise key, so it can never grant access.',
  },
  {
    id: 'one_code_one_customer',
    label: 'One organisation code belongs to one customer',
    reason: 'Two owners of one code means two customers seeing the same cargo.',
  },
  {
    id: 'no_address_linking',
    label: 'Addresses are never linked to a customer',
    reason: 'Linking is at organisation level only. There is no code path to switch on.',
  },
  {
    id: 'no_source_writeback',
    label: 'Nothing is written back to CargoWise',
    reason: 'CargoWise is the system of record. The mirror is read-only in that direction.',
  },
  {
    id: 'document_allow_list',
    label: 'Document types reach customers only when approved',
    reason: 'Document typing at source is manual and unvalidated, so visibility is an allow-list.',
  },
] as const;

export type ProtectedCapability = (typeof PROTECTED_CAPABILITIES)[number];
