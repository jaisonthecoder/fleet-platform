import { ApiProperty } from '@nestjs/swagger';

/**
 * The lookup categories screens read from.
 *
 * Named here so a screen cannot invent a category string, and so a category
 * being renamed in the database is a compile error rather than an empty
 * dropdown. The list is code; the VALUES are data, maintained on the Lookups
 * screen - same rule as feature switches and settings.
 */
export const REFERENCE_CATEGORIES = {
  CARRIER: 'carrier',
  CHARGE_BASIS: 'charge_basis',
  CHARGE_CODE: 'charge_code',
  PACKAGE_TYPE: 'package_type',
  CONTAINER_TYPE: 'container_type',
  LOAD_TYPE: 'load_type',
  INCOTERM: 'incoterm',
  CURRENCY: 'currency',
  TRANSPORT_MODE: 'transport_mode',
  SERVICE_LEVEL: 'service_level',
  COMMODITY_GROUP: 'commodity_group',
  HAZARD_CLASS: 'hazard_class',
  DG_PACKING_GROUP: 'dg_packing_group',
  DG_PACKAGING_TYPE: 'dg_packaging_type',
  DG_TRANSPORT_REGIME: 'dg_transport_regime',
  DG_QUANTITY_UNIT: 'dg_quantity_unit',
  REEFER_VENTILATION: 'reefer_ventilation',
  REEFER_DATA_LOGGER: 'reefer_data_logger',
  LIFTING_METHOD: 'lifting_method',
  COUNTRY: 'country',
  WEIGHT_UNIT: 'weight_unit',
  VOLUME_UNIT: 'volume_unit',
  DIMENSION_UNIT: 'dimension_unit',
} as const;

export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[keyof typeof REFERENCE_CATEGORIES];

export class ReferenceItemDto {
  @ApiProperty({ type: String, description: 'Stable code. Store this, not the label.' })
  code!: string;

  @ApiProperty({ type: String, description: "Translated for the caller's locale." })
  label!: string;

  /**
   * The second line a screen may draw under the label, translated.
   *
   * Unlike `metadata` this is maintained per locale on the Lookups screen, so it
   * is the right place for wording a customer reads - "Container or groupage"
   * under a Sea card. Null where nobody has written one.
   */
  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  /**
   * Figures the screen may display - container dimensions, indicative payload.
   *
   * Presentation only. No business rule may key off this: it is
   * administrator-editable data, so a validation depending on it would change
   * meaning without a deployment.
   */
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  metadata!: Record<string, unknown> | null;
}
