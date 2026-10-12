import { ApiProperty } from '@nestjs/swagger';

/**
 * What the quotations landing page reports about this customer's quoting.
 *
 * MOSTLY REAL, AND IT SAYS WHICH PARTS ARE NOT.
 *
 * Unlike the dashboard, most of this comes from the `quote` table the platform
 * already owns: how many are open, which expires next, how long pricing took,
 * what was accepted, the recent list and the lanes worth repeating. Those are
 * facts.
 *
 * Three things on the page are not, and cannot be yet:
 *
 *  - `savedVsSpot` and `rateLanes` need a rate store and a market feed. v4 rule
 *    1 says neither exists anywhere in the organisation, and the instant-rate
 *    interface has no configured source.
 *  - `instantPercent` counts quotes answered from a contract rate without a
 *    person. Nothing is priced that way today; a person prices every quote.
 *  - `booked` has no table. Bookings are a separate entity that has not been
 *    built.
 *
 * `sampled` names them so the screen can mark those panels and only those. One
 * global flag would have made the real figures look invented, and inventing
 * them quietly would be worse.
 */

/** Panels whose figures are generated rather than measured. */
export const QUOTE_INSIGHT_SAMPLED = ['saved_vs_spot', 'rate_lanes', 'instant_share', 'booked'] as const;

export class QuoteInsightKpisDto {
  @ApiProperty({ description: 'Requests with pricing still to come.' }) openRequests!: number;
  @ApiProperty({ description: 'Of those, how many already have options to read.' })
  withOptionsReady!: number;
  @ApiProperty({ description: 'Published quotes whose validity ends within seven days.' })
  expiringThisWeek!: number;
  @ApiProperty({ type: String, nullable: true, description: 'The soonest of them.' })
  expiringReference!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'ISO date it lapses.' })
  expiringOn!: string | null;
  @ApiProperty({ description: 'Accepted in the last twelve months.' }) accepted!: number;
  @ApiProperty({ description: 'Priced in the same window, the denominator for the rate.' })
  priced!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Median hours from request to published options. Null until anything has been priced.',
  })
  medianHoursToPrice!: number | null;
  @ApiProperty({ description: 'SAMPLED. Share answered from a contract rate with no person involved.' })
  instantPercent!: number;
  @ApiProperty({ description: 'SAMPLED. Minor units saved against market spot, year to date.' })
  savedVsSpotMinorUnits!: number;
}

export class QuoteInsightWaitingDto {
  @ApiProperty() id!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() originCode!: string;
  @ApiProperty() destinationCode!: string;
  @ApiProperty({ description: 'e.g. "Sea FCL · 2 x 40 HC · 3 options".' }) summary!: string;
  @ApiProperty({
    enum: ['options_ready', 'expiring', 'with_desk'],
    description: 'Which of the three states this card is in. Decides its rule and badge.',
  })
  state!: 'options_ready' | 'expiring' | 'with_desk';
  @ApiProperty({ description: 'The badge text, e.g. "Expires in 3 days".' }) badge!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Cheapest published option. Null while the request is still with the pricing desk.',
  })
  fromMinorUnits!: number | null;
  @ApiProperty({ type: String, nullable: true }) currency!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'ISO date the price stops holding.' })
  validUntil!: string | null;
  @ApiProperty({ type: Number, nullable: true }) daysLeft!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Who is pricing it, where a request is with the desk. Never an internal id.',
  })
  deskName!: string | null;
}

export class QuoteInsightFunnelStepDto {
  @ApiProperty({ description: 'requested | priced | accepted | booked.' }) key!: string;
  @ApiProperty({ type: Number, nullable: true, description: 'Null where the platform cannot count it yet.' })
  count!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Percent of the previous step that reached this one.',
  })
  movePercent!: number | null;
}

export class QuoteInsightRatePointDto {
  @ApiProperty() month!: string;
  @ApiProperty({ description: 'What this customer pays on contract, minor units.' })
  contractMinorUnits!: number;
  @ApiProperty({ description: 'SAMPLED. Market spot for the same lane and equipment.' })
  spotMinorUnits!: number;
}

export class QuoteInsightRateLaneDto {
  @ApiProperty() key!: string;
  @ApiProperty({ description: 'e.g. "CNTAO to ESVLC".' }) label!: string;
  @ApiProperty({ description: 'e.g. "40 HC".' }) basis!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ type: [QuoteInsightRatePointDto] }) points!: QuoteInsightRatePointDto[];
  @ApiProperty({ description: 'Average saving against spot across the window, whole percent.' })
  savingPercent!: number;
}

export class QuoteInsightSpeedModeDto {
  @ApiProperty({ description: 'A load type or handling case, e.g. "Sea FCL" or "Dangerous goods".' })
  key!: string;
  @ApiProperty({ type: Number, nullable: true, description: 'Median hours. Null when nothing has been priced.' })
  hours!: number | null;
  @ApiProperty({ description: 'SAMPLED. True where a contract rate answers without a person.' })
  instant!: boolean;
}

export class QuoteInsightRecentDto {
  @ApiProperty() id!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() originCode!: string;
  @ApiProperty() destinationCode!: string;
  @ApiProperty() mode!: string;
  @ApiProperty({ description: 'ISO date the request was sent.' }) sentAt!: string;
  @ApiProperty({ description: 'The pipeline segment key, for the pill.' }) status!: string;
  @ApiProperty({ type: Number, nullable: true }) priceMinorUnits!: number | null;
  @ApiProperty({ type: String, nullable: true }) currency!: string | null;
  @ApiProperty({ description: 'What happens next, or what happened, in one phrase.' }) next!: string;
}

export class QuoteInsightReuseDto {
  @ApiProperty() id!: string;
  @ApiProperty() originCode!: string;
  @ApiProperty() destinationCode!: string;
  @ApiProperty() mode!: string;
  @ApiProperty({ description: 'e.g. "Sea FCL · 2 x 40 HC".' }) summary!: string;
  @ApiProperty({ description: 'e.g. "Accepted 12 Sep".' }) outcome!: string;
}

export class QuoteInsightsDto {
  @ApiProperty() asOf!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({
    type: [String],
    description:
      'Panels whose figures are generated rather than measured. The screen marks these and only these.',
  })
  sampled!: string[];

  @ApiProperty({ type: QuoteInsightKpisDto }) kpis!: QuoteInsightKpisDto;
  @ApiProperty({ type: [QuoteInsightWaitingDto] }) waiting!: QuoteInsightWaitingDto[];
  @ApiProperty({ type: [QuoteInsightFunnelStepDto] }) funnel!: QuoteInsightFunnelStepDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The one thing worth saying about the funnel, e.g. how many lapsed unanswered.',
  })
  funnelNote!: string | null;
  @ApiProperty({ type: [QuoteInsightRateLaneDto] }) rateLanes!: QuoteInsightRateLaneDto[];
  @ApiProperty({ type: [QuoteInsightSpeedModeDto] }) speed!: QuoteInsightSpeedModeDto[];
  @ApiProperty({ type: [QuoteInsightRecentDto] }) recent!: QuoteInsightRecentDto[];
  @ApiProperty({ type: [QuoteInsightReuseDto] }) reuse!: QuoteInsightReuseDto[];
}
