import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

import {
  CUSTOMER_QUOTE_BADGES,
  QUOTE_PIPELINE_SEGMENTS,
  QUOTE_STATUSES,
  TRANSPORT_MODES,
} from '../enums';

import { DangerousGoodsEntryDto } from './dangerous-goods.dto';
import { QuoteCargoDto, QuotePipelineSegmentDto } from './quote-listing.dto';
import { QuoteEquipmentDto } from './quote-equipment.dto';
import { OversizeItemDto, TemperatureControlDto } from './special-handling.dto';

/**
 * The customer's own view of a quotation.
 *
 * Deliberately a different shape from `PricingQuoteDto`, not a subset of it. The
 * two audiences see different things at different grains - the customer gets a
 * five-step journey whose fourth step is CargoWise confirming, while staff get a
 * five-stage workflow whose fourth stage is our own approval. Sharing one DTO and
 * nulling fields is how the internal one leaks.
 */

/** Customer-facing journey. NOT the staff stepper - step 4 differs. */
export const CUSTOMER_QUOTE_STAGES = [
  'requested',
  'claimed',
  'priced',
  'confirmed',
  'ready',
] as const;

export type CustomerQuoteStage = (typeof CUSTOMER_QUOTE_STAGES)[number];

/**
 * How far along the customer's journey a status sits, as a count of completed
 * steps. Computed here rather than in the browser so the two cannot drift.
 */
export function customerStageFor(status: string): number {
  switch (status) {
    case 'draft':
      return 0;
    case 'requested':
    case 'submitted':
      return 1;
    case 'claimed':
      return 2;
    case 'priced':
    case 'approved':
    case 'pending_sync':
      return 3;
    case 'published':
    case 'quoted':
    case 'rated':
    case 'accepted':
    case 'rejected':
      // Published means confirmed and released together: with pubMode 'direct'
      // there is nothing behind step 4, and with 'cw1' it happened before release.
      return 5;
    default:
      return 0;
  }
}

export class CustomerQuoteChargeLineDto {
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  basis!: string | null;

  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({ type: Number, description: 'Minor units.' })
  amountMinorUnits!: number;

  @ApiProperty({ type: String })
  currency!: string;
}

export class CustomerQuoteOptionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number })
  position!: number;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when the branch does not disclose the carrier before booking.',
  })
  carrierName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  serviceRouting!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  transitDaysMin!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  transitDaysMax!: number | null;

  @ApiProperty({ type: String, nullable: true })
  nextDepartures!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  freeTimeDays!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  totalMinorUnits!: number | null;

  @ApiProperty({ type: String, nullable: true })
  currency!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  validUntil!: string | null;

  @ApiProperty({ type: Boolean })
  isRecommended!: boolean;

  @ApiProperty({
    type: Boolean,
    description:
      'Past its validity. Decided by the server clock, because that is the clock that will refuse the acceptance.',
  })
  isExpired!: boolean;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true })
  termsIncluded!: string | null;

  @ApiProperty({ type: String, nullable: true })
  termsExcluded!: string | null;

  @ApiProperty({ type: String, nullable: true })
  termsPayment!: string | null;

  @ApiProperty({ type: String, nullable: true })
  termsSubjectTo!: string | null;

  @ApiProperty({ type: [CustomerQuoteChargeLineDto], description: 'Never carries cost or margin.' })
  chargeLines!: CustomerQuoteChargeLineDto[];
}

export class CustomerQuoteSummaryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  reference!: string;

  @ApiProperty({
    enum: CUSTOMER_QUOTE_BADGES,
    description: 'Coarse grain. claimed, priced and approved all collapse to in_progress.',
  })
  statusBadge!: string;

  @ApiProperty({ enum: TRANSPORT_MODES })
  mode!: string;

  @ApiProperty({ type: String })
  originCode!: string;

  @ApiProperty({ type: String })
  destinationCode!: string;

  @ApiProperty({ type: String, nullable: true })
  customerReference!: string | null;

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Null until published.' })
  totalMinorUnits!: number | null;

  @ApiProperty({ type: String, nullable: true })
  currency!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  validUntil!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: Number, description: 'Options the customer can see. Zero before publication.' })
  optionCount!: number;

  @ApiProperty({ type: Boolean, description: 'Published, in date, and not yet answered.' })
  awaitingDecision!: boolean;

  @ApiProperty({
    type: QuoteCargoDto,
    description: 'What is being moved, in parts. The browser writes the caption.',
  })
  cargo!: QuoteCargoDto;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Whole days until the offer lapses, floored. Null when nothing has been published. Zero or less means it has lapsed.',
  })
  daysRemaining!: number | null;

  @ApiProperty({
    enum: QUOTE_PIPELINE_SEGMENTS,
    description:
      'Which band of the pipeline this row belongs to. Derived by the server so the segment count, the segment filter and the row agree.',
  })
  pipelineSegment!: string;
}

export class CustomerQuoteDto extends CustomerQuoteSummaryDto {
  @ApiProperty({ enum: QUOTE_STATUSES, description: 'The raw status. Use statusBadge for display.' })
  status!: string;

  @ApiProperty({ enum: CUSTOMER_QUOTE_STAGES })
  stage!: string;

  @ApiProperty({ type: Number, description: 'Completed steps of the five-step journey.' })
  stageIndex!: number;

  @ApiProperty({ type: String, nullable: true })
  incoterm!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'load_type lookup code; absent for air.' })
  loadType!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readyDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  serviceLevel!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  grossWeightKg!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  volumeM3!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  chargeableKg!: number | null;

  @ApiProperty({ type: String, nullable: true, description: "The customer's own remarks." })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The covering message, once published.' })
  messageToCustomer!: string | null;

  @ApiProperty({ type: Object, description: 'The request as submitted, for review and for copying.' })
  payload!: unknown;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The option the customer accepted.' })
  acceptedOptionId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Why the customer declined.' })
  declineReason!: string | null;

  @ApiProperty({ type: [CustomerQuoteOptionDto], description: 'Empty until published.' })
  options!: CustomerQuoteOptionDto[];

  @ApiProperty({
    type: [DangerousGoodsEntryDto],
    description: 'What the customer declared. Shown back to them so they can check it.',
  })
  dangerousGoods!: DangerousGoodsEntryDto[];

  @ApiProperty({ type: [QuoteEquipmentDto], description: 'Empty unless a full-load request.' })
  equipment!: QuoteEquipmentDto[];

  @ApiProperty({ type: TemperatureControlDto, nullable: true })
  temperatureControl!: TemperatureControlDto | null;

  @ApiProperty({ type: [OversizeItemDto] })
  oversizeItems!: OversizeItemDto[];
}

export class CustomerQuoteListDto {
  @ApiProperty({ type: [CustomerQuoteSummaryDto] })
  items!: CustomerQuoteSummaryDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({
    type: [QuotePipelineSegmentDto],
    description:
      'The pipeline band. Counted across everything the customer may see, ignoring the segment filter itself, so picking a segment does not erase the others.',
  })
  pipeline!: QuotePipelineSegmentDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "The signed-in customer's own name, for the band's eyebrow. Resolved under the caller's own tenancy, so it can only ever be their own.",
  })
  customerName!: string | null;
}

/**
 * What an instant rate answers with.
 *
 * Deliberately not `CustomerQuoteDto`: that projection withholds every figure until
 * publication, so returning it here would answer a rate request with no rate. A rated
 * quote is still a draft the customer has to send.
 */
export class QuoteRateResultDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number, description: 'Minor units.' })
  totalMinorUnits!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  validUntil!: string;
}

/** What creating a draft answers with. Enough to navigate to it, and nothing more. */
export class QuoteCreatedDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  reference!: string;

  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;
}

/** The shape every status-changing customer route answers with. */
export class QuoteStatusResultDto {
  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;
}

/**
 * Accepting names the option AND the version.
 *
 * The version matters: a customer reading version 1 while a pricer publishes
 * version 2 must not accept a price nobody is offering any more. The service
 * refuses with 409 rather than quietly binding them to the new one.
 */
export const acceptQuoteSchema = z.object({
  optionId: z.string().uuid(),
  version: z.number().int().positive(),
});

export const declineQuoteSchema = z.object({
  // The SPA sends null when the box is empty; the DTO below already advertises nullable,
  // so refusing null here made declining without a reason impossible.
  reason: z
    .string()
    .trim()
    .max(400)
    .nullish()
    .transform((value) => value ?? undefined),
});

export class AcceptQuoteDto {
  @ApiProperty({ type: String, format: 'uuid' })
  optionId!: string;

  @ApiProperty({ type: Number, description: 'The version the customer was looking at.' })
  version!: number;
}

export class DeclineQuoteDto {
  @ApiProperty({ type: String, nullable: true, maxLength: 400 })
  reason!: string | null;
}
