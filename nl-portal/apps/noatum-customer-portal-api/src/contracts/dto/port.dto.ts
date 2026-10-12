import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/** A UN/LOCODE: two-letter country, three-letter location. */
export const PORT_CODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;

/**
 * How many suggestions an autocomplete may ask for.
 *
 * Bounded because the directory is ~100k rows: without a ceiling one typo-ed
 * request could ask for all of them, and a dropdown nobody can read is not a
 * better answer than ten.
 */
export const PORT_SEARCH_LIMIT_DEFAULT = 10;
export const PORT_SEARCH_LIMIT_MAX = 50;

export const PortSearchSchema = z.strictObject({
  /**
   * What the person has typed. Matched as a PREFIX against the port name, the
   * code, and the COUNTRY name - because the customer knows "Spain" long before
   * they know ESVLC, and a field that only matches what they cannot remember is
   * the problem this replaced.
   */
  /*
   * Optional, and empty is a real question: "what is there?". A field that shows
   * nothing until two characters are typed is a field somebody has to guess at,
   * so an absent `q` returns the first page in name order instead of refusing.
   */
  q: z.string().trim().max(60).optional(),
  /** Which language the country names are matched and returned in. */
  locale: z.string().trim().max(10).optional(),
  /**
   * Narrows to what the mode can actually use. Sea shows seaports, air shows
   * airports; anything else shows both, because a road or rail leg may start at
   * either.
   */
  mode: z.enum(['sea', 'air']).optional(),
  /** ISO 3166-1 alpha-2, to separate the several Santiagos. */
  country: z.string().trim().length(2).toUpperCase().optional(),
  limit: z.coerce.number().int().min(1).max(PORT_SEARCH_LIMIT_MAX).default(PORT_SEARCH_LIMIT_DEFAULT),
});
export type PortSearch = z.infer<typeof PortSearchSchema>;

export class PortDto {
  @ApiProperty({ example: 'ESVLC', description: 'UN/LOCODE. Store this, not the name.' })
  code!: string;

  @ApiProperty({ example: 'Valencia' })
  name!: string;

  @ApiProperty({ example: 'ES', description: 'ISO 3166-1 alpha-2.' })
  countryCode!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Spain',
    description: 'Country name for the caller locale, from the country lookup. Null if that lookup has no row for the code.',
  })
  countryName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'ISO 3166-2 subdivision, where the directory records one.',
  })
  subdivision!: string | null;

  @ApiProperty({ description: 'Handles sea freight.' })
  isSeaport!: boolean;

  @ApiProperty({ description: 'Handles air freight.' })
  isAirport!: boolean;
}
