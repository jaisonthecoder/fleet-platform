import { ApiProperty } from '@nestjs/swagger';

/**
 * Reefer settings, as both audiences see them.
 *
 * Nothing internal on a temperature: the customer stated it and the pricer needs
 * it to price a reefer and to order a genset for a road leg.
 */
export class TemperatureControlDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number, description: 'Celsius. Negative is ordinary.' })
  setPointCelsius!: number;

  @ApiProperty({
    type: Number, nullable: true,
    description: 'Plus or minus. Zero means none, which differs from not stated.',
  })
  toleranceCelsius!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'reefer_ventilation lookup code.' })
  ventilation!: string | null;

  @ApiProperty({ type: Boolean })
  controlledAtmosphere!: boolean;

  @ApiProperty({ type: Boolean })
  preCoolingRequired!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'reefer_data_logger lookup code.' })
  dataLogger!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;
}

/** One oversized or heavy piece. Lifting equipment is quoted from these. */
export class OversizeItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number })
  position!: number;

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

  @ApiProperty({ type: String, nullable: true, description: 'lifting_method lookup code.' })
  liftingMethod!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;
}

const decimal = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

interface TemperatureRow {
  id: string;
  setPointCelsius: unknown;
  toleranceCelsius: unknown;
  ventilation: string | null;
  controlledAtmosphere: boolean;
  preCoolingRequired: boolean;
  dataLogger: string | null;
  notes: string | null;
}

export function temperatureControlFor(row: TemperatureRow | null): TemperatureControlDto | null {
  if (row === null) return null;

  return {
    id: row.id,
    setPointCelsius: decimal(row.setPointCelsius),
    toleranceCelsius:
      row.toleranceCelsius === null || row.toleranceCelsius === undefined
        ? null
        : Number(row.toleranceCelsius),
    ventilation: row.ventilation,
    controlledAtmosphere: row.controlledAtmosphere,
    preCoolingRequired: row.preCoolingRequired,
    dataLogger: row.dataLogger,
    notes: row.notes,
  };
}

interface OversizeRow {
  id: string;
  position: number;
  description: string;
  lengthCm: unknown;
  widthCm: unknown;
  heightCm: unknown;
  weightKg: unknown;
  liftingMethod: string | null;
  notes: string | null;
}

export function oversizeItemsFor(rows: OversizeRow[]): OversizeItemDto[] {
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    description: row.description,
    lengthCm: decimal(row.lengthCm),
    widthCm: decimal(row.widthCm),
    heightCm: decimal(row.heightCm),
    weightKg: decimal(row.weightKg),
    liftingMethod: row.liftingMethod,
    notes: row.notes,
  }));
}
