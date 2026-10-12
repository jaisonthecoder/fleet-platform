import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const ORGANISATION_SOURCE_KINDS = ['feed', 'file', 'manual'] as const;

export const OrganisationQuerySchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  category: z.string().trim().max(3).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  /** Provisional rows are the ones no source run has confirmed. */
  provenance: z.enum(['all', 'confirmed', 'provisional']).default('all'),
  linked: z.enum(['all', 'linked', 'unlinked']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type OrganisationQuery = z.infer<typeof OrganisationQuerySchema>;

export const ORGANISATION_IMPORT_OUTCOMES = ['running', 'succeeded', 'failed', 'aborted'] as const;

export const ImportRunRequestSchema = z.strictObject({
  /**
   * Only an authoritative full snapshot may deactivate organisations by absence.
   * Defaults to false so a casual re-run cannot revoke access.
   */
  authoritative: z.boolean().default(false),
  reason: z.string().trim().min(1).max(400),
});
export type ImportRunRequest = z.infer<typeof ImportRunRequestSchema>;

export class ImportRunRequestDto {
  @ApiProperty({ description: 'True only for a complete snapshot that may deactivate absent organisations.' })
  authoritative!: boolean;
  @ApiProperty() reason!: string;
}

export class ImportRunDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ORGANISATION_IMPORT_OUTCOMES }) outcome!: string;
  @ApiProperty() sourceInstance!: string;
  @ApiProperty() mode!: string;
  @ApiProperty() isAuthoritative!: boolean;
  @ApiProperty({ type: String, nullable: true }) fileName!: string | null;
  @ApiProperty() rowsRead!: number;
  @ApiProperty() rowsCreated!: number;
  @ApiProperty() rowsUpdated!: number;
  @ApiProperty() rowsUnchanged!: number;
  @ApiProperty() rowsDeactivated!: number;
  @ApiProperty() rowsRejected!: number;
  @ApiProperty({ type: String, nullable: true }) startedByName!: string | null;
  @ApiProperty() startedAt!: string;
  @ApiProperty({ type: String, nullable: true }) finishedAt!: string | null;
  @ApiProperty({ description: 'Rejections and any refusal by the deactivation brake.' })
  errors!: unknown;
}

export class ImportRunListDto {
  @ApiProperty({ type: ImportRunDto, isArray: true }) items!: ImportRunDto[];
  @ApiProperty() total!: number;
}

export class OrganisationRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() sourceCode!: string;
  @ApiProperty() sourceInstance!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) category!: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ enum: ORGANISATION_SOURCE_KINDS }) sourceKind!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isSourceConfirmed!: boolean;
  @ApiProperty({ type: String, isArray: true }) sourceRoles!: string[];
  @ApiProperty() addresses!: number;
  @ApiProperty({ type: String, nullable: true }) linkedCustomerId!: string | null;
  @ApiProperty({ type: String, nullable: true }) linkedCustomerName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastSeenAt!: string | null;
}

export class OrganisationListDto {
  @ApiProperty({ type: OrganisationRowDto, isArray: true }) items!: OrganisationRowDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class OrganisationAddressTypeDto {
  @ApiProperty({ description: 'The CargoWise AddressType code.' }) code!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Null when the code is not in the catalogue yet.' })
  label!: string | null;
}

export class OrganisationAddressDto {
  @ApiProperty() id!: string;
  @ApiProperty() sourceAddressCode!: string;
  @ApiProperty({ type: OrganisationAddressTypeDto, isArray: true, description: 'What the address is used for.' })
  purposes!: OrganisationAddressTypeDto[];
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ type: String, nullable: true }) companyNameOverride!: string | null;
  @ApiProperty({ type: String, nullable: true }) addressLine1!: string | null;
  @ApiProperty({ type: String, nullable: true }) city!: string | null;
  @ApiProperty({ type: String, nullable: true }) state!: string | null;
  @ApiProperty({ type: String, nullable: true }) postcode!: string | null;
  @ApiProperty({ type: String, nullable: true }) countryCode!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'UN/LOCODE.' }) relatedPortCode!: string | null;
  @ApiProperty() isActive!: boolean;
}

export class OrganisationRegistrationDto {
  @ApiProperty() id!: string;
  @ApiProperty() scheme!: string;
  @ApiProperty({ type: String, nullable: true }) schemeDescription!: string | null;
  @ApiProperty() value!: string;
  @ApiProperty({ type: String, nullable: true }) jurisdiction!: string | null;
  @ApiProperty() isCountryDefault!: boolean;
}

export class OrganisationChangeDto {
  @ApiProperty() id!: string;
  @ApiProperty() changeType!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) runKind!: string | null;
  @ApiProperty({ type: String, nullable: true }) runFileName!: string | null;
}

export class OrganisationDetailDto extends OrganisationRowDto {
  @ApiProperty({ type: String, nullable: true }) legalName!: string | null;
  @ApiProperty({ type: String, nullable: true }) state!: string | null;
  @ApiProperty({ type: String, nullable: true }) postcode!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'CargoWise ControllingBranch, not the Noatum office.' })
  sourceBranchCode!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Evidence only; grants no access.' })
  sourceControllingCustomerCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) firstSeenAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) linkedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) linkJustification!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Office servicing this link, after the customer default is applied.' })
  linkServicingBranchCode!: string | null;
  @ApiProperty({ description: 'True when the office comes from the customer default rather than this link.' })
  linkServicingInherited!: boolean;
  @ApiProperty({ type: OrganisationAddressDto, isArray: true }) addressList!: OrganisationAddressDto[];
  @ApiProperty({ type: OrganisationRegistrationDto, isArray: true }) registrations!: OrganisationRegistrationDto[];
  @ApiProperty({ type: OrganisationChangeDto, isArray: true }) history!: OrganisationChangeDto[];
}
