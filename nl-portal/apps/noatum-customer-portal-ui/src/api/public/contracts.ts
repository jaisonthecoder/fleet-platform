import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * Provisional contracts for the public surfaces.
 *
 * PROVISIONAL — these shapes are hand-written, which the frontend conventions
 * normally forbid ("never hand-write a type that mirrors an API shape"). The
 * exception holds only because these endpoints do not exist in the OpenAPI
 * document yet: public track and trace, the public counters and the CO2e
 * calculator are named in the PRD but are not in the Phase 1 stages.
 *
 * The moment the API ships them, delete this file and import the generated
 * types from `src/api/generated/schema` instead. Nothing else has to change:
 * the hooks name the endpoint paths below, and the transport in `client.ts`
 * already speaks HTTP.
 *
 * WHY ZOD AND NOT PLAIN INTERFACES
 * An interface is a promise the compiler cannot keep about data that arrives at
 * runtime. These shapes describe an API nobody has written, so the first real
 * response is as likely to disagree with them as agree — and an unchecked
 * `as` cast turns that disagreement into a blank page. Parsing at the transport
 * turns it into the screen's error state instead. The types below are inferred
 * from the schemas, so there is one definition, not two that can drift.
 *
 * Shapes are written the way a REST API would really answer, not the way the
 * screen happens to want:
 *
 *   - timestamps are ISO 8601, never "38 min ago" or "30.09.2026"; formatting
 *     is the browser's job and follows the brand's DD.MM.YYYY;
 *   - statuses are stable codes, not English; the UI translates them;
 *   - the estimate is calculated server-side, because a number the customer
 *     sees must not be computed twice in two languages.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Every path this app calls on the public surface, in one place. */
export const PUBLIC_ENDPOINTS = {
  landing: '/api/public/landing',
  tracking: '/api/public/tracking',
  emissionsReference: '/api/public/emissions/reference',
  emissionsEstimate: '/api/public/emissions/estimate',
  accessRequest: '/api/public/access-request',
} as const;

/** Rejects "", "not-a-date" and 2026-13-45 alike. */
const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'expected an ISO 8601 timestamp',
});

/* ── landing content ─────────────────────────────────────────────────────── */

export const ReferenceKindSchema = z.enum(['container', 'bl', 'booking', 'vehicle']);
export type ReferenceKind = z.infer<typeof ReferenceKindSchema>;

export const PublicStatSchema = z.object({
  /** Stable key; the label and its sub-line are translated, not sent. */
  id: z.enum(['tracked', 'feeds', 'lag']),
  value: z.string(),
});
export type PublicStatDto = z.infer<typeof PublicStatSchema>;

export const PublicReferenceKindSchema = z.object({
  id: ReferenceKindSchema,
  /** An example of the format, shown in the field. Not translated: a container
      number looks the same in every language. */
  placeholder: z.string(),
});
export type PublicReferenceKindDto = z.infer<typeof PublicReferenceKindSchema>;

export const PublicLandingSchema = z.object({
  stats: z.array(PublicStatSchema),
  kinds: z.array(PublicReferenceKindSchema),
  /** References a visitor can try without having one of their own. */
  samples: z.array(z.string()),
});
export type PublicLandingDto = z.infer<typeof PublicLandingSchema>;

/* ── public track and trace ──────────────────────────────────────────────── */

export const PublicShipmentStatusSchema = z.enum(['in_transit', 'delayed', 'delivered']);
export type PublicShipmentStatus = z.infer<typeof PublicShipmentStatusSchema>;

export const PublicFactSchema = z.object({
  id: z.string(),
  /** Absent when `locked`: a withheld value is not sent, not sent-and-hidden. */
  value: z.string().nullable(),
  /** Available only once signed in, per the public-surface security rule. */
  locked: z.boolean(),
});
export type PublicFactDto = z.infer<typeof PublicFactSchema>;

export const PublicMilestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** When it happened. Null while it is still expected. */
  at: isoTimestamp.nullable(),
  /** When it is expected. Null once it has happened. */
  due: isoTimestamp.nullable(),
});
export type PublicMilestoneDto = z.infer<typeof PublicMilestoneSchema>;

const PortSchema = z.object({ code: z.string(), city: z.string() });

export const PublicTrackingSchema = z.object({
  reference: z.string(),
  mode: z.string(),
  equipment: z.string(),
  origin: PortSchema,
  destination: PortSchema,
  status: PublicShipmentStatusSchema,
  /** 0-100. The API owns this: it knows the schedule, the browser does not. */
  progressPct: z.number().min(0).max(100),
  /** Last carrier or terminal message. */
  updatedAt: isoTimestamp,
  departedAt: isoTimestamp.nullable(),
  eta: isoTimestamp.nullable(),
  /** True when the ETA has moved since booking, which the screen calls out. */
  etaRevised: z.boolean(),
  routing: z.string(),
  facts: z.array(PublicFactSchema),
  milestones: z.array(PublicMilestoneSchema),
});
export type PublicTrackingDto = z.infer<typeof PublicTrackingSchema>;

/**
 * What a 404 on the tracking endpoint carries, so the screen can recover.
 *
 * `samples` defaults rather than being required: this body is parsed from a
 * failure response, and a real API that answers `{"message":"not found"}` must
 * still leave the page standing. An empty list simply hides the chips.
 */
export const PublicTrackingMissSchema = z.object({
  reference: z.string().optional(),
  samples: z.array(z.string()).catch([]),
  /** Set when the reference exists but is filed under a different kind, so the
      screen can offer the right tab rather than a flat 'no record'. */
  suggestedKind: ReferenceKindSchema.nullable().catch(null),
});
export type PublicTrackingMissDto = z.infer<typeof PublicTrackingMissSchema>;

/* ── emissions ───────────────────────────────────────────────────────────── */

export const FreightModeSchema = z.enum(['Sea FCL', 'Sea LCL', 'Air', 'Rail', 'Road']);
export type FreightMode = z.infer<typeof FreightModeSchema>;

export const EmissionsLaneSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Modes served on this lane. A mode not listed is not offered. */
  modes: z.array(FreightModeSchema),
});
export type EmissionsLaneDto = z.infer<typeof EmissionsLaneSchema>;

export const EmissionsReferenceSchema = z.object({
  lanes: z.array(EmissionsLaneSchema),
  modes: z.array(FreightModeSchema),
  /** Quick weights, so the visitor need not know their own tonnage. */
  presets: z.array(z.object({ id: z.string(), tonnes: z.number().positive() })),
  /** Which standard the figures follow, shown under the panel. */
  basis: z.string(),
});
export type EmissionsReferenceDto = z.infer<typeof EmissionsReferenceSchema>;

export interface EmissionsEstimateRequest {
  laneId: string;
  mode: FreightMode;
  tonnes: number;
}

export const EmissionsModeResultSchema = z.object({
  mode: FreightModeSchema,
  kg: z.number(),
});
export type EmissionsModeResultDto = z.infer<typeof EmissionsModeResultSchema>;

export const EmissionsEstimateSchema = z.object({
  laneId: z.string(),
  /** Echoed back: asking for a mode the lane does not serve returns the one it
      did use, rather than an error, so the panel never shows zero. */
  mode: FreightModeSchema,
  tonnes: z.number().positive(),
  distanceKm: z.number().nonnegative(),
  /** g CO2e per tonne-kilometre. */
  intensity: z.number().nonnegative(),
  kg: z.number().nonnegative(),
  perTonneKg: z.number().nonnegative(),
  /** Every mode on the lane, for the comparison bars. Never empty: an estimate
      with nothing to compare against would divide by zero in the UI. */
  byMode: z.array(EmissionsModeResultSchema).min(1),
  lowestMode: FreightModeSchema,
  highestMode: FreightModeSchema,
});
export type EmissionsEstimateDto = z.infer<typeof EmissionsEstimateSchema>;

/* ── access request ──────────────────────────────────────────────────────── */

/**
 * There is no public sign-up: customer linking is at organisation level and an
 * account is created by Noatum. This posts an enquiry, nothing more, which is
 * why it returns a reference rather than a session.
 */
export interface AccessRequestBody {
  company: string;
  email: string;
  country: string;
  /** A booking, B/L or invoice number, if they have one. */
  reference?: string;
}

export const AccessRequestSchema = z.object({
  /** Quote this back to the office when following up. */
  reference: z.string(),
  receivedAt: isoTimestamp,
});
export type AccessRequestDto = z.infer<typeof AccessRequestSchema>;
