import { ApiProperty } from '@nestjs/swagger';

import { QUOTE_PIPELINE_SEGMENTS, QUOTE_STATUSES, TRANSPORT_MODES } from '../enums';

import { DangerousGoodsEntryDto } from './dangerous-goods.dto';
import { QuoteCargoDto, QuotePipelineSegmentDto } from './quote-listing.dto';
import { QuoteEquipmentDto } from './quote-equipment.dto';
import { ReferenceItemDto } from './reference.dto';
import { OversizeItemDto, TemperatureControlDto } from './special-handling.dto';

/**
 * How a charge is counted. Free text in the database and in the API - there is no
 * charge-code catalogue and no standard set of bases in the business - but the
 * screen offers these, because a pricer typing "per container" from memory every
 * time is how you end up with four spellings of it in one report.
 *
 * Taken from ordinary sea and air forwarding practice, not invented:
 *  - W/M is "weight or measure", billed on whichever is greater. Standard on LCL.
 *  - Per B/L and per house are different things when a consolidation is split.
 *  - Percentage bases (ad valorem, insurance) are entered as a rate the pricer
 *    has already worked out; nothing here computes a percentage.
 */
export const CHARGE_BASES = [
  'Per container',
  'Per shipment',
  'Per B/L',
  'Per house B/L',
  'Per kg',
  'Per chargeable kg',
  'Per CBM',
  'Per W/M',
  'Per pallet',
  'Per document',
  'Per customs declaration',
  'Per HS code',
  'Per hour',
  'Per day',
  'Percentage',
  'Lump sum',
] as const;

export type ChargeBasis = (typeof CHARGE_BASES)[number];

export class PricingQueueEntryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  reference!: string;

  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;

  @ApiProperty({ enum: TRANSPORT_MODES })
  mode!: string;

  @ApiProperty({ type: String })
  originCode!: string;

  @ApiProperty({ type: String })
  destinationCode!: string;

  @ApiProperty({ type: String, nullable: true })
  customerName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  claimedById!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  claimedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  claimedByName!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Null when unclaimed. Lets the screen count down without re-deriving the setting.',
  })
  claimExpiresAt!: string | null;

  @ApiProperty({ type: Boolean, description: 'True when the acting user holds the claim.' })
  claimedByMe!: boolean;
}

/**
 * One row of the branch's quotation list.
 *
 * Extends the queue entry rather than replacing it: the queue answers "what is
 * waiting to be picked up" and keeps its narrow shape, while this answers
 * "everything this branch has quoted" and carries what the grid draws. A single
 * widened DTO would have made `GET /api/pricing/queue` advertise a dozen fields
 * it does not send.
 */
export class PricingQuotationDto extends PricingQueueEntryDto {
  @ApiProperty({ type: String, nullable: true, description: "The customer's own reference." })
  customerReference!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Servicing office for this customer. The quiet second line under the name.',
  })
  customerBranchName!: string | null;

  @ApiProperty({
    type: Number,
    description: 'How many quotations this customer has in total. Context, not a filter.',
  })
  customerQuoteCount!: number;

  @ApiProperty({ type: QuoteCargoDto })
  cargo!: QuoteCargoDto;

  @ApiProperty({ type: Number, nullable: true, description: 'Minor units. Null until priced.' })
  totalMinorUnits!: number | null;

  @ApiProperty({ type: String, nullable: true })
  currency!: string | null;

  @ApiProperty({ type: Number, description: 'Priced options on this quote.' })
  optionCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  validUntil!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Whole days until the offer lapses, floored. Null when nothing is published.',
  })
  daysRemaining!: number | null;

  @ApiProperty({ enum: QUOTE_PIPELINE_SEGMENTS })
  pipelineSegment!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Initials of whoever holds the work. Null when nobody does.',
  })
  ownerInitials!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Sell minus cost over sell, one decimal. Null unless cost capture is on, the caller holds pricing.cost.view, and a cost was actually recorded - it is never stored, only derived.',
  })
  marginPercent!: number | null;
}

/**
 * The branch's quotations, a page at a time.
 *
 * Paged where `GET /api/pricing/queue` is not, because that endpoint answers "what
 * is waiting for someone to pick up" and tops out at 200 rows on purpose, while
 * this one answers "everything this branch has quoted" and has no ceiling.
 */
export class PricingQuotationListDto {
  @ApiProperty({ type: [PricingQuotationDto] })
  items!: PricingQuotationDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({
    type: [QuotePipelineSegmentDto],
    description: 'Counted across the branch, ignoring the segment filter itself.',
  })
  pipeline!: QuotePipelineSegmentDto[];

  @ApiProperty({ type: Number, description: 'Quotations in the branch that nobody has claimed.' })
  unclaimed!: number;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether the margin column carries anything for this caller. False hides it rather than printing a column of dashes.',
  })
  maySeeMargin!: boolean;
}

export class QuoteChargeLineDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number })
  position!: number;

  @ApiProperty({ type: String, nullable: true })
  code!: string | null;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  basis!: string | null;

  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({ type: Number, description: 'Minor units.' })
  rateMinorUnits!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: Number, description: 'quantity x rate, computed by the API.' })
  amountMinorUnits!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Internal cost PER UNIT, mirroring rateMinorUnits beside it. Absent unless costCapture is on AND the caller holds pricing.cost.view.',
  })
  costMinorUnits!: number | null;
}

export class QuoteOptionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number })
  position!: number;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  carrierName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  serviceRouting!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  transitDaysMin!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  transitDaysMax!: number | null;

  @ApiProperty({ type: String, nullable: true })
  nextDepartures!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Free time at destination, in days.' })
  freeTimeDays!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Sum of the charge lines, minor units.' })
  totalMinorUnits!: number | null;

  @ApiProperty({ type: String, nullable: true })
  currency!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  validUntil!: string | null;

  @ApiProperty({ type: Boolean })
  isRecommended!: boolean;

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

  @ApiProperty({ type: [QuoteChargeLineDto] })
  chargeLines!: QuoteChargeLineDto[];

  @ApiProperty({ type: Number, nullable: true, description: 'Internal cost total. Null when not permitted.' })
  costTotalMinorUnits!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Derived, never stored: (sell - cost) / sell as a percentage. Null when cost is not permitted.',
  })
  marginPercent!: number | null;
}

export class PricingQuoteDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  reference!: string;

  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;

  @ApiProperty({ type: Number, description: 'Customer-visible. Bumped when a published quote is re-priced.' })
  version!: number;

  @ApiProperty({ enum: TRANSPORT_MODES })
  mode!: string;

  @ApiProperty({ type: String })
  originCode!: string;

  @ApiProperty({ type: String })
  destinationCode!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'FCL, LCL, FTL or LTL. Null where the mode carries no load type.',
  })
  loadType!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'From the port directory, so the lane can read Qingdao and not only CNTAO.',
  })
  originName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  destinationName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  incoterm!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readyDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  customerReference!: string | null;

  @ApiProperty({ type: String, nullable: true })
  serviceLevel!: string | null;

  @ApiProperty({ type: String, description: 'The currency the customer asked to be quoted in. A new option starts here.' })
  currency!: string;

  @ApiProperty({ type: String, nullable: true })
  customerName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The account the request was raised against, e.g. "Valencia office".',
  })
  accountName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'That account\'s CargoWise organisation code. Resolved here, never sent by the client.',
  })
  cw1OrgCode!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Who at the customer submitted it. Null once that user is removed.',
  })
  requestedByName!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  grossWeightKg!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  volumeM3!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  chargeableKg!: number | null;

  @ApiProperty({ type: String, nullable: true, description: "The CUSTOMER's remarks. Never written by staff." })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "The pricer's covering draft. Sent only on publish." })
  messageToCustomer!: string | null;

  @ApiProperty({ type: Object, description: 'Cargo lines and the long tail of the request, as submitted.' })
  payload!: unknown;

  @ApiProperty({
    type: [DangerousGoodsEntryDto],
    description: 'What the customer declared. Empty when the request carries none.',
  })
  dangerousGoods!: DangerousGoodsEntryDto[];

  @ApiProperty({
    type: [QuoteEquipmentDto],
    description: 'What a per-container charge multiplies by. Empty unless a full-load request.',
  })
  equipment!: QuoteEquipmentDto[];

  @ApiProperty({ type: TemperatureControlDto, nullable: true, description: 'Null unless a reefer.' })
  temperatureControl!: TemperatureControlDto | null;

  @ApiProperty({ type: [OversizeItemDto], description: 'Lifting equipment is quoted per piece.' })
  oversizeItems!: OversizeItemDto[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  claimedById!: string | null;

  @ApiProperty({ type: String, nullable: true })
  claimedByName!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  claimedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  claimExpiresAt!: string | null;

  @ApiProperty({ type: Boolean })
  claimedByMe!: boolean;

  @ApiProperty({ type: String, nullable: true })
  pricedByName!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'So the screen can honour the four-eyes rule.' })
  pricedById!: string | null;

  @ApiProperty({ type: Boolean, description: 'True when the acting user priced it and so may not approve it.' })
  pricedByMe!: boolean;

  @ApiProperty({ type: String, nullable: true })
  approvedByName!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  approvedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt!: string | null;

  @ApiProperty({ type: [QuoteOptionDto] })
  options!: QuoteOptionDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  // --- the resolved settings this quote is being worked under -------------
  // Returned with the quote rather than read separately, so the screen cannot
  // show one branch's rules while the API enforces another's.

  @ApiProperty({ type: Boolean, description: 'quotations.costCapture AND pricing.cost.view.' })
  canRecordCost!: boolean;

  @ApiProperty({ type: Boolean, description: 'quotations.disclose - does the customer see the carrier.' })
  disclosesCarrier!: boolean;

  @ApiProperty({ type: Number, description: 'Default validity in days, pre-filled on a new option.' })
  defaultValidityDays!: number;

  @ApiProperty({ type: Boolean, description: 'quotations.approval.' })
  approvalRequired!: boolean;

  @ApiProperty({ type: Number, description: 'Approval threshold in EUR minor units.' })
  approvalThresholdMinorUnits!: number;

  @ApiProperty({ enum: ['cw1', 'direct'], description: 'quotations.pubMode.' })
  publicationMode!: string;

  @ApiProperty({ type: [String], description: 'Suggested charge bases. A hint list, never validation.' })
  chargeBases!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Carriers from the `carrier` lookup, filtered to this quote\'s mode. A suggestion list: the field still accepts any name typed.',
  })
  carrierOptions!: string[];

  @ApiProperty({
    type: [ReferenceItemDto],
    description:
      'Charge codes from the `charge_code` lookup. Code and meaning both, because FRT tells a new pricer nothing. A suggestion list: the field still accepts any code typed.',
  })
  chargeCodes!: ReferenceItemDto[];

  @ApiProperty({
    type: [ReferenceItemDto],
    description: 'Currencies from the `currency` lookup, for the per-line currency column.',
  })
  currencyOptions!: ReferenceItemDto[];
}

export class ClaimResultDto {
  @ApiProperty({ type: String, format: 'date-time' })
  claimedAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  claimExpiresAt!: string;
}

export class PriceResultDto {
  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;

  @ApiProperty({ type: Number })
  version!: number;
}

export class ForceReleaseDto {
  @ApiProperty({ type: String, minLength: 3, maxLength: 400 })
  reason!: string;
}

export class SendBackDto {
  @ApiProperty({ type: String, minLength: 3, maxLength: 400, description: 'Shown to the pricer.' })
  reason!: string;
}

export class DecisionResultDto {
  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;
}

export class PublishResultDto {
  @ApiProperty({ enum: QUOTE_STATUSES })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  publishedAt!: string;
}

export class ChargeLineInputDto {
  @ApiProperty({ type: String, nullable: true, maxLength: 40 })
  code!: string | null;

  @ApiProperty({ type: String, maxLength: 240 })
  description!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 60 })
  basis!: string | null;

  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({ type: Number })
  rateMinorUnits!: number;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Refused unless cost capture is permitted.' })
  costMinorUnits!: number | null;
}

export class QuoteOptionInputDto {
  @ApiProperty({ type: String, nullable: true, maxLength: 120 })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true, maxLength: 160 })
  carrierName!: string | null;

  @ApiProperty({ type: String, nullable: true, maxLength: 240 })
  serviceRouting!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  transitDaysMin!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  transitDaysMax!: number | null;

  @ApiProperty({ type: String, nullable: true, maxLength: 120 })
  nextDepartures!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  freeTimeDays!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  validUntil!: string | null;

  @ApiProperty({ type: Boolean })
  isRecommended!: boolean;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true })
  termsIncluded!: string | null;

  @ApiProperty({ type: String, nullable: true })
  termsExcluded!: string | null;

  @ApiProperty({ type: String, nullable: true, maxLength: 400 })
  termsPayment!: string | null;

  @ApiProperty({ type: String, nullable: true, maxLength: 400 })
  termsSubjectTo!: string | null;

  @ApiProperty({ type: [ChargeLineInputDto] })
  chargeLines!: ChargeLineInputDto[];
}

export class PriceQuoteDto {
  @ApiProperty({ type: [QuoteOptionInputDto] })
  options!: QuoteOptionInputDto[];

  @ApiProperty({ type: String, nullable: true, maxLength: 8000 })
  messageToCustomer!: string | null;
}
