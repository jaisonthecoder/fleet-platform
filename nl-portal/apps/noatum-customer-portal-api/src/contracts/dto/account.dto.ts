import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * The customer's own account: its people, its access, its setup.
 *
 * Everything here is scoped to the caller's own customer group, taken from the
 * session. No route accepts a customer id, which is the whole difference from
 * the Noatum-side customer administration in `customer.dto.ts`: that one is told
 * which customer to act on, this one is told by who is asking.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Customer presets only. An administrator can never grant an internal role. */
export const ASSIGNABLE_ROLES = [
  'customer_standard',
  'customer_quoting_booking',
  'customer_finance',
  'customer_analyst',
  'customer_claims',
  'customer_admin',
] as const;

export const AssignableRoleSchema = z.enum(ASSIGNABLE_ROLES);
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

export const InviteColleagueSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  /**
   * At least one. An invitation that grants nothing would create an account that
   * can sign in and see an empty portal, which reads as a broken invitation.
   */
  roleKeys: z.array(AssignableRoleSchema).min(1).max(6),
  /** Restrict the colleague to one linked office. Null means all of them. */
  officeAccountId: z.string().uuid().nullable().default(null),
});
export type InviteColleague = z.infer<typeof InviteColleagueSchema>;

export const ChangeRolesSchema = z.strictObject({
  roleKeys: z.array(AssignableRoleSchema).min(1).max(6),
  officeAccountId: z.string().uuid().nullable().default(null),
  reason: z.string().trim().min(1).max(400),
});
export type ChangeRoles = z.infer<typeof ChangeRolesSchema>;

export const AccountActionReasonSchema = z.strictObject({
  reason: z.string().trim().min(1).max(400),
});
export type AccountActionReason = z.infer<typeof AccountActionReasonSchema>;

/* ── request bodies ──────────────────────────────────────────────────────── */

/**
 * Declared so OpenAPI emits a requestBody for these routes; zod above still does
 * the validating. Without them Nest emits nothing, the generated client types the
 * body `never`, and every caller has to cast - which is how a wrong value reaches
 * production with nothing to catch it.
 */
export class InviteColleagueDto {
  @ApiProperty({ type: String, maxLength: 200 })
  displayName!: string;

  @ApiProperty({ type: String, format: 'email', maxLength: 254 })
  email!: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES, isArray: true, description: 'At least one.' })
  roleKeys!: AssignableRole[];

  @ApiProperty({
    type: String, format: 'uuid', nullable: true, required: false,
    description: 'Restrict to one linked office. Null means all of them.',
  })
  officeAccountId?: string | null;
}

export class ChangeRolesDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES, isArray: true, description: 'At least one.' })
  roleKeys!: AssignableRole[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false })
  officeAccountId?: string | null;

  @ApiProperty({ type: String, maxLength: 400, description: 'Audited.' })
  reason!: string;
}

export class AccountActionReasonDto {
  @ApiProperty({ type: String, maxLength: 400, description: 'Audited.' })
  reason!: string;
}

/* ── people ──────────────────────────────────────────────────────────────── */

export class AccountUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['invited', 'active', 'disabled'] }) status!: string;
  @ApiProperty({ type: [String] }) roleKeys!: string[];
  @ApiProperty({ type: [String], description: 'Display names for the same roles.' })
  roleNames!: string[];
  @ApiProperty({ type: String, nullable: true, description: 'Null when the user sees every linked office.' })
  officeName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ description: 'True for the person making the request; the screen cannot let them lock themselves out.' })
  isSelf!: boolean;
}

export class AccountInvitationDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) displayName!: string | null;
  @ApiProperty({ enum: ['pending', 'accepted', 'expired', 'revoked'] }) status!: string;
  @ApiProperty({ type: [String] }) roleKeys!: string[];
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ description: 'Resends used. Three is the maximum.' }) resendCount!: number;
  @ApiProperty({ type: String, nullable: true }) invitedByName!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The single-use link, returned ONLY on creation and only while no email transport is configured, so an administrator can pass it on themselves.',
  })
  inviteUrl!: string | null;
}

export class AccountRolePresetDto {
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: [String], description: 'What the role grants, for the "what can they do" line.' })
  permissions!: string[];
}

export class AccountOfficeDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() cw1OrgCode!: string;
  @ApiProperty({ type: String, nullable: true }) servicingBranchName!: string | null;
}

/* ── the dashboard's own call ────────────────────────────────────────────── */

export class AccountSetupStepDto {
  @ApiProperty({ enum: ['profile', 'users', 'addresses', 'alerts', 'quote'] }) id!: string;
  @ApiProperty() done!: boolean;
  @ApiProperty({
    description:
      'False when the platform cannot yet observe this step, so the screen offers it without claiming to know whether it is finished.',
  })
  trackable!: boolean;
}

export class AccountContactDto {
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
}

export class AccountRecordCountsDto {
  @ApiProperty() shipments!: number;
  @ApiProperty() quotations!: number;
  @ApiProperty() invoices!: number;
  @ApiProperty() bookings!: number;
}

export class AccountOverviewDto {
  @ApiProperty() customerName!: string;
  @ApiProperty({ type: String, nullable: true }) legalName!: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty() tier!: string;
  @ApiProperty({ type: [String], description: 'Role names the viewer holds.' }) roleNames!: string[];
  @ApiProperty({ type: [String], description: 'Permission codes the viewer holds; the screen shows a block only when its permission is present.' })
  permissions!: string[];
  @ApiProperty({ type: [AccountOfficeDto] }) offices!: AccountOfficeDto[];
  @ApiProperty({ type: String, nullable: true }) servicingBranchName!: string | null;
  @ApiProperty({ type: String, nullable: true }) servicingBranchCode!: string | null;
  @ApiProperty() signInEmail!: string;
  @ApiProperty({ description: 'Which identity provider this account signs in with.' }) signInMethod!: string;
  @ApiProperty({ type: [AccountSetupStepDto] }) setup!: AccountSetupStepDto[];
  @ApiProperty({
    type: [AccountContactDto],
    description:
      'Named Noatum contacts for this customer. Empty until contact assignment exists; the servicing branch above is what we can say today.',
  })
  contacts!: AccountContactDto[];
  @ApiProperty({
    type: AccountRecordCountsDto,
    description: 'What is visible to this account right now. Real counts, not a progress estimate.',
  })
  records!: AccountRecordCountsDto;
  @ApiProperty({ description: 'Users on this customer, including those who have not accepted yet.' })
  userCount!: number;
  @ApiProperty() pendingInvitationCount!: number;
}
