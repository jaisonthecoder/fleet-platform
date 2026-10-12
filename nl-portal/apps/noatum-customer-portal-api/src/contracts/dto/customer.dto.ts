import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

import { CUSTOMER_TIERS } from '../enums';

export const CUSTOMER_STATUSES = ['draft', 'onboarding', 'active', 'suspended', 'closed'] as const;

/** Onboarding checklist keys. Derived from stored facts, never stored themselves. */
export const CUSTOMER_TASKS = ['identity', 'entitlements', 'organisations', 'servicing', 'administrator', 'go_live'] as const;
export type CustomerTaskKey = (typeof CUSTOMER_TASKS)[number];

const SlugSchema = z
  .string().trim().toLowerCase()
  .regex(/^[a-z][a-z0-9-]{1,79}$/, 'Use lower case letters, digits and dashes.');

/** Bare domains only: no scheme, no path, no leading dot. */
const DomainSchema = z
  .string().trim().toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, 'Enter a domain such as acme.com.');

export const CustomerCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(240).nullable().default(null),
  slug: SlugSchema,
  countryCode: z.string().trim().toUpperCase().length(2).nullable().default(null),
  tier: z.enum(CUSTOMER_TIERS).default('standard'),
  emailDomains: z.array(DomainSchema).max(20).default([]),
  parentId: z.uuid().nullable().default(null),
  defaultServicingBranchId: z.uuid().nullable().default(null),
  reason: z.string().trim().min(1).max(400),
});
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

export const CustomerUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(240).nullable().default(null),
  countryCode: z.string().trim().toUpperCase().length(2).nullable().default(null),
  tier: z.enum(CUSTOMER_TIERS),
  emailDomains: z.array(DomainSchema).max(20).default([]),
  parentId: z.uuid().nullable().default(null),
  defaultServicingBranchId: z.uuid().nullable().default(null),
  /** Optimistic concurrency: two staff editing one customer must not silently overwrite. */
  updatedAt: z.iso.datetime(),
  reason: z.string().trim().min(1).max(400),
});
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

export const CustomerStatusChangeSchema = z.strictObject({
  updatedAt: z.iso.datetime(),
  reason: z.string().trim().min(1).max(400),
});
export type CustomerStatusChange = z.infer<typeof CustomerStatusChangeSchema>;

export const CustomerQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['all', ...CUSTOMER_STATUSES]).default('all'),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  /** Customers that cannot go live yet. The onboarding worklist. */
  blocked: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;

export const OrganisationLinkCreateSchema = z.strictObject({
  orgId: z.uuid(),
  servicingBranchId: z.uuid().nullable().default(null),
  reason: z.string().trim().min(1).max(400),
});
export type OrganisationLinkCreate = z.infer<typeof OrganisationLinkCreateSchema>;

export const OrganisationLinkRemoveSchema = z.strictObject({
  reason: z.string().trim().min(1).max(400),
});
export type OrganisationLinkRemove = z.infer<typeof OrganisationLinkRemoveSchema>;

/** Null means the link follows the customer's default office again. */
export const OrganisationLinkServicingSchema = z.strictObject({
  servicingBranchId: z.uuid().nullable().default(null),
  reason: z.string().trim().min(1).max(400),
});
export type OrganisationLinkServicing = z.infer<typeof OrganisationLinkServicingSchema>;

export const OrganisationSearchSchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  /** Hide organisations already linked to some customer. */
  unlinkedOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type OrganisationSearch = z.infer<typeof OrganisationSearchSchema>;

/* Request bodies. Swagger needs classes to emit a requestBody, and without one
   the generated SPA client types every body as `never`. */

export class CustomerCreateDto {
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) legalName!: string | null;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ enum: CUSTOMER_TIERS }) tier!: string;
  @ApiProperty({ type: String, isArray: true }) emailDomains!: string[];
  @ApiProperty({ type: String, nullable: true }) parentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) defaultServicingBranchId!: string | null;
  @ApiProperty() reason!: string;
}

export class CustomerUpdateDto extends CustomerCreateDto {
  @ApiProperty({ description: 'The value last read, for optimistic concurrency.' })
  updatedAt!: string;
}

export class CustomerStatusChangeDto {
  @ApiProperty({ description: 'The value last read, for optimistic concurrency.' })
  updatedAt!: string;
  @ApiProperty() reason!: string;
}

export class OrganisationLinkCreateDto {
  @ApiProperty() orgId!: string;
  @ApiProperty({ type: String, nullable: true }) servicingBranchId!: string | null;
  @ApiProperty() reason!: string;
}

export class OrganisationLinkRemoveDto {
  @ApiProperty() reason!: string;
}

export class OrganisationLinkServicingDto {
  @ApiProperty({ type: String, nullable: true, description: 'Null follows the customer default.' })
  servicingBranchId!: string | null;
  @ApiProperty() reason!: string;
}

export const CustomerUserQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CustomerUserQuery = z.infer<typeof CustomerUserQuerySchema>;

/**
 * Which organisations one customer user may see.
 *
 * `scope: 'all'` clears every restriction row. `scope: 'selected'` requires at
 * least one account — an empty selection would otherwise store no rows, which
 * the schema reads as "all accounts", the exact opposite of what the operator
 * meant.
 */
export const UserAccessUpdateSchema = z
  .strictObject({
    scope: z.enum(['all', 'selected']),
    accountIds: z.array(z.uuid()).max(200).default([]),
    reason: z.string().trim().min(1).max(400),
  })
  .refine(
    (value) => value.scope === 'all' || value.accountIds.length > 0,
    { path: ['accountIds'], message: 'Choose at least one organisation, or give access to all of them.' },
  );
export type UserAccessUpdate = z.infer<typeof UserAccessUpdateSchema>;

export class UserAccessUpdateDto {
  @ApiProperty({ enum: ['all', 'selected'] }) scope!: string;
  @ApiProperty({ type: String, isArray: true }) accountIds!: string[];
  @ApiProperty() reason!: string;
}

/**
 * Sign-in state for one customer user.
 *
 * Present only while portal-managed sign-in is switched on (ADR-006); null otherwise,
 * which is how a screen knows not to offer password controls at all.
 */
export class CustomerUserSecurityDto {
  @ApiProperty() hasPassword!: boolean;
  @ApiProperty({ description: 'An administrator has blocked this password.' })
  credentialDisabled!: boolean;
  @ApiProperty({ type: String, nullable: true }) passwordSetAt!: string | null;
  @ApiProperty() mfaEnrolled!: boolean;
  @ApiProperty() recoveryCodesLeft!: number;
  @ApiProperty() activeSessions!: number;
  @ApiProperty({ description: 'An unused activation link is still live.' })
  pendingActivationLink!: boolean;
}

export class CustomerUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ description: 'True when no restriction rows exist, so the user sees every linked organisation.' })
  seesAllOrganisations!: boolean;
  @ApiProperty({ type: String, isArray: true }) accountIds!: string[];
  @ApiProperty({ type: CustomerUserSecurityDto, nullable: true })
  security!: CustomerUserSecurityDto | null;
}

export class CustomerUserListDto {
  @ApiProperty({ type: CustomerUserDto, isArray: true }) items!: CustomerUserDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

/**
 * Every administrative act on someone else's sign-in carries a reason. It is written to
 * the audit trail, because "who disabled this account and why" is the first question
 * asked afterwards.
 */
export const AccountActionSchema = z.strictObject({
  reason: z.string().trim().min(1).max(400),
});
export type AccountAction = z.infer<typeof AccountActionSchema>;

export class AccountActionDto {
  @ApiProperty() reason!: string;
}

export class AccountActionResultDto {
  @ApiProperty({ description: 'False when there was nothing to do - already disabled, no factor to clear.' })
  changed!: boolean;
  @ApiProperty({ enum: ['sent', 'queued', 'not-configured', 'failed'], nullable: true })
  emailStatus!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The single-use link, returned only while no email transport is configured so staff can pass it on. Never stored.',
  })
  link!: string | null;
}

export class CustomerTaskDto {
  @ApiProperty({ enum: CUSTOMER_TASKS }) key!: CustomerTaskKey;
  @ApiProperty() done!: boolean;
  @ApiProperty({ type: String, nullable: true, description: 'Why this task is not done yet.' })
  blockedReason!: string | null;
}

export class CustomerSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) legalName!: string | null;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: CUSTOMER_STATUSES }) status!: string;
  @ApiProperty({ enum: CUSTOMER_TIERS }) tier!: string;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) parentName!: string | null;
  @ApiProperty() linkedOrganisations!: number;
  @ApiProperty() users!: number;
  @ApiProperty({ description: 'True when the customer is not live and cannot go live yet.' })
  blocked!: boolean;
  @ApiProperty() updatedAt!: string;
}

export class CustomerListDto {
  @ApiProperty({ type: CustomerSummaryDto, isArray: true }) items!: CustomerSummaryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class CustomerLinkDto {
  @ApiProperty() id!: string;
  @ApiProperty() orgId!: string;
  @ApiProperty() sourceCode!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ description: 'False when the organisation is inactive in CargoWise.' })
  sourceActive!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: String, nullable: true }) justification!: string | null;
  @ApiProperty({ type: String, nullable: true }) linkedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Set on this link only; null means it follows the customer default.' })
  servicingBranchCode!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'The office that actually services this link, after the customer default is applied.' })
  effectiveServicingBranchCode!: string | null;
  @ApiProperty({ description: 'True when the office comes from the customer default rather than this link.' })
  servicingInherited!: boolean;
  @ApiProperty() addresses!: number;
}

export class CustomerDetailDto extends CustomerSummaryDto {
  @ApiProperty({ type: String, isArray: true }) emailDomains!: string[];
  @ApiProperty({ type: String, nullable: true }) parentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) defaultServicingBranchId!: string | null;
  @ApiProperty({ type: String, nullable: true }) defaultServicingBranchCode!: string | null;
  @ApiProperty({ type: CustomerTaskDto, isArray: true }) tasks!: CustomerTaskDto[];
  @ApiProperty({ type: CustomerLinkDto, isArray: true }) links!: CustomerLinkDto[];
  @ApiProperty({ type: String, isArray: true, description: 'Empty when the customer can go live.' })
  goLiveMissing!: string[];
  @ApiProperty({ enum: CUSTOMER_STATUSES, isArray: true }) allowedTransitions!: string[];
}

export class DirectoryOrganisationDto {
  @ApiProperty() id!: string;
  @ApiProperty() sourceCode!: string;
  @ApiProperty() sourceInstance!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) category!: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ description: 'Only a source-confirmed organisation may be linked.' })
  isSourceConfirmed!: boolean;
  @ApiProperty({ type: String, isArray: true }) sourceRoles!: string[];
  @ApiProperty({ type: String, nullable: true, description: 'Customer already holding this code.' })
  linkedCustomerName!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Why this organisation cannot be attached.' })
  blockedReason!: string | null;
}

export class DirectoryListDto {
  @ApiProperty({ type: DirectoryOrganisationDto, isArray: true }) items!: DirectoryOrganisationDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
