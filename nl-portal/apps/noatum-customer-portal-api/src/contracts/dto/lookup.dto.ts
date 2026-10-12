import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const LOOKUP_OWNERSHIPS = ['portal', 'source', 'system'] as const;
export const LOOKUP_LOCALES = ['en-US', 'es-ES'] as const;
export const LOOKUP_DEFAULT_LOCALE = 'en-US';

/**
 * A lookup code is an identity, not a label: lower snake case, and immutable
 * once created. Correcting an identity is a replacement, not an edit.
 */
export const LookupCategoryCodeSchema = z
  .string().trim().toLowerCase()
  .regex(/^[a-z][a-z0-9_]{1,59}$/, 'Use lower case letters, digits and underscores.');

/** Item codes keep their source casing: CargoWise and ISO both use upper case. */
export const LookupItemCodeSchema = z
  .string().trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/, 'Use letters, digits, dot, dash or underscore.');

const TranslationInputSchema = z.strictObject({
  locale: z.enum(LOOKUP_LOCALES),
  label: z.string().trim().min(1).max(240),
  description: z.string().trim().max(600).nullable().default(null),
});

const hasDefaultLocale = (entries: { locale: string }[]) =>
  entries.some((entry) => entry.locale === LOOKUP_DEFAULT_LOCALE);
const localesAreUnique = (entries: { locale: string }[]) =>
  new Set(entries.map((entry) => entry.locale)).size === entries.length;

const TranslationsSchema = z
  .array(TranslationInputSchema)
  .min(1)
  .max(LOOKUP_LOCALES.length)
  .refine(localesAreUnique, 'One entry per language.')
  .refine(hasDefaultLocale, `A ${LOOKUP_DEFAULT_LOCALE} label is required.`);

/**
 * Free-form notes carried with a record. Inert by contract: nothing reads it
 * and no behaviour may key off it, which is what keeps it from becoming the
 * unlimited custom attribute the lookup plan excludes.
 */
const MetadataSchema = z.record(z.string(), z.unknown()).nullable().default(null);

export const LookupCategoryCreateSchema = z.strictObject({
  code: LookupCategoryCodeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable().default(null),
  /** Category a value's parent must belong to. Its own code makes it self-nesting. */
  parentCategoryCode: z.string().trim().max(60).nullable().default(null),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).default(0),
  metadata: MetadataSchema,
  reason: z.string().trim().min(1).max(400),
});
export type LookupCategoryCreate = z.infer<typeof LookupCategoryCreateSchema>;

export const LookupCategoryUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable().default(null),
  parentCategoryCode: z.string().trim().max(60).nullable().default(null),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).default(0),
  metadata: MetadataSchema,
  isActive: z.boolean(),
  reason: z.string().trim().min(1).max(400),
});
export type LookupCategoryUpdate = z.infer<typeof LookupCategoryUpdateSchema>;

export const LookupItemCreateSchema = z.strictObject({
  code: LookupItemCodeSchema,
  parentCode: z.string().trim().max(80).nullable().default(null),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).default(0),
  isActive: z.boolean().default(true),
  isCustomerVisible: z.boolean().default(false),
  metadata: MetadataSchema,
  translations: TranslationsSchema,
  reason: z.string().trim().min(1).max(400),
});
export type LookupItemCreate = z.infer<typeof LookupItemCreateSchema>;

export const LookupItemUpdateSchema = z.strictObject({
  parentCode: z.string().trim().max(80).nullable().default(null),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
  isCustomerVisible: z.boolean(),
  metadata: MetadataSchema,
  translations: TranslationsSchema,
  /** Rejects a save built on a stale copy rather than merging it. */
  version: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(400),
});
export type LookupItemUpdate = z.infer<typeof LookupItemUpdateSchema>;

export const LookupItemQuerySchema = z.strictObject({
  search: z.string().trim().max(200).default(''),
  /** `all` is an internal view; a customer projection never reaches this. */
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  visibility: z.enum(['all', 'customer', 'internal']).default('all'),
  parentCode: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type LookupItemQuery = z.infer<typeof LookupItemQuerySchema>;

export class LookupTranslationDto {
  @ApiProperty({ enum: LOOKUP_LOCALES })
  locale!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: 240 })
  label!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 600 })
  description!: string | null;
}

export class LookupCategoryCreateDto {
  @ApiProperty({ type: String, pattern: '^[a-z][a-z0-9_]{1,59}$' })
  code!: string;

  @ApiProperty({ type: String, maxLength: 120 })
  name!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 400 })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Its own code makes the list self-nesting.' })
  parentCategoryCode!: string | null;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;
}

export class LookupCategoryUpdateDto {
  @ApiProperty({ type: String, maxLength: 120 })
  name!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 400 })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentCategoryCode!: string | null;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;
}

export class LookupItemCreateDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String, nullable: true })
  parentCode!: string | null;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Boolean })
  isCustomerVisible!: boolean;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: [LookupTranslationDto] })
  translations!: LookupTranslationDto[];

  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;
}

export class LookupItemUpdateDto {
  @ApiProperty({ type: String, nullable: true })
  parentCode!: string | null;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Boolean })
  isCustomerVisible!: boolean;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: [LookupTranslationDto] })
  translations!: LookupTranslationDto[];

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;
}

/** A named list. Structural fields are read-only: changing them is a migration. */
export class LookupCategoryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ enum: LOOKUP_OWNERSHIPS })
  ownership!: (typeof LOOKUP_OWNERSHIPS)[number];

  @ApiProperty({ type: String, nullable: true })
  sourceSystem!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Where the seeded content came from.' })
  sourceRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Category an item parent must belong to. Null means flat.' })
  parentCategoryCode!: string | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: Boolean, description: 'False for source and system lists: their content is owned elsewhere.' })
  canEditContent!: boolean;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether values here may be activated or retired. True for portal and source lists; false for system lists, which mirror application enums.',
  })
  canRetire!: boolean;

  @ApiProperty({ type: Number })
  itemCount!: number;

  @ApiProperty({ type: Number, description: 'Items reachable by a customer surface.' })
  customerVisibleCount!: number;

  @ApiProperty({ type: [String], description: 'Locales with a label on every item.' })
  completeLocales!: string[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastChangedAt!: string | null;
}

export class LookupItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: [LookupTranslationDto], description: 'One entry per maintained locale.' })
  translations!: LookupTranslationDto[];

  @ApiProperty({ type: String, nullable: true })
  parentCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentLabel!: string | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Boolean })
  isCustomerVisible!: boolean;

  @ApiProperty({ type: String, nullable: true })
  sourceRef!: string | null;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  metadata!: Record<string, unknown> | null;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiProperty({ type: Number })
  version!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class LookupItemListDto {
  @ApiProperty({ type: LookupCategoryDto })
  category!: LookupCategoryDto;

  @ApiProperty({ type: [LookupItemDto] })
  items!: LookupItemDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;
}
