import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Operating structure — Noatum-owned regions and branches.
 *
 * These are portal-owned reference data, not CargoWise data: a region has no
 * equivalent in CargoWise at all, and a branch's `sourceBranchCode` is a mapping
 * to CargoWise's ControllingBranch, never an import of it. Manual entry is the
 * primary path; file import and API discovery are additive and never destructive.
 */

/** Portal-owned codes: short, stable, and never reused. Case-folded to upper. */
const regionCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(20)
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Use letters, numbers and hyphens');

const branchCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Use letters, numbers and hyphens');

const countryCode = z.string().trim().toUpperCase().length(2);
const sourceBranchCode = z.string().trim().max(40);

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export const RegionQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type RegionQuery = z.infer<typeof RegionQuerySchema>;

export const RegionCreateSchema = z.strictObject({
  code: regionCode,
  name: z.string().trim().min(1).max(120),
});
export type RegionCreate = z.infer<typeof RegionCreateSchema>;

export const RegionUpdateSchema = z
  .strictObject({
    // Code is immutable once created: staff assignment and branch grouping key off it.
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    updatedAt: z.iso.datetime(),
  })
  .refine((value) => value.name !== undefined || value.isActive !== undefined, 'Nothing to update.');
export type RegionUpdate = z.infer<typeof RegionUpdateSchema>;

export class RegionDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Branches grouped under this region.' }) branchCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class RegionListDto {
  @ApiProperty({ type: RegionDto, isArray: true }) items!: RegionDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export const BranchQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  regionId: z.uuid().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  /** Whether the branch is mapped to a CargoWise ControllingBranch code. */
  mapped: z.enum(['all', 'mapped', 'unmapped']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type BranchQuery = z.infer<typeof BranchQuerySchema>;

export const BranchCreateSchema = z.strictObject({
  code: branchCode,
  name: z.string().trim().min(1).max(160),
  city: z.string().trim().max(120).nullish(),
  countryCode: countryCode.nullish(),
  regionId: z.uuid().nullish(),
  /** Optional mapping to CargoWise ControllingBranch. Never invented, never written back. */
  sourceBranchCode: sourceBranchCode.nullish(),
});
export type BranchCreate = z.infer<typeof BranchCreateSchema>;

export const BranchUpdateSchema = z
  .strictObject({
    // Code is immutable: it is the identifier staff assignment and servicing links use.
    name: z.string().trim().min(1).max(160).optional(),
    city: z.string().trim().max(120).nullish(),
    countryCode: countryCode.nullish(),
    regionId: z.uuid().nullish(),
    sourceBranchCode: sourceBranchCode.nullish(),
    isActive: z.boolean().optional(),
    updatedAt: z.iso.datetime(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.city !== undefined ||
      value.countryCode !== undefined ||
      value.regionId !== undefined ||
      value.sourceBranchCode !== undefined ||
      value.isActive !== undefined,
    'Nothing to update.',
  );
export type BranchUpdate = z.infer<typeof BranchUpdateSchema>;

export class BranchDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) regionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) regionName!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'CargoWise ControllingBranch mapping.' })
  sourceBranchCode!: string | null;
  @ApiProperty({ description: "Where the record came from: 'manual' until an authoritative import exists." })
  source!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Staff assigned to this branch.' }) staffCount!: number;
  @ApiProperty({ description: 'Active customer links this branch services.' }) servicedCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class BranchListDto {
  @ApiProperty({ type: BranchDto, isArray: true }) items!: BranchDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

// ---------------------------------------------------------------------------
// Request bodies (documented so the SPA client is typed, not `unknown`)
// ---------------------------------------------------------------------------

export class RegionCreateDto {
  @ApiProperty({ minLength: 2, maxLength: 20 }) code!: string;
  @ApiProperty({ minLength: 1, maxLength: 120 }) name!: string;
}

export class RegionUpdateDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 120 }) name?: string;
  @ApiProperty({ required: false }) isActive?: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class BranchCreateDto {
  @ApiProperty({ minLength: 2, maxLength: 40 }) code!: string;
  @ApiProperty({ minLength: 1, maxLength: 160 }) name!: string;
  @ApiProperty({ required: false, type: String, nullable: true }) city?: string | null;
  @ApiProperty({ required: false, type: String, nullable: true }) countryCode?: string | null;
  @ApiProperty({ required: false, type: String, format: 'uuid', nullable: true }) regionId?: string | null;
  @ApiProperty({ required: false, type: String, nullable: true }) sourceBranchCode?: string | null;
}

export class BranchUpdateDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 160 }) name?: string;
  @ApiProperty({ required: false, type: String, nullable: true }) city?: string | null;
  @ApiProperty({ required: false, type: String, nullable: true }) countryCode?: string | null;
  @ApiProperty({ required: false, type: String, format: 'uuid', nullable: true }) regionId?: string | null;
  @ApiProperty({ required: false, type: String, nullable: true }) sourceBranchCode?: string | null;
  @ApiProperty({ required: false }) isActive?: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

// ---------------------------------------------------------------------------
// CargoWise ControllingBranch discovery
//
// Read-only: the distinct ControllingBranch codes already present on imported
// organisations, with whether each is mapped to a portal branch. Mapping is done
// by creating or editing a branch (setting sourceBranchCode) - never here.
// ---------------------------------------------------------------------------

export const CargoWiseBranchQuerySchema = z.strictObject({
  mapped: z.enum(['all', 'mapped', 'unmapped']).default('all'),
});
export type CargoWiseBranchQuery = z.infer<typeof CargoWiseBranchQuerySchema>;

export class CargoWiseBranchDto {
  @ApiProperty({ description: 'CargoWise ControllingBranch code seen on imported organisations.' }) cw1Code!: string;
  @ApiProperty({ description: 'Active organisations carrying this controlling branch.' }) organisationCount!: number;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) mappedBranchId!: string | null;
  @ApiProperty({ type: String, nullable: true }) mappedBranchCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) mappedBranchName!: string | null;
}

export class CargoWiseBranchListDto {
  @ApiProperty({ type: CargoWiseBranchDto, isArray: true }) items!: CargoWiseBranchDto[];
  @ApiProperty() total!: number;
}
