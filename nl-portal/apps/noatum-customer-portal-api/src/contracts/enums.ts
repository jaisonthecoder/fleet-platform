/**
 * Enum values shared by the API and the SPA.
 *
 * These mirror the Postgres enums in prisma/schema.prisma. Changing one means a
 * migration and a change here, in the same PR.
 */

export const TRANSPORT_MODES = ['air', 'sea', 'road', 'rail'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const QUOTE_STATUSES = [
  'draft',
  // The five live staff stages, in the words the pricing screen's stepper uses.
  'requested',
  'claimed',
  'priced',
  'approved',
  'published',
  // Deprecated in C3, superseded by requested / published / priced. Retained
  // because a Postgres enum value cannot be dropped in place.
  'submitted',
  'quoted',
  'pending_sync',
  // Deprecated: the instant-rate seam. No rate source is configured.
  'rated',
  'rate_failed',
  'expired',
  'accepted',
  'rejected',
  'withdrawn',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/**
 * What a customer's quote list shows. Several internal states share a badge on
 * purpose - see CUSTOMER_QUOTE_BADGE in modules/quotes/quote.status.ts.
 */
export const CUSTOMER_QUOTE_BADGES = [
  'draft',
  'requested',
  'in_progress',
  'quoted',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
] as const;
export type CustomerQuoteBadge = (typeof CUSTOMER_QUOTE_BADGES)[number];

/**
 * Incoterms 2020 rules that apply to sea and inland waterway transport only.
 *
 * ICC rule, not a preference: offering FOB against an air shipment is a contractual error,
 * so the create schema refuses the combination rather than leaving it to the screen.
 */
export const SEA_ONLY_INCOTERMS = ['FAS', 'FOB', 'CFR', 'CIF'] as const;

export const INCOTERMS_2020 = [
  'EXW',
  'FCA',
  'CPT',
  'CIP',
  'DAP',
  'DPU',
  'DDP',
  ...SEA_ONLY_INCOTERMS,
] as const;
export type Incoterm = (typeof INCOTERMS_2020)[number];

export const CUSTOMER_TIERS = ['basic', 'standard', 'premium'] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const USER_STATUSES = ['invited', 'active', 'suspended', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const INVITATION_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'dead'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const LOCALES = ['en-US', 'es-ES'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en-US';

/**
 * The seven segments the quotation pipeline band draws, for both audiences.
 *
 * Presentation states, not stored ones. `options_ready`, `expiring_soon` and
 * `expired` are all `published` in the database and differ only by where the
 * validity date sits relative to now, so the server derives them in one place -
 * a segment count, a segment filter and a row's own colour that disagreed would
 * be a listing that cannot be trusted to filter itself.
 *
 * `submitted` and `in_progress` are one bucket split in two. They used to be a
 * single `requested` covering eight database statuses, so a customer watching a
 * quotation saw the same word from the moment they sent it until the offer
 * arrived - no way to tell "nobody has picked it up" from "someone is pricing it
 * now", which is the one thing they ring up to ask. The split is the whole point
 * of a pipeline: it has to move.
 */
export const QUOTE_PIPELINE_SEGMENTS = [
  'submitted',
  'in_progress',
  'options_ready',
  'expiring_soon',
  'accepted',
  'declined',
  'expired',
] as const;
export type QuotePipelineSegment = (typeof QUOTE_PIPELINE_SEGMENTS)[number];

/**
 * How few days left makes a published quote "expiring soon".
 *
 * Here rather than in either screen, because the customer's band, the staff
 * band and both grids have to agree on the same boundary.
 */
export const QUOTE_EXPIRING_SOON_DAYS = 3;
