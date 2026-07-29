import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  createLeaseContractSchema,
  createVendorDocumentSchema,
  confirmVendorDocumentSchema,
  createVendorSchema,
  updateLeaseContractSchema,
  updateVendorSchema,
  updateVendorOnboardingProfileSchema,
  vendorActionSchema,
  vendorStatusSchema,
  vendorRequestChangeSchema,
  rejectVendorDocumentSchema,
} from '../../../contracts/vendor.contract';
import { VendorService } from '../services/vendor.service';

const actorRef = (principal?: Principal): string =>
  principal?.personId ?? principal?.entraObjectId ?? 'system';

/** Roles that configure vendor records (S1: admins configure). */
const VENDOR_CONFIG_ROLES = [
  'SystemAdmin',
  'DataSteward',
  'Procurement',
] as const;
/** Roles that approve/reject a submitted vendor (SoD: Procurement approves). */
const VENDOR_APPROVE_ROLES = ['Procurement', 'SystemAdmin'] as const;
/** Roles that may confirm or reject manually captured Vendor evidence. */
const VENDOR_DOCUMENT_CONFIRM_ROLES = ['DataSteward', 'Procurement'] as const;
/** Roles allowed to read full document evidence, storage refs and actor metadata. */
const VENDOR_DOCUMENT_READ_ROLES = [
  'SystemAdmin',
  'DataSteward',
  'Procurement',
] as const;
/** Roles that may read the vendor master + lease contracts. */
const VENDOR_READ_ROLES = [
  'SystemAdmin',
  'DataSteward',
  'Procurement',
  'Finance',
  'FleetManager',
  'ClusterFleetLead',
  'GroupFleetLead',
] as const;

/**
 * Vendor master + lease-contract API (S1/S2). Admins configure vendors;
 * Procurement approves them to Active (SoD). Records carry a plug-and-play
 * `sourceMode` — Manual records are fully editable in-app; Integrated records
 * are read-only pending the (future-scope) sync provider.
 */
@Controller({ path: 'vendors', version: '1' })
export class VendorController {
  constructor(private readonly vendors: VendorService) {}

  // --- vendors ---

  @Get()
  @Roles(...VENDOR_READ_ROLES)
  async list(
    @CurrentUser() principal: Principal,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    const parsedStatus =
      status === undefined ? undefined : this.parse(vendorStatusSchema, status);
    return this.vendors.list(
      Number(limit) || 50,
      Number(offset) || 0,
      principal.organizationId,
      parsedStatus,
    );
  }

  @Get('approvals')
  @Roles(...VENDOR_APPROVE_ROLES)
  async listApprovals(
    @CurrentUser() principal: Principal,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.vendors.listApprovalWorkItems(
      Number(limit) || 50,
      Number(offset) || 0,
      principal.organizationId,
    );
  }

  @Get(':id')
  @Roles(...VENDOR_READ_ROLES)
  async get(@Param('id') id: string, @CurrentUser() principal: Principal) {
    return this.vendors.get(id, principal.organizationId);
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Post()
  async create(@Body() body: unknown, @CurrentUser() principal: Principal) {
    return this.vendors.create(
      this.parse(createVendorSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.update(
      id,
      this.parse(updateVendorSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Get(':id/onboarding')
  @Roles(...VENDOR_CONFIG_ROLES)
  async getOnboarding(
    @Param('id') id: string,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.getOnboarding(id, principal.organizationId);
  }

  @Patch(':id/onboarding')
  @Roles(...VENDOR_CONFIG_ROLES)
  async updateOnboarding(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.updateOnboardingProfile(
      id,
      this.parse(updateVendorOnboardingProfileSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorActionSchema, body);
    return this.vendors.transition(
      id,
      'PendingApproval',
      'VENDOR_SUBMITTED',
      actorRef(principal),
      reason,
      false,
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_APPROVE_ROLES)
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorActionSchema, body);
    // Approval clears the data-quality flag: the record is now verified.
    return this.vendors.transition(
      id,
      'Active',
      'VENDOR_APPROVED',
      actorRef(principal),
      reason,
      true,
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_APPROVE_ROLES)
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorActionSchema, body);
    return this.vendors.transition(
      id,
      'Draft',
      'VENDOR_REJECTED',
      actorRef(principal),
      reason,
      false,
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_APPROVE_ROLES)
  @Post(':id/request-change')
  async requestChange(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorRequestChangeSchema, body);
    return this.vendors.requestChanges(
      id,
      reason,
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Post(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorActionSchema, body);
    return this.vendors.transition(
      id,
      'Suspended',
      'VENDOR_SUSPENDED',
      actorRef(principal),
      reason,
      false,
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Post(':id/reactivate')
  async reactivate(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorActionSchema, body);
    return this.vendors.transition(
      id,
      'Active',
      'VENDOR_REACTIVATED',
      actorRef(principal),
      reason,
      false,
      principal.organizationId,
    );
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Post(':id/retire')
  async retire(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(vendorActionSchema, body);
    return this.vendors.transition(
      id,
      'Retired',
      'VENDOR_RETIRED',
      actorRef(principal),
      reason,
      false,
      principal.organizationId,
    );
  }

  // --- vendor documents ---

  @Get(':id/documents')
  @Roles(...VENDOR_DOCUMENT_READ_ROLES)
  async listDocuments(
    @Param('id') vendorId: string,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.listDocuments(vendorId, principal.organizationId);
  }

  @Get(':id/documents/:documentId')
  @Roles(...VENDOR_DOCUMENT_READ_ROLES)
  async getDocument(
    @Param('id') vendorId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.getDocument(
      vendorId,
      documentId,
      principal.organizationId,
    );
  }

  @Post(':id/documents')
  @Roles(...VENDOR_CONFIG_ROLES)
  async createDocument(
    @Param('id') vendorId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.createDocument(
      vendorId,
      this.parse(createVendorDocumentSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Post(':id/documents/:documentId/confirm')
  @Roles(...VENDOR_DOCUMENT_CONFIRM_ROLES)
  async confirmDocument(
    @Param('id') vendorId: string,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.confirmDocument(
      vendorId,
      documentId,
      this.parse(confirmVendorDocumentSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Post(':id/documents/:documentId/reject')
  @Roles(...VENDOR_DOCUMENT_CONFIRM_ROLES)
  async rejectDocument(
    @Param('id') vendorId: string,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const { reason } = this.parse(rejectVendorDocumentSchema, body);
    return this.vendors.rejectDocument(
      vendorId,
      documentId,
      reason,
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Post(':id/documents/:documentId/supersede')
  @Roles(...VENDOR_CONFIG_ROLES)
  async supersedeDocument(
    @Param('id') vendorId: string,
    @Param('documentId') documentId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.supersedeDocument(
      vendorId,
      documentId,
      this.parse(createVendorDocumentSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  // --- lease contracts ---

  @Get(':id/lease-contracts')
  @Roles(...VENDOR_READ_ROLES)
  async listLeases(
    @Param('id') vendorId: string,
    @CurrentUser() principal: Principal,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.vendors.listLeases(
      Number(limit) || 50,
      Number(offset) || 0,
      principal.organizationId,
      vendorId,
    );
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Post(':id/lease-contracts')
  async createLease(
    @Param('id') vendorId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    const input = this.parse(createLeaseContractSchema, {
      ...(body as object),
      vendorId,
    });
    return this.vendors.createLease(
      input,
      actorRef(principal),
      principal.organizationId,
    );
  }

  @Get('lease-contracts/:leaseId')
  @Roles(...VENDOR_READ_ROLES)
  async getLease(
    @Param('leaseId') leaseId: string,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.getLease(leaseId, principal.organizationId);
  }

  @Roles(...VENDOR_CONFIG_ROLES)
  @Patch('lease-contracts/:leaseId')
  async updateLease(
    @Param('leaseId') leaseId: string,
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ) {
    return this.vendors.updateLease(
      leaseId,
      this.parse(updateLeaseContractSchema, body),
      actorRef(principal),
      principal.organizationId,
    );
  }

  private parse<T>(
    schema: {
      safeParse: (b: unknown) => {
        success: boolean;
        data?: T;
        error?: { issues: { message: string }[] };
      };
    },
    body: unknown,
  ): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid vendor payload',
        reasons: parsed.error?.issues.map((issue) => issue.message) ?? [
          'invalid-payload',
        ],
      });
    }
    return parsed.data as T;
  }
}
