import { ApiProperty } from '@nestjs/swagger';

import { QUOTE_PIPELINE_SEGMENTS } from '../enums';

/**
 * What the listing grids need that the detail DTOs already carry elsewhere.
 *
 * Shared by the customer and the staff quotation lists on purpose: the two
 * screens draw the same row from different sides of the desk, and a second copy
 * of "how do we say 2 x 40HC" is how the two start disagreeing.
 */

/** One equipment line, as the row's cargo caption needs it. */
export class QuoteCargoUnitDto {
  @ApiProperty({ type: Number })
  quantity!: number;

  @ApiProperty({ type: String, description: 'container_type lookup code, e.g. 40HC.' })
  containerType!: string;
}

/**
 * The cargo caption, in parts.
 *
 * Deliberately NOT a formatted string. "2 x 40HC - furniture" has to read the
 * same way in Spanish, and a sentence assembled in the API can only ever be
 * assembled in one language. The browser joins these with the separators its
 * locale wants.
 */
export class QuoteCargoDto {
  @ApiProperty({ type: [QuoteCargoUnitDto], description: 'Empty unless a full-load request.' })
  units!: QuoteCargoUnitDto[];

  @ApiProperty({ type: Number, nullable: true })
  grossWeightKg!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  volumeM3!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'load_type lookup code, e.g. LCL.' })
  loadType!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'What is being moved, as submitted.' })
  commodity!: string | null;
}

/** One segment of the pipeline band. Counts are across the whole list, not the page. */
export class QuotePipelineSegmentDto {
  @ApiProperty({ enum: QUOTE_PIPELINE_SEGMENTS })
  key!: string;

  @ApiProperty({ type: Number })
  count!: number;
}
