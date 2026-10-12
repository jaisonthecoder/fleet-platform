import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { INCOTERMS_2020, TRANSPORT_MODES } from '../enums';
import { PACKING_GROUPS } from '../schemas/quote.schema';

/**
 * The request body for creating a quote, declared so OpenAPI emits it.
 *
 * These classes exist ONLY so `@ApiBody({ type })` has something to point at.
 * Zod still does the validating - `createQuoteSchema` is the single rulebook, and
 * these must mirror it. They are not decoration: without them Nest emits no
 * requestBody at all, the generated client types the body `never`, the SPA casts
 * it away, and a mistake as basic as putting a lookup label into a code field
 * reaches production with nothing to catch it. That happened. This is the fix.
 */
export class PackageLineInputDto {
  @ApiProperty({
    required: false,
    description: 'Stable id for this line, so a dangerous goods entry can name it.',
  })
  lineId?: string;

  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({ type: String })
  packageType!: string;

  @ApiProperty({ type: Number, required: false })
  lengthCm?: number;

  @ApiProperty({ type: Number, required: false })
  widthCm?: number;

  @ApiProperty({ type: Number, required: false })
  heightCm?: number;

  @ApiProperty({ type: Number })
  weightKg!: number;

  @ApiProperty({ type: String, required: false })
  description?: string;
}

/**
 * One dangerous goods entry as submitted.
 *
 * `hazardClass` is the lookup CODE - '3', not 'Class 3 - Flammable liquids'. The
 * column is varchar(8) and the flashpoint rule compares against the code, so a
 * label breaks both. Stated here because this type is what the SPA now compiles
 * against.
 */
export class DangerousGoodsInputDto {
  @ApiProperty({ type: String, example: '1263', description: 'Four digits.' })
  unNumber!: string;

  @ApiProperty({ type: String, example: '3', description: 'hazard_class lookup code.' })
  hazardClass!: string;

  @ApiProperty({ type: String })
  properShippingName!: string;

  @ApiProperty({ type: [String], required: false, description: 'hazard_class codes.' })
  subsidiaryRisks?: string[];

  @ApiProperty({ enum: PACKING_GROUPS, description: "'NONE' where the entry is not assigned one." })
  packingGroup!: (typeof PACKING_GROUPS)[number];

  @ApiProperty({ type: String, required: false, description: 'Required for an n.o.s. entry.' })
  technicalName?: string;

  @ApiProperty({ type: Number, required: false, description: 'Required when class 3 applies.' })
  flashpointCelsius?: number;

  @ApiProperty({ type: String, required: false })
  emsCode?: string;

  @ApiProperty({ type: Boolean, required: false })
  isMarinePollutant?: boolean;

  @ApiProperty({ type: String })
  packagingType!: string;

  @ApiProperty({ type: String, required: false })
  unPackagingCode?: string;

  @ApiProperty({ type: Number })
  packageCount!: number;

  @ApiProperty({ type: Number })
  netQuantityPerPackage!: number;

  @ApiProperty({ type: String, description: 'dg_quantity_unit lookup code.' })
  quantityUnit!: string;

  @ApiProperty({ type: String, required: false, description: 'dg_transport_regime lookup code.' })
  transportRegime?: string;

  @ApiProperty({ type: Boolean, required: false })
  isInOverpack?: boolean;

  @ApiProperty({ type: [String], description: 'lineId values this entry travels in. At least one.' })
  appliesToLines!: string[];

  @ApiProperty({ type: String, required: false })
  notes?: string;
}

/**
 * One container type and how many of them.
 *
 * `unitId` shares a namespace with a package line's `lineId`, so a dangerous
 * goods entry can name a container as the cargo it sits in. `containerType` is
 * the lookup CODE - '40HC', not '40ft high cube'.
 */
export class EquipmentInputDto {
  @ApiProperty({ type: String, description: 'Stable id within this request.' })
  unitId!: string;

  @ApiProperty({ type: String, example: '40HC', description: 'container_type lookup code.' })
  containerType!: string;

  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({
    type: Number, required: false,
    description: 'Expected load per container. Indicative; nothing refuses on it.',
  })
  grossWeightPerUnitKg?: number;

  @ApiProperty({ type: String, required: false })
  notes?: string;
}

/** Reefer settings. One per request; its presence is what makes it a reefer. */
export class TemperatureControlInputDto {
  @ApiProperty({ type: Number, description: 'Celsius, -70 to 40. Negative is ordinary.' })
  setPointCelsius!: number;

  @ApiProperty({ type: Number, required: false, description: 'Plus or minus. Zero is valid.' })
  toleranceCelsius?: number;

  @ApiProperty({ type: String, required: false, description: 'reefer_ventilation lookup code.' })
  ventilation?: string;

  @ApiProperty({ type: Boolean, required: false })
  controlledAtmosphere?: boolean;

  @ApiProperty({ type: Boolean, required: false })
  preCoolingRequired?: boolean;

  @ApiProperty({ type: String, required: false, description: 'reefer_data_logger lookup code.' })
  dataLogger?: string;

  @ApiProperty({ type: String, required: false })
  notes?: string;
}

/** One oversized or heavy piece. Every figure is required; a crane is ordered from it. */
export class OversizeItemInputDto {
  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: Number })
  lengthCm!: number;

  @ApiProperty({ type: Number })
  widthCm!: number;

  @ApiProperty({ type: Number })
  heightCm!: number;

  @ApiProperty({ type: Number })
  weightKg!: number;

  @ApiProperty({ type: String, required: false, description: 'lifting_method lookup code.' })
  liftingMethod?: string;

  @ApiProperty({ type: String, required: false })
  notes?: string;
}

export class CreateQuoteDto {
  @ApiProperty({ type: String, format: 'uuid', required: false })
  accountId?: string;

  @ApiProperty({ enum: TRANSPORT_MODES })
  mode!: (typeof TRANSPORT_MODES)[number];

  @ApiProperty({
    type: String, required: false, example: 'FCL',
    description: 'load_type lookup code. FCL and FTL require at least one container.',
  })
  loadType?: string;

  @ApiProperty({ type: String, example: 'CNTAO', description: 'UN/LOCODE.' })
  originCode!: string;

  @ApiProperty({ type: String, example: 'ESVLC', description: 'UN/LOCODE.' })
  destinationCode!: string;

  @ApiProperty({ type: String, example: 'Ceramic tiles', description: 'What is being shipped.' })
  commodity!: string;

  @ApiProperty({ type: Number })
  grossWeightKg!: number;

  @ApiProperty({ type: Number, required: false })
  volumeM3?: number;

  @ApiProperty({ type: String, required: false, default: 'EUR' })
  currency?: string;

  @ApiProperty({ type: [PackageLineInputDto], required: false })
  packages?: PackageLineInputDto[];

  @ApiProperty({ enum: INCOTERMS_2020, required: false })
  incoterm?: (typeof INCOTERMS_2020)[number];

  @ApiProperty({ type: String, format: 'date-time', required: false })
  readyDate?: string;

  @ApiProperty({ type: String, required: false })
  customerReference?: string;

  @ApiProperty({ type: String, required: false })
  serviceLevel?: string;

  @ApiProperty({ type: String, required: false, description: "The customer's own remarks." })
  notes?: string;

  @ApiProperty({ type: [DangerousGoodsInputDto], required: false })
  dangerousGoods?: DangerousGoodsInputDto[];

  @ApiProperty({ type: [EquipmentInputDto], required: false })
  equipment?: EquipmentInputDto[];

  @ApiProperty({ type: TemperatureControlInputDto, required: false })
  temperatureControl?: TemperatureControlInputDto;

  @ApiProperty({ type: [OversizeItemInputDto], required: false })
  oversizeItems?: OversizeItemInputDto[];

  // Raw schema form, so `required` here would mean JSON Schema's required list.
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'The long tail of the request: handling flags, customs data, parties.',
  })
  payload?: Record<string, unknown>;
}
