import { ApiProperty } from '@nestjs/swagger';

/**
 * One container type on a request, as both audiences see it.
 *
 * Shared between the pricing screen and the customer's own quote: there is
 * nothing internal about what was asked for, and the pricer must see exactly
 * what the customer asked for or the per-container charge multiplies by the
 * wrong number.
 */
export class QuoteEquipmentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number, description: 'Order as entered, from 1.' })
  position!: number;

  @ApiProperty({
    type: String,
    description: 'Stable id within the request; dangerous goods entries name it.',
  })
  unitId!: string;

  @ApiProperty({ type: String, example: '40HC', description: 'container_type lookup code.' })
  containerType!: string;

  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({
    type: Number, nullable: true,
    description: 'Expected load per container. Indicative; the CSC plate binds.',
  })
  grossWeightPerUnitKg!: number | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;
}

interface EquipmentRow {
  id: string;
  position: number;
  unitId: string;
  containerType: string;
  quantity: number;
  grossWeightPerUnitKg: unknown;
  notes: string | null;
}

/** Prisma returns Decimal for the weight; JSON has no such type. */
export function equipmentFor(rows: EquipmentRow[]): QuoteEquipmentDto[] {
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    unitId: row.unitId,
    containerType: row.containerType,
    quantity: row.quantity,
    grossWeightPerUnitKg:
      row.grossWeightPerUnitKg === null || row.grossWeightPerUnitKg === undefined
        ? null
        : Number(row.grossWeightPerUnitKg),
    notes: row.notes,
  }));
}
