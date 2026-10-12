import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { INTERNAL_ROLE_KEYS } from '../permissions';

export const STAFF_ROLE_KEYS = INTERNAL_ROLE_KEYS as readonly [string, ...string[]];
export const STAFF_STATUSES = ['registered', 'invited', 'active', 'suspended', 'disabled'] as const;

export const StaffRoleUpdateSchema = z.strictObject({
  roleKeys: z.array(z.enum(STAFF_ROLE_KEYS)).max(STAFF_ROLE_KEYS.length)
    .refine((keys) => new Set(keys).size === keys.length, 'Duplicate roles are not allowed'),
  /** Null clears the assignment; pricing roles then become unassignable. */
  branchId: z.uuid().nullable().default(null),
  updatedAt: z.iso.datetime(),
  reason: z.string().trim().min(1).max(400),
});
export type StaffRoleUpdate = z.infer<typeof StaffRoleUpdateSchema>;

export const StaffListQuerySchema = z.strictObject({
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type StaffListQuery = z.infer<typeof StaffListQuerySchema>;

export const StaffAccessLinkSchema = z.strictObject({
  reason: z.string().trim().min(1).max(400),
});
export type StaffAccessLinkRequest = z.infer<typeof StaffAccessLinkSchema>;

export class StaffRoleUpdateDto {
  @ApiProperty({ type: [String], enum: STAFF_ROLE_KEYS, maxItems: STAFF_ROLE_KEYS.length, uniqueItems: true })
  roleKeys!: string[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  branchId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;
}

/** An operating branch a member of staff can be assigned to. */
export class StaffBranchDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true })
  countryCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  regionName!: string | null;
}

export class StaffRolePresetDto {
  @ApiProperty({ enum: STAFF_ROLE_KEYS })
  key!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

/** How someone signs in, for the staff screen. Never a hash, never a secret. */
export class StaffSecurityDto {
  @ApiProperty({ type: Boolean })
  hasPassword!: boolean;

  @ApiProperty({ type: Boolean })
  credentialDisabled!: boolean;

  @ApiProperty({ type: Boolean })
  mfaEnrolled!: boolean;

  @ApiProperty({ type: Number })
  activeSessions!: number;

  @ApiProperty({ type: Boolean, description: 'An unspent invitation or reset link is live.' })
  pendingActivationLink!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  pendingLinkExpiresAt!: string | null;
}

export class StaffAccessLinkDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 400 })
  reason!: string;
}

export class StaffAccessLinkResultDto {
  @ApiProperty({ type: String, nullable: true, description: 'Present only while no email transport is configured.' })
  link!: string | null;

  @ApiProperty({ type: String })
  emailStatus!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
}

export class StaffUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({ enum: STAFF_STATUSES })
  status!: (typeof STAFF_STATUSES)[number];

  @ApiProperty({ type: [String] })
  roleKeys!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty({ type: StaffBranchDto, nullable: true })
  branch!: StaffBranchDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty({ type: Boolean, description: 'Signs in with Microsoft, so needs no portal password.' })
  usesSso!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: StaffSecurityDto, nullable: true, description: 'Null when portal password sign-in is switched off.' })
  security!: StaffSecurityDto | null;
}

export class StaffListDto {
  @ApiProperty({ type: [StaffUserDto] })
  items!: StaffUserDto[];

  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  page!: number;

  @ApiProperty({ type: Number })
  pageSize!: number;
}
