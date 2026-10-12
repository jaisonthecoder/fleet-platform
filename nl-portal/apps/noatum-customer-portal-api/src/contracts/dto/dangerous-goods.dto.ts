import { ApiProperty } from '@nestjs/swagger';

/**
 * One dangerous goods entry, as both audiences see it.
 *
 * Shared between the customer's own quote and the pricing screen, which is safe
 * here where it is not for the quote itself: there is nothing internal on a
 * hazard. The customer declared every field, and the pricer must see exactly
 * what was declared - a projection that quietly dropped one would be the
 * difference between a priced shipment and a refused one.
 *
 * Not a dangerous goods declaration. See `quote_dangerous_goods` in the schema.
 */
export class DangerousGoodsEntryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number, description: 'Order as entered, from 1.' })
  position!: number;

  @ApiProperty({ type: String, example: '1263' })
  unNumber!: string;

  @ApiProperty({ type: String, example: '3', description: 'Class or division code.' })
  hazardClass!: string;

  @ApiProperty({ type: String })
  properShippingName!: string;

  @ApiProperty({ type: [String], description: 'Further hazards the substance also presents.' })
  subsidiaryRisks!: string[];

  @ApiProperty({ type: String, nullable: true, description: "'NONE' where the entry is not assigned one." })
  packingGroup!: string | null;

  @ApiProperty({ type: String, nullable: true })
  technicalName!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  flashpointCelsius!: number | null;

  @ApiProperty({ type: String, nullable: true })
  emsCode!: string | null;

  @ApiProperty({ type: Boolean })
  isMarinePollutant!: boolean;

  @ApiProperty({ type: String, nullable: true })
  packagingType!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'UN packaging code, e.g. 1A1.' })
  unPackagingCode!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  packageCount!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  netQuantityPerPackage!: number | null;

  @ApiProperty({ type: String, nullable: true })
  quantityUnit!: string | null;

  @ApiProperty({ type: String, nullable: true })
  transportRegime!: string | null;

  @ApiProperty({ type: Boolean })
  isInOverpack!: boolean;

  @ApiProperty({
    type: [String],
    description: 'lineId values from payload.packages - which cargo holds this entry.',
  })
  appliesToLines!: string[];

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;
}

interface DangerousGoodsRow {
  id: string;
  position: number;
  unNumber: string;
  hazardClass: string;
  properShippingName: string | null;
  subsidiaryRisks: string[];
  packingGroup: string | null;
  technicalName: string | null;
  flashpointCelsius: unknown;
  emsCode: string | null;
  isMarinePollutant: boolean;
  packagingType: string | null;
  unPackagingCode: string | null;
  packageCount: number | null;
  netQuantityPerPackage: unknown;
  quantityUnit: string | null;
  transportRegime: string | null;
  isInOverpack: boolean;
  appliesToLines: string[];
  notes: string | null;
}

/** Prisma returns Decimal for the two numeric columns; JSON has no such type. */
const decimal = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/**
 * An allow-list, not a spread.
 *
 * This runs inside the customer projection, so a spread shipped `quoteId`, `createdAt`
 * and `updatedAt` - and would ship every future column automatically. The quote-level
 * projection was rewritten for exactly that reason; stopping one level short would have
 * left the same hole open underneath it.
 */
export function dangerousGoodsFor(rows: DangerousGoodsRow[]): DangerousGoodsEntryDto[] {
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    unNumber: row.unNumber,
    hazardClass: row.hazardClass,
    properShippingName: row.properShippingName ?? '',
    subsidiaryRisks: row.subsidiaryRisks,
    packingGroup: row.packingGroup,
    technicalName: row.technicalName,
    flashpointCelsius: decimal(row.flashpointCelsius),
    emsCode: row.emsCode,
    isMarinePollutant: row.isMarinePollutant,
    packagingType: row.packagingType,
    unPackagingCode: row.unPackagingCode,
    packageCount: row.packageCount,
    netQuantityPerPackage: decimal(row.netQuantityPerPackage),
    quantityUnit: row.quantityUnit,
    transportRegime: row.transportRegime,
    isInOverpack: row.isInOverpack,
    appliesToLines: row.appliesToLines,
    notes: row.notes,
  }));
}
