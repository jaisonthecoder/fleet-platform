/* ────────────────────────────────────────────────────────────────────────────
 * The stand-in dataset.
 *
 * WARNING — none of this comes from the platform.
 *
 * It exists so the public page can be built and reviewed whole before the
 * public track-and-trace, counter and emissions endpoints are written. A
 * shipment shown here is not a shipment Noatum is carrying.
 *
 * It lives under `api/public/mock` rather than beside the screen on purpose:
 * everything fake is behind the transport, so the components have no idea it is
 * here, and deleting this folder is the whole of "going live".
 *
 * Timestamps are computed from the current time rather than pinned, because a
 * tracking feed that says "last message 38 min ago" and never moves is the one
 * thing that gives a prototype away in a demo.
 * ──────────────────────────────────────────────────────────────────────────── */

import type {
  EmissionsReferenceDto,
  FreightMode,
  PublicLandingDto,
  PublicTrackingDto,
  ReferenceKind,
} from '../contracts';

/**
 * A record plus the kind it is filed under.
 *
 * The kind is not part of the response — it is how the API would index the
 * lookup. A B/L number is not searchable as a container number, and a screen
 * that lets you pick a kind and then ignores it is lying about what it did.
 */
export interface TrackingRecord extends PublicTrackingDto {
  kind: ReferenceKind;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

export const landing: PublicLandingDto = {
  stats: [
    { id: 'tracked', value: '18,402' },
    { id: 'feeds', value: '42' },
    { id: 'lag', value: '36 min' },
  ],
  kinds: [
    { id: 'container', placeholder: 'e.g. MSCU 774512-3' },
    { id: 'bl', placeholder: 'e.g. 020-4471 8823' },
    { id: 'booking', placeholder: 'e.g. BK-2026-0298' },
    { id: 'vehicle', placeholder: 'e.g. CMR 4471-B' },
  ],
  samples: ['MSCU 774512-3', '020-4471 8823'],
};

/** Built per call so the ages move with the clock. */
export function trackingRecords(): TrackingRecord[] {
  return [
    {
      kind: 'container',
      reference: 'MSCU 774512-3',
      mode: 'Sea FCL',
      equipment: "40' HC container",
      origin: { code: 'CNTAO', city: 'Qingdao, CN' },
      destination: { code: 'ESVLC', city: 'Valencia, ES' },
      status: 'in_transit',
      progressPct: 58,
      updatedAt: at(-38 * MINUTE),
      departedAt: at(-17 * DAY),
      eta: at(44 * DAY),
      etaRevised: false,
      routing: 'Qingdao → Singapore → Valencia',
      facts: [
        { id: 'container', value: 'MSCU 774512-3', locked: false },
        { id: 'carrier', value: 'MSC', locked: false },
        { id: 'parties', value: null, locked: true },
        { id: 'documents', value: null, locked: true },
      ],
      milestones: [
        { id: 'gate-in', label: 'Gate in Qingdao', at: at(-19 * DAY), due: null },
        { id: 'departed', label: 'Departed Qingdao', at: at(-17 * DAY), due: null },
        { id: 'transhipment', label: 'Transhipment Singapore', at: null, due: at(26 * DAY) },
        { id: 'arrival', label: 'Arrival Valencia', at: null, due: at(44 * DAY) },
      ],
    },
    {
      kind: 'bl',
      reference: '020-4471 8823',
      mode: 'Air',
      equipment: '4 pieces',
      origin: { code: 'SZX', city: 'Shenzhen, CN' },
      destination: { code: 'MAD', city: 'Madrid, ES' },
      status: 'delayed',
      progressPct: 74,
      updatedAt: at(-2 * HOUR),
      departedAt: at(-2 * DAY),
      eta: at(2 * DAY),
      etaRevised: true,
      routing: 'Shenzhen → Dubai → Madrid',
      facts: [
        { id: 'awb', value: '020-4471 8823', locked: false },
        { id: 'carrier', value: 'Emirates SkyCargo', locked: false },
        { id: 'parties', value: null, locked: true },
        { id: 'documents', value: null, locked: true },
      ],
      milestones: [
        { id: 'departed', label: 'Departed Shenzhen', at: at(-2 * DAY), due: null },
        { id: 'transit', label: 'Transit Dubai', at: at(-16 * HOUR), due: null },
        { id: 'arrival', label: 'Arrival Madrid', at: null, due: at(2 * DAY) },
        { id: 'delivered', label: 'Delivered', at: null, due: at(3 * DAY) },
      ],
    },
  ];
}

/* ── emissions reference data ────────────────────────────────────────────── */

/** g CO2e per tonne-kilometre, well to wheel, GLEC aligned. */
export const INTENSITY: Record<FreightMode, number> = {
  'Sea FCL': 8,
  'Sea LCL': 12,
  Air: 500,
  Rail: 22,
  Road: 62,
};

/** Kilometres per lane, per mode. An aircraft does not fly a ship's route. */
export const LANE_DISTANCE: { id: string; label: string; distance: Partial<Record<FreightMode, number>> }[] = [
  { id: 'cntao-esvlc', label: 'Qingdao → Valencia', distance: { 'Sea FCL': 19800, 'Sea LCL': 19800, Air: 9600 } },
  { id: 'cnsha-esvlc', label: 'Shanghai → Valencia', distance: { 'Sea FCL': 19400, 'Sea LCL': 19400, Air: 9300 } },
  { id: 'cnszx-esmad', label: 'Shenzhen → Madrid', distance: { 'Sea FCL': 20100, 'Sea LCL': 20100, Air: 10300 } },
  { id: 'esvlc-macas', label: 'Valencia → Casablanca', distance: { 'Sea FCL': 1050, 'Sea LCL': 1050, Air: 900, Road: 1600 } },
  { id: 'esbcn-frlyn', label: 'Barcelona → Lyon', distance: { Road: 640, Rail: 690 } },
  { id: 'esvlc-nlrtm', label: 'Valencia → Rotterdam', distance: { 'Sea FCL': 3100, 'Sea LCL': 3100, Road: 2050, Rail: 2100 } },
];

export const MODES = Object.keys(INTENSITY) as FreightMode[];

export const emissionsReference: EmissionsReferenceDto = {
  lanes: LANE_DISTANCE.map(({ id, label, distance }) => ({
    id,
    label,
    modes: MODES.filter((mode) => distance[mode] !== undefined),
  })),
  modes: MODES,
  presets: [
    { id: 'pallet', tonnes: 0.8 },
    { id: 'fcl20', tonnes: 18 },
    { id: 'fcl40x2', tonnes: 34 },
    { id: 'airLcl', tonnes: 0.6 },
  ],
  basis: 'GLEC v3 · well to wheel',
};
