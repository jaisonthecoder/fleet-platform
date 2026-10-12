import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * The customer's analytics dashboard.
 *
 * One call for the whole screen. The page asks a single question — "how is my
 * freight going" — and answering it in eleven requests would make the screen
 * assemble itself in front of the customer, panel by panel, each with its own
 * spinner and its own chance to fail.
 *
 * WHAT IS REAL AND WHAT IS NOT
 *
 * `source` is not decoration. Shipments, milestones, invoices and transit times
 * are CargoWise's, and the tables that will hold them do not exist yet, so on a
 * pilot environment most of this is generated. A figure a customer reads as
 * their logistics spend must never be a figure we invented without saying so —
 * the screen prints the source, and every consumer of this DTO is expected to.
 *
 * The sample is DETERMINISTIC, derived from the tenant. A dashboard whose totals
 * change on every refresh is a dashboard nobody believes, including on a demo.
 */

export const DASHBOARD_PERIODS = ['3m', '6m', '12m'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Mode filter. `all` is the unfiltered dashboard, not a fourth mode. */
export const DASHBOARD_MODES = ['all', 'sea_fcl', 'sea_lcl', 'air'] as const;
export type DashboardMode = (typeof DASHBOARD_MODES)[number];

/** Where a shipment stands. The bar across "Shipments in flight" reads in this order. */
export const DASHBOARD_STAGES = [
  'booked',
  'at_origin',
  'in_transit',
  'at_destination',
  'in_customs',
] as const;

export const dashboardQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('12m'),
  mode: z.enum(DASHBOARD_MODES).default('all'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/* ── the things waiting on the customer ─────────────────────────────────── */

export class DashboardActionDto {
  @ApiProperty({ description: 'Stable key, e.g. "quote_decision". Picks the icon and the wording.' })
  key!: string;
  @ApiProperty() title!: string;
  @ApiProperty() detail!: string;
  @ApiProperty({ description: 'The deadline or state, e.g. "Expires in 10 days".' })
  badge!: string;
  @ApiProperty({
    enum: ['action', 'warning', 'info', 'neutral'],
    description: 'How urgent the badge reads. Never the only signal - the text says it too.',
  })
  tone!: 'action' | 'warning' | 'info' | 'neutral';
  @ApiProperty({ description: 'What the customer does about it, e.g. "Review".' })
  cta!: string;
  @ApiProperty({ description: 'In-app path. Empty when the destination has not shipped.' })
  href!: string;
}

/* ── the five tiles ────────────────────────────────────────────────────── */

export class DashboardKpiDto {
  @ApiProperty({ description: 'One of shipments | on_time | door_to_door | spend | balance.' })
  key!: string;
  @ApiProperty({ description: 'Already formatted, e.g. "EUR 384k" or "30.3". The server owns rounding.' })
  value!: string;
  @ApiProperty({ type: String, nullable: true, description: 'e.g. "days". Null when the value carries its own.' })
  unit!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'e.g. "17%" or "3.8 pts". Null when there is nothing to compare with.' })
  delta!: string | null;
  @ApiProperty({
    enum: ['up', 'down', 'flat', 'none'],
    description: 'Direction of travel only. Whether up is good is the tile\'s business, not the arrow\'s.',
  })
  deltaDirection!: 'up' | 'down' | 'flat' | 'none';
  @ApiProperty({
    enum: ['good', 'bad', 'neutral'],
    description: 'What the change means for the customer, decided here so the screen never guesses.',
  })
  deltaTone!: 'good' | 'bad' | 'neutral';
  @ApiProperty({ type: String, nullable: true, description: 'The quiet line, e.g. "vs prior 12 months" or "target 90%".' })
  caption!: string | null;
  @ApiProperty({ type: [Number], description: 'The sparkline, oldest first. Empty when there is no history.' })
  spark!: number[];
}

/* ── shipments and spend by month ──────────────────────────────────────── */

export class DashboardMonthDto {
  @ApiProperty({ description: 'First day of the month, ISO date.' }) month!: string;
  @ApiProperty() seaFcl!: number;
  @ApiProperty() seaLcl!: number;
  @ApiProperty() air!: number;
  @ApiProperty({ description: 'Minor units of the dashboard currency.' }) spendMinorUnits!: number;
}

export class DashboardModeSliceDto {
  @ApiProperty({ enum: ['sea_fcl', 'sea_lcl', 'air'] }) mode!: 'sea_fcl' | 'sea_lcl' | 'air';
  @ApiProperty() shipments!: number;
  @ApiProperty() spendMinorUnits!: number;
}

/* ── what is moving right now ──────────────────────────────────────────── */

export class DashboardStageDto {
  @ApiProperty({ description: 'One of booked | at_origin | in_transit | at_destination | in_customs.' })
  key!: string;
  @ApiProperty() count!: number;
}

export class DashboardArrivalDto {
  @ApiProperty({ description: 'ISO date of the expected arrival or next event.' }) date!: string;
  @ApiProperty({ description: 'Container, booking or air waybill reference.' }) reference!: string;
  @ApiProperty({ description: 'e.g. "CNTAO to ESVLC · 40 HC".' }) lane!: string;
  @ApiProperty({ description: 'The one sentence that says where it is.' }) note!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ enum: ['good', 'warning', 'action', 'neutral'] })
  tone!: 'good' | 'warning' | 'action' | 'neutral';
}

export class DashboardInFlightDto {
  @ApiProperty({ type: [DashboardStageDto] }) stages!: DashboardStageDto[];
  @ApiProperty({ type: [DashboardArrivalDto] }) arrivingNext!: DashboardArrivalDto[];
  @ApiProperty({ description: 'Delivered in the last 30 days, for the caption.' }) deliveredRecently!: number;
}

/* ── on-time arrival ───────────────────────────────────────────────────── */

export class DashboardOnTimePointDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'Whole percent arrived inside the quoted window.' }) percent!: number;
}

export class DashboardOnTimeDto {
  @ApiProperty() percent!: number;
  @ApiProperty() targetPercent!: number;
  @ApiProperty() monthsOnTarget!: number;
  @ApiProperty({ type: [DashboardOnTimePointDto] }) points!: DashboardOnTimePointDto[];
}

/* ── how long a lane actually takes ────────────────────────────────────── */

export class DashboardTransitDto {
  @ApiProperty({ description: 'e.g. "CNTAO to ESVLC".' }) lane!: string;
  @ApiProperty({ description: 'The transit a pricing specialist quoted, in days.' }) quotedMinDays!: number;
  @ApiProperty() quotedMaxDays!: number;
  @ApiProperty({ description: 'What actually happened, fastest and slowest.' }) actualMinDays!: number;
  @ApiProperty() actualMaxDays!: number;
  @ApiProperty() averageDays!: number;
}

/* ── lane performance ──────────────────────────────────────────────────── */

export class DashboardLaneDto {
  @ApiProperty() originCode!: string;
  @ApiProperty() originName!: string;
  @ApiProperty() destinationCode!: string;
  @ApiProperty() destinationName!: string;
  @ApiProperty({ enum: ['sea_fcl', 'sea_lcl', 'air'] }) mode!: 'sea_fcl' | 'sea_lcl' | 'air';
  @ApiProperty() shipments!: number;
  @ApiProperty() averageTransitDays!: number;
  @ApiProperty() quotedMinDays!: number;
  @ApiProperty() quotedMaxDays!: number;
  @ApiProperty() onTimePercent!: number;
  @ApiProperty() spendMinorUnits!: number;
  @ApiProperty({ type: [Number], description: 'Spend by month on this lane, oldest first.' })
  trend!: number[];
  @ApiProperty({ description: 'Share of total spend, whole percent.' }) sharePercent!: number;
}

/* ── where the money goes ──────────────────────────────────────────────── */

export class DashboardSpendSliceDto {
  @ApiProperty({ description: 'Charge group key, e.g. "freight". Mapped, never a CargoWise code.' })
  key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() amountMinorUnits!: number;
  @ApiProperty() percent!: number;
  @ApiProperty({
    enum: ['primary', 'info', 'neutral', 'warning', 'action'],
    description: 'Which rail colour the slice takes. Avoidable cost is drawn in the action colour.',
  })
  tone!: 'primary' | 'info' | 'neutral' | 'warning' | 'action';
}

export class DashboardSpendDto {
  @ApiProperty() totalMinorUnits!: number;
  @ApiProperty({ type: [DashboardSpendSliceDto] }) slices!: DashboardSpendSliceDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The one thing worth saying about the split, e.g. what demurrage cost and why.',
  })
  note!: string | null;
}

/* ── money owed ────────────────────────────────────────────────────────── */

export class DashboardAgeingBucketDto {
  @ApiProperty({ description: 'current | 1_30 | 31_60 | 61_90 | 90_plus.' }) bucket!: string;
  @ApiProperty() amountMinorUnits!: number;
}

export class DashboardInvoicesDto {
  @ApiProperty() openMinorUnits!: number;
  @ApiProperty({ description: 'Payment terms in days, for the caption.' }) termsDays!: number;
  @ApiProperty({ type: [DashboardAgeingBucketDto] }) ageing!: DashboardAgeingBucketDto[];
  @ApiProperty() creditUsedMinorUnits!: number;
  @ApiProperty() creditLimitMinorUnits!: number;
  @ApiProperty({ description: 'Overdue past terms, the figure the balance tile warns on.' })
  overdueMinorUnits!: number;
}

/* ── emissions ─────────────────────────────────────────────────────────── */

export class DashboardEmissionMonthDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'Tonnes of CO2e.' }) tonnes!: number;
}

export class DashboardEmissionModeDto {
  @ApiProperty({ enum: ['sea_fcl', 'sea_lcl', 'air'] }) mode!: 'sea_fcl' | 'sea_lcl' | 'air';
  @ApiProperty({ description: 'Share of total emissions, whole percent.' }) percent!: number;
}

export class DashboardEmissionsDto {
  @ApiProperty() totalTonnes!: number;
  @ApiProperty({ description: 'The methodology, e.g. "Well to wheel, GLEC-aligned estimate".' })
  basis!: string;
  @ApiProperty({ type: [DashboardEmissionMonthDto] }) monthly!: DashboardEmissionMonthDto[];
  @ApiProperty({ type: [DashboardEmissionModeDto] }) byMode!: DashboardEmissionModeDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The comparison worth making, e.g. air being a small share of moves and a large share of carbon.',
  })
  note!: string | null;
}

/* ── the whole screen ──────────────────────────────────────────────────── */

export class DashboardAnalyticsDto {
  @ApiProperty({ description: 'When the figures were last refreshed from the system of record.' })
  asOf!: string;
  @ApiProperty({
    enum: ['cargowise', 'sample'],
    description:
      'Where these figures came from. `sample` means generated for a pilot environment and must be said so on screen - a customer reading an invented spend as their own is the failure this field exists to prevent.',
  })
  source!: 'cargowise' | 'sample';
  @ApiProperty({ enum: DASHBOARD_PERIODS }) period!: DashboardPeriod;
  @ApiProperty({ enum: DASHBOARD_MODES }) mode!: DashboardMode;
  @ApiProperty({ description: 'ISO 4217, e.g. EUR. Every minor-unit figure on this DTO is in it.' })
  currency!: string;

  @ApiProperty() customerName!: string;
  @ApiProperty({ description: 'The viewer\'s first name, for the greeting.' }) firstName!: string;
  @ApiProperty({ type: [String], description: 'Offices this account sees, for the subtitle.' })
  officeNames!: string[];

  @ApiProperty({ description: 'In flight right now, across every mode.' }) inFlightCount!: number;
  @ApiProperty({ description: 'Arriving in the next ten days.' }) arrivingSoonCount!: number;

  @ApiProperty({ type: [DashboardActionDto] }) actions!: DashboardActionDto[];
  @ApiProperty({ type: [DashboardKpiDto] }) kpis!: DashboardKpiDto[];
  @ApiProperty({ type: [DashboardMonthDto] }) monthly!: DashboardMonthDto[];
  @ApiProperty({ type: [DashboardModeSliceDto] }) modeMix!: DashboardModeSliceDto[];
  @ApiProperty({ type: DashboardInFlightDto }) inFlight!: DashboardInFlightDto;
  @ApiProperty({ type: DashboardOnTimeDto }) onTime!: DashboardOnTimeDto;
  @ApiProperty({ type: [DashboardTransitDto] }) transit!: DashboardTransitDto[];
  @ApiProperty({ type: [DashboardLaneDto] }) lanes!: DashboardLaneDto[];
  @ApiProperty({ type: DashboardSpendDto }) spend!: DashboardSpendDto;
  @ApiProperty({ type: DashboardInvoicesDto }) invoices!: DashboardInvoicesDto;
  @ApiProperty({ type: DashboardEmissionsDto }) emissions!: DashboardEmissionsDto;
}
