import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toDbException } from '../../../common/database/pg-error';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';
import { OutboxService } from '../../../common/messaging/outbox.service';
import type {
  CreateLeaseContract,
  CreateVendor,
  CreateVendorDocument,
  ConfirmVendorDocument,
  LeaseContractDto,
  UpdateLeaseContract,
  UpdateVendor,
  UpdateVendorOnboardingProfile,
  VendorDto,
  VendorDocumentDto,
  VendorDocumentRequirementState,
  VendorOnboardingDto,
  VendorOnboardingProfileDto,
  VendorApprovalWorkItemDto,
  VendorSourceMode,
  VendorStatus,
} from '../../../contracts/vendor.contract';
import { VENDOR_REASON } from '../../../contracts/vendor.contract';
import { LookupService } from '../../config/services/lookup.service';
import { AuditService } from '../../platform/services/audit.service';
import { VendorRepository } from '../repositories/vendor.repository';
import { VendorSourceResolver } from './vendor-source.resolver';

type VendorRow = NonNullable<
  Awaited<ReturnType<VendorRepository['findVendorById']>>
>;
type LeaseRow = NonNullable<
  Awaited<ReturnType<VendorRepository['findLeaseById']>>
>;
type VendorDocumentRow = NonNullable<
  Awaited<ReturnType<VendorRepository['findDocumentById']>>
>;
type VendorOnboardingProfileRow = NonNullable<
  Awaited<ReturnType<VendorRepository['findOnboardingProfile']>>
>;

/** Lookup type that governs the configurable vendor categories (ADR-009). */
const VENDOR_CATEGORY_LOOKUP = 'vendor-category';
const VENDOR_DOCUMENT_TYPE_LOOKUP = 'vendor-document-type';

/** Allowed vendor lifecycle transitions (S1). */
const VENDOR_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  Draft: ['PendingApproval', 'Retired'],
  PendingApproval: ['Active', 'Draft', 'Retired'],
  Active: ['Suspended', 'Retired'],
  Suspended: ['Active', 'Retired'],
  Retired: [],
};

/**
 * The vendor master + lease-contract service (S1/S2). Owns CRUD, the
 * Procurement-approval lifecycle (SoD), lookup-validated categories, IBAN
 * masking, and the plug-and-play source seam. Every state change writes domain
 * state + audit + a `VendorChanged`/`LeaseContractChanged` outbox event in one
 * transaction.
 */
@Injectable()
export class VendorService {
  constructor(
    private readonly repo: VendorRepository,
    private readonly lookups: LookupService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly source: VendorSourceResolver,
  ) {}

  // --- vendor ---

  async create(
    input: CreateVendor,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDto> {
    const sourceMode: VendorSourceMode = input.sourceMode ?? 'Manual';
    this.source.assertManualWrite(sourceMode);
    await this.requireCategory(input.categoryCode);
    try {
      return await this.repo.transaction(async (tx) => {
        const created = await this.repo.insertVendor(
          {
            organizationId,
            legalName: input.legalName,
            tradeName: input.tradeName ?? null,
            tradeLicenceNumber: input.tradeLicenceNumber ?? null,
            tradeLicenceEmirate: input.tradeLicenceEmirate ?? null,
            taxRegistrationNumber: input.taxRegistrationNumber ?? null,
            categoryCode: input.categoryCode,
            primaryContactName: input.primaryContactName ?? null,
            primaryContactRole: input.primaryContactRole ?? null,
            primaryContactEmail: input.primaryContactEmail ?? null,
            primaryContactPhone: input.primaryContactPhone ?? null,
            paymentTerms: input.paymentTerms ?? null,
            currency: input.currency ?? 'AED',
            bankIbanMasked: maskIban(input.bankIban),
            sourceMode,
            sourceSystem: input.sourceSystem ?? null,
            externalRef: input.externalRef ?? null,
            // Manual/integrated records start flagged until a steward verifies.
            dataQualityFlag: true,
            vendorPortalEnabled: input.vendorPortalEnabled ?? false,
            status: 'Draft',
            createdByActorRef: actorRef,
            notes: input.notes ?? null,
          },
          tx,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'VENDOR_CREATED',
            entityRef: `vendor:${created.id}`,
            after: { legalName: created.legalName, sourceMode },
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vendor',
            aggregateId: created.id,
            eventType: 'VendorChanged',
            payload: { change: 'created', legalName: created.legalName },
          },
          tx,
        );
        return toVendorDto(created);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  async list(
    limit: number,
    offset: number,
    organizationId = DEFAULT_ORGANIZATION_ID,
    status?: VendorStatus,
  ): Promise<VendorDto[]> {
    const rows = await this.repo.listVendors(
      limit,
      offset,
      organizationId,
      status,
    );
    return rows.map(toVendorDto);
  }

  async get(
    id: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDto> {
    return toVendorDto(await this.requireVendor(id, organizationId));
  }

  /** Lists organization-scoped Vendor approvals with maker and completeness evidence. */
  async listApprovalWorkItems(
    limit: number,
    offset: number,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorApprovalWorkItemDto[]> {
    const rows = await this.repo.listVendors(
      limit,
      offset,
      organizationId,
      'PendingApproval',
    );
    return Promise.all(
      rows.map(async (row) => {
        const onboarding = await this.getOnboarding(row.id, organizationId);
        return {
          vendorId: row.id,
          legalName: row.legalName,
          categoryCode: row.categoryCode,
          sourceMode: row.sourceMode,
          makerActorRef: row.createdByActorRef,
          submitterActorRef: row.submittedByActorRef ?? row.createdByActorRef,
          submittedAtUtc: row.submittedAtUtc?.toISOString() ?? null,
          assignedAuthorityRole: 'Procurement',
          updatedAtUtc: row.updatedAtUtc.toISOString(),
          completeness: onboarding.completeness,
          documentRequirements: onboarding.documentRequirements,
          changeSummary: {
            identityUpdated:
              row.updatedAtUtc.getTime() > row.createdAtUtc.getTime(),
            termsCaptured: onboarding.profile !== null,
            confirmedDocuments: onboarding.documentRequirements.filter(
              (document) => document.state === 'Confirmed',
            ).length,
            pendingDocuments: onboarding.documentRequirements.filter(
              (document) => document.state === 'PendingConfirmation',
            ).length,
          },
        };
      }),
    );
  }

  /** Returns a submitted Vendor to Draft with an actionable, audited reason. */
  async requestChanges(
    id: string,
    reason: string,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDto> {
    if (!reason.trim()) {
      throw new BadRequestException({
        title: 'Vendor change request requires a reason',
        reasons: ['vendor-change-request-reason-required'],
      });
    }
    return this.transition(
      id,
      'Draft',
      'VENDOR_CHANGE_REQUESTED',
      actorRef,
      reason.trim(),
      false,
      organizationId,
    );
  }

  async update(
    id: string,
    input: UpdateVendor,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDto> {
    const existing = await this.requireVendor(id, organizationId);
    this.source.assertManualWrite(existing.sourceMode as VendorSourceMode);
    if (input.categoryCode) await this.requireCategory(input.categoryCode);
    const set: Record<string, unknown> = {
      legalName: input.legalName,
      tradeName: input.tradeName,
      tradeLicenceNumber: input.tradeLicenceNumber,
      tradeLicenceEmirate: input.tradeLicenceEmirate,
      taxRegistrationNumber: input.taxRegistrationNumber,
      categoryCode: input.categoryCode,
      primaryContactName: input.primaryContactName,
      primaryContactRole: input.primaryContactRole,
      primaryContactEmail: input.primaryContactEmail,
      primaryContactPhone: input.primaryContactPhone,
      paymentTerms: input.paymentTerms,
      currency: input.currency,
      vendorPortalEnabled: input.vendorPortalEnabled,
      notes: input.notes,
    };
    if (input.bankIban !== undefined)
      set.bankIbanMasked = maskIban(input.bankIban);
    for (const k of Object.keys(set)) if (set[k] === undefined) delete set[k];
    try {
      return await this.repo.transaction(async (tx) => {
        const updated = await this.repo.updateVendor(
          id,
          set as Parameters<VendorRepository['updateVendor']>[1],
          tx,
          organizationId,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'VENDOR_UPDATED',
            entityRef: `vendor:${id}`,
            after: set,
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vendor',
            aggregateId: id,
            eventType: 'VendorChanged',
            payload: { change: 'updated' },
          },
          tx,
        );
        return toVendorDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  /** Returns persisted draft data with a server-owned completeness projection. */
  async getOnboarding(
    id: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorOnboardingDto> {
    const vendorRow = await this.requireVendor(id, organizationId);
    const [profile, rules, documents] = await Promise.all([
      this.repo.findOnboardingProfile(id, organizationId),
      this.lookups.getValueRules(VENDOR_DOCUMENT_TYPE_LOOKUP),
      this.repo.listDocuments(id, organizationId),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const documentRequirements = rules.map((rule) => {
      const confirmed = documents.find(
        (document) =>
          document.documentTypeCode === rule.code &&
          document.status === 'Confirmed',
      );
      const pending = documents.some(
        (document) =>
          document.documentTypeCode === rule.code &&
          ['Uploaded', 'PendingConfirmation'].includes(document.status),
      );
      let state: VendorDocumentRequirementState = 'Missing';
      if (confirmed) {
        state =
          rule.metadata?.tracksExpiry === true &&
          (!confirmed.expiryDate || confirmed.expiryDate < today)
            ? 'Expired'
            : 'Confirmed';
      } else if (pending) {
        state = 'PendingConfirmation';
      }
      return {
        code: rule.code,
        required: rule.metadata?.required === true,
        tracksExpiry: rule.metadata?.tracksExpiry === true,
        state,
      };
    });
    const requiredFields: Array<[string, unknown]> = [
      ['identity.legalName', vendorRow.legalName],
      ['identity.categoryCode', vendorRow.categoryCode],
      ['identity.primaryContactName', vendorRow.primaryContactName],
      ['identity.primaryContactEmail', vendorRow.primaryContactEmail],
      ['identity.primaryContactPhone', vendorRow.primaryContactPhone],
      ['commercial.paymentTerms', vendorRow.paymentTerms],
      ['terms.standardOffHireNoticeDays', profile?.standardOffHireNoticeDays],
      ['terms.earlyTerminationPenalty', profile?.earlyTerminationPenalty],
      ['terms.renewalOptions', profile?.renewalOptions],
      ['terms.escalationClause', profile?.escalationClause],
      ['terms.replacementClause', profile?.replacementClause],
      ['terms.alertLadder', profile?.alertLadder],
      ['access.mode', profile?.accessMode],
      ...documentRequirements
        .filter((requirement) => requirement.required)
        .map(
          (requirement) =>
            [
              `documents.${requirement.code}`,
              requirement.state === 'Confirmed',
            ] as [string, unknown],
        ),
    ];
    const missing = requiredFields
      .filter(([, value]) =>
        typeof value === 'string' ? value.trim().length === 0 : !value,
      )
      .map(([field]) => field);
    return {
      vendor: toVendorDto(vendorRow),
      profile: profile ? toVendorOnboardingProfileDto(profile) : null,
      documentRequirements,
      completeness: {
        completed: requiredFields.length - missing.length,
        required: requiredFields.length,
        missing,
        canSubmit: vendorRow.status === 'Draft',
        canActivate: missing.length === 0,
      },
    };
  }

  /** Upserts reusable onboarding defaults with audit and outbox evidence. */
  async updateOnboardingProfile(
    id: string,
    input: UpdateVendorOnboardingProfile,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorOnboardingDto> {
    const vendorRow = await this.requireVendor(id, organizationId);
    this.source.assertManualWrite(vendorRow.sourceMode as VendorSourceMode);
    const existing = await this.repo.findOnboardingProfile(id, organizationId);
    const values = {
      organizationId,
      vendorId: id,
      standardOffHireNoticeDays:
        input.standardOffHireNoticeDays !== undefined
          ? input.standardOffHireNoticeDays
          : (existing?.standardOffHireNoticeDays ?? null),
      earlyTerminationPenalty:
        input.earlyTerminationPenalty !== undefined
          ? input.earlyTerminationPenalty
          : (existing?.earlyTerminationPenalty ?? null),
      renewalOptions:
        input.renewalOptions !== undefined
          ? input.renewalOptions
          : (existing?.renewalOptions ?? null),
      escalationClause:
        input.escalationClause !== undefined
          ? input.escalationClause
          : (existing?.escalationClause ?? null),
      replacementClause:
        input.replacementClause !== undefined
          ? input.replacementClause
          : (existing?.replacementClause ?? null),
      alertLadder:
        input.alertLadder !== undefined
          ? input.alertLadder
          : (existing?.alertLadder ?? null),
      accessMode: input.accessMode ?? existing?.accessMode ?? 'ManualInternal',
    };
    await this.repo.transaction(async (tx) => {
      await this.repo.upsertOnboardingProfile(values, tx);
      await this.audit.record(
        {
          actorRef,
          action: 'VENDOR_ONBOARDING_PROFILE_UPDATED',
          entityRef: `vendor:${id}`,
          after: values,
          organizationId,
        },
        tx,
      );
      await this.outbox.enqueue(
        {
          aggregateType: 'vendor',
          aggregateId: id,
          eventType: 'VendorChanged',
          payload: { change: 'onboarding-profile-updated' },
        },
        tx,
      );
    });
    return this.getOnboarding(id, organizationId);
  }

  /** Applies a guarded lifecycle transition (submit/approve/reject/…). */
  async transition(
    id: string,
    to: VendorStatus,
    action: string,
    actorRef = 'system',
    reason?: string,
    clearDataQualityFlag = false,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDto> {
    const existing = await this.requireVendor(id, organizationId);
    this.source.assertManualWrite(existing.sourceMode as VendorSourceMode);
    const from = existing.status as VendorStatus;
    if (!VENDOR_TRANSITIONS[from].includes(to)) {
      throw new ConflictException({
        title: 'Invalid vendor lifecycle transition',
        reasons: [`vendor-transition-invalid:${from}->${to}`],
      });
    }
    if (
      action === 'VENDOR_APPROVED' &&
      (existing.createdByActorRef === actorRef ||
        existing.submittedByActorRef === actorRef)
    ) {
      throw new ForbiddenException({
        title: 'Vendor approval requires a separate actor',
        reasons: [VENDOR_REASON.selfApproval],
      });
    }
    if (to === 'Active') {
      await this.assertActivationEvidenceComplete(id, organizationId);
    }
    return this.repo.transaction(async (tx) => {
      const transitionSet = clearDataQualityFlag
        ? { status: to, dataQualityFlag: false }
        : { status: to };
      const updated = await this.repo.updateVendor(
        id,
        action === 'VENDOR_SUBMITTED'
          ? {
              ...transitionSet,
              submittedByActorRef: actorRef,
              submittedAtUtc: new Date(),
            }
          : transitionSet,
        tx,
        organizationId,
      );
      await this.reconcileLinkedVehicleHealth(
        tx,
        actorRef,
        organizationId,
        id,
      );
      await this.audit.record(
        {
          actorRef,
          action,
          entityRef: `vendor:${id}`,
          before: { status: from },
          after: { status: to },
          reason,
          organizationId,
        },
        tx,
      );
      await this.outbox.enqueue(
        {
          aggregateType: 'vendor',
          aggregateId: id,
          eventType: 'VendorChanged',
          payload: { change: 'transition', from, to },
        },
        tx,
      );
      return toVendorDto(updated);
    });
  }

  // --- lease contract ---

  async createLease(
    input: CreateLeaseContract,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<LeaseContractDto> {
    const vendorRow = await this.requireVendor(input.vendorId, organizationId);
    if (vendorRow.status !== 'Active') {
      throw new ConflictException({
        title: 'Lease contract requires an active vendor',
        reasons: [VENDOR_REASON.leaseVendorNotActive],
      });
    }
    try {
      return await this.repo.transaction(async (tx) => {
        const created = await this.repo.insertLease(
          {
            organizationId,
            vendorId: input.vendorId,
            contractRef: input.contractRef,
            scopeNodeId: input.scopeNodeId ?? null,
            monthlyAmount: input.monthlyAmount ?? null,
            currency: input.currency ?? 'AED',
            startDate: input.startDate ?? null,
            endDate: input.endDate ?? null,
            offHireNoticeDays:
              input.offHireNoticeDays === undefined
                ? null
                : String(input.offHireNoticeDays),
            earlyTerminationPenalty: input.earlyTerminationPenalty ?? null,
            renewalOptions: input.renewalOptions ?? null,
            escalationClause: input.escalationClause ?? null,
            replacementClause: input.replacementClause ?? null,
            alertLadder: input.alertLadder ?? '90/60/30',
            status: 'Active',
          },
          tx,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'LEASE_CONTRACT_CREATED',
            entityRef: `lease-contract:${created.id}`,
            after: {
              contractRef: created.contractRef,
              vendorId: input.vendorId,
            },
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'lease-contract',
            aggregateId: created.id,
            eventType: 'LeaseContractChanged',
            payload: { change: 'created', contractRef: created.contractRef },
          },
          tx,
        );
        return toLeaseDto(created);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  async listLeases(
    limit: number,
    offset: number,
    organizationId = DEFAULT_ORGANIZATION_ID,
    vendorId?: string,
  ): Promise<LeaseContractDto[]> {
    const rows = await this.repo.listLeases(
      limit,
      offset,
      organizationId,
      vendorId,
    );
    return rows.map(toLeaseDto);
  }

  async getLease(
    id: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<LeaseContractDto> {
    return toLeaseDto(await this.requireLease(id, organizationId));
  }

  /** Validates and returns an active lease selected for leased Vehicle onboarding. */
  async requireUsableVehicleLease(
    vendorId: string,
    leaseId: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<LeaseContractDto> {
    const vendorRow = await this.requireVendor(vendorId, organizationId);
    if (vendorRow.status !== 'Active') {
      throw new ConflictException({
        title: 'Leased vehicle requires an active vendor',
        reasons: [VENDOR_REASON.leaseVendorNotActive],
      });
    }
    const lease = await this.requireLease(leaseId, organizationId);
    if (lease.vendorId !== vendorId) {
      throw new ConflictException({
        title: 'Lease contract does not belong to the selected vendor',
        reasons: [VENDOR_REASON.leaseVendorMismatch],
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (
      !['Active', 'ExpiringSoon'].includes(lease.status) ||
      (lease.endDate !== null && lease.endDate < today)
    ) {
      throw new ConflictException({
        title: 'Lease contract is not usable for vehicle onboarding',
        reasons: [VENDOR_REASON.leaseNotUsable],
      });
    }
    return toLeaseDto(lease);
  }

  async updateLease(
    id: string,
    input: UpdateLeaseContract,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<LeaseContractDto> {
    const existing = await this.requireLease(id, organizationId);
    const set: Record<string, unknown> = {
      scopeNodeId: input.scopeNodeId,
      monthlyAmount: input.monthlyAmount,
      currency: input.currency,
      startDate: input.startDate,
      endDate: input.endDate,
      offHireNoticeDays:
        input.offHireNoticeDays === undefined
          ? undefined
          : String(input.offHireNoticeDays),
      earlyTerminationPenalty: input.earlyTerminationPenalty,
      renewalOptions: input.renewalOptions,
      escalationClause: input.escalationClause,
      replacementClause: input.replacementClause,
      alertLadder: input.alertLadder,
      status: input.status,
      renewedIntoContractRef: input.renewedIntoContractRef,
    };
    for (const k of Object.keys(set)) if (set[k] === undefined) delete set[k];
    try {
      return await this.repo.transaction(async (tx) => {
        const updated = await this.repo.updateLease(
          id,
          set as Parameters<VendorRepository['updateLease']>[1],
          tx,
          organizationId,
        );
        await this.reconcileLinkedVehicleHealth(
          tx,
          actorRef,
          organizationId,
          existing.vendorId,
          id,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'LEASE_CONTRACT_UPDATED',
            entityRef: `lease-contract:${id}`,
            after: set,
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'lease-contract',
            aggregateId: id,
            eventType: 'LeaseContractChanged',
            payload: { change: 'updated' },
          },
          tx,
        );
        return toLeaseDto(updated);
      });
    } catch (error) {
      throw toDbException(error);
    }
  }

  // --- vendor documents ---

  /** Lists every immutable document version for one Vendor. */
  async listDocuments(
    vendorId: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDocumentDto[]> {
    await this.requireVendor(vendorId, organizationId);
    return (await this.repo.listDocuments(vendorId, organizationId)).map(
      toVendorDocumentDto,
    );
  }

  /** Returns one Vendor document version inside the caller organization. */
  async getDocument(
    vendorId: string,
    documentId: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDocumentDto> {
    return toVendorDocumentDto(
      await this.requireDocument(documentId, vendorId, organizationId),
    );
  }

  /** Creates one pending Vendor document version for manual confirmation. */
  async createDocument(
    vendorId: string,
    input: CreateVendorDocument,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDocumentDto> {
    const vendorRow = await this.requireVendor(vendorId, organizationId);
    this.source.assertManualWrite(vendorRow.sourceMode as VendorSourceMode);
    await this.requireDocumentType(input.documentTypeCode);
    this.assertDocumentDates(input.issueDate, input.expiryDate);
    this.assertDocumentBlobRef(input.blobRef);
    try {
      return await this.repo.transaction(async (tx) => {
        const version = await this.repo.nextDocumentVersion(
          vendorId,
          input.documentTypeCode,
          organizationId,
          tx,
        );
        const created = await this.repo.insertDocument(
          {
            organizationId,
            vendorId,
            documentTypeCode: input.documentTypeCode,
            version,
            documentReference: input.documentReference ?? null,
            blobRef: input.blobRef,
            issueDate: input.issueDate ?? null,
            expiryDate: input.expiryDate ?? null,
            status: 'PendingConfirmation',
            extractedMetadata: null,
            createdByActorRef: actorRef,
          },
          tx,
        );
        await this.audit.record(
          {
            actorRef,
            action: 'VENDOR_DOCUMENT_CREATED',
            entityRef: `vendor-document:${created.id}`,
            after: {
              vendorId,
              documentTypeCode: created.documentTypeCode,
              version,
              status: created.status,
            },
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vendor-document',
            aggregateId: created.id,
            eventType: 'VendorDocumentChanged',
            payload: {
              change: 'created',
              vendorId,
              documentTypeCode: created.documentTypeCode,
              version,
            },
          },
          tx,
        );
        return toVendorDocumentDto(created);
      });
    } catch (error) {
      throw this.mapDocumentDbError(error);
    }
  }

  /** Confirms a pending version and atomically supersedes the previous confirmed version. */
  async confirmDocument(
    vendorId: string,
    documentId: string,
    input: ConfirmVendorDocument,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDocumentDto> {
    const vendorRow = await this.requireVendor(vendorId, organizationId);
    this.source.assertManualWrite(vendorRow.sourceMode as VendorSourceMode);
    const existing = await this.requireDocument(
      documentId,
      vendorId,
      organizationId,
    );
    this.assertDocumentTransition(
      existing,
      ['Uploaded', 'PendingConfirmation'],
      'Confirmed',
    );
    const issueDate = input.issueDate ?? existing.issueDate;
    const expiryDate = input.expiryDate ?? existing.expiryDate;
    this.assertDocumentDates(issueDate, expiryDate);
    try {
      return await this.repo.transaction(async (tx) => {
        const previous = await this.repo.currentConfirmedDocument(
          vendorId,
          existing.documentTypeCode,
          organizationId,
          existing.id,
          tx,
        );
        if (previous) {
          const superseded = await this.repo.updateDocument(
            previous.id,
            organizationId,
            { status: 'Superseded', supersededById: existing.id },
            tx,
            ['Confirmed'],
          );
          if (!superseded) throw this.documentVersionConflict();
        }
        const confirmed = await this.repo.updateDocument(
          existing.id,
          organizationId,
          {
            status: 'Confirmed',
            documentReference:
              input.documentReference ?? existing.documentReference,
            issueDate,
            expiryDate,
            confirmedMetadata: input.confirmedMetadata ?? {},
            confirmedByActorRef: actorRef,
            confirmedAtUtc: new Date(),
          },
          tx,
          ['Uploaded', 'PendingConfirmation'],
        );
        if (!confirmed) throw this.documentVersionConflict();
        await this.audit.record(
          {
            actorRef,
            action: 'VENDOR_DOCUMENT_CONFIRMED',
            entityRef: `vendor-document:${existing.id}`,
            before: { status: existing.status },
            after: { status: 'Confirmed', previousVersionId: previous?.id },
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vendor-document',
            aggregateId: existing.id,
            eventType: 'VendorDocumentChanged',
            payload: {
              change: 'confirmed',
              vendorId,
              documentTypeCode: existing.documentTypeCode,
              version: existing.version,
            },
          },
          tx,
        );
        return toVendorDocumentDto(confirmed);
      });
    } catch (error) {
      throw this.mapDocumentDbError(error);
    }
  }

  /** Rejects a pending Vendor document version while preserving its evidence. */
  async rejectDocument(
    vendorId: string,
    documentId: string,
    reason: string,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDocumentDto> {
    const vendorRow = await this.requireVendor(vendorId, organizationId);
    this.source.assertManualWrite(vendorRow.sourceMode as VendorSourceMode);
    const existing = await this.requireDocument(
      documentId,
      vendorId,
      organizationId,
    );
    this.assertDocumentTransition(
      existing,
      ['Uploaded', 'PendingConfirmation'],
      'Rejected',
    );
    return this.repo.transaction(async (tx) => {
      const predecessor = await this.repo.predecessorDocument(
        existing.id,
        organizationId,
        tx,
      );
      const rejected = await this.repo.updateDocument(
        existing.id,
        organizationId,
        { status: 'Rejected' },
        tx,
        ['Uploaded', 'PendingConfirmation'],
      );
      if (!rejected) throw this.documentVersionConflict();
      if (predecessor) {
        const released = await this.repo.updateDocument(
          predecessor.id,
          organizationId,
          { supersededById: null },
          tx,
          ['Confirmed'],
        );
        if (!released) throw this.documentVersionConflict();
      }
      await this.audit.record(
        {
          actorRef,
          action: 'VENDOR_DOCUMENT_REJECTED',
          entityRef: `vendor-document:${existing.id}`,
          before: { status: existing.status },
          after: { status: 'Rejected' },
          reason,
          organizationId,
        },
        tx,
      );
      await this.outbox.enqueue(
        {
          aggregateType: 'vendor-document',
          aggregateId: existing.id,
          eventType: 'VendorDocumentChanged',
          payload: { change: 'rejected', vendorId, reason },
        },
        tx,
      );
      return toVendorDocumentDto(rejected);
    });
  }

  /** Replaces an existing version with a new pending version and preserves lineage. */
  async supersedeDocument(
    vendorId: string,
    documentId: string,
    input: CreateVendorDocument,
    actorRef = 'system',
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<VendorDocumentDto> {
    const vendorRow = await this.requireVendor(vendorId, organizationId);
    this.source.assertManualWrite(vendorRow.sourceMode as VendorSourceMode);
    const existing = await this.requireDocument(
      documentId,
      vendorId,
      organizationId,
    );
    if (input.documentTypeCode !== existing.documentTypeCode) {
      throw new BadRequestException({
        title: 'A superseding document must keep its document type',
        reasons: [VENDOR_REASON.documentTypeInvalid],
      });
    }
    if (existing.status !== 'Confirmed' || existing.supersededById) {
      throw this.invalidDocumentTransition(existing.status, 'Superseded');
    }
    this.assertDocumentDates(input.issueDate, input.expiryDate);
    this.assertDocumentBlobRef(input.blobRef);
    try {
      return await this.repo.transaction(async (tx) => {
        const version = await this.repo.nextDocumentVersion(
          vendorId,
          existing.documentTypeCode,
          organizationId,
          tx,
        );
        const replacement = await this.repo.insertDocument(
          {
            organizationId,
            vendorId,
            documentTypeCode: existing.documentTypeCode,
            version,
            documentReference: input.documentReference ?? null,
            blobRef: input.blobRef,
            issueDate: input.issueDate ?? null,
            expiryDate: input.expiryDate ?? null,
            status: 'PendingConfirmation',
            extractedMetadata: null,
            createdByActorRef: actorRef,
          },
          tx,
        );
        const linked = await this.repo.updateDocument(
          existing.id,
          organizationId,
          { supersededById: replacement.id },
          tx,
          ['Confirmed'],
        );
        if (!linked) throw this.documentVersionConflict();
        await this.audit.record(
          {
            actorRef,
            action: 'VENDOR_DOCUMENT_SUPERSEDED',
            entityRef: `vendor-document:${existing.id}`,
            before: { status: existing.status, version: existing.version },
            after: { replacementId: replacement.id, version },
            organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vendor-document',
            aggregateId: replacement.id,
            eventType: 'VendorDocumentChanged',
            payload: {
              change: 'superseded',
              vendorId,
              previousId: existing.id,
              version,
            },
          },
          tx,
        );
        return toVendorDocumentDto(replacement);
      });
    } catch (error) {
      throw this.mapDocumentDbError(error);
    }
  }

  // --- helpers ---

  /** Reconciles every leased Vehicle, used by the scheduled expiry worker. */
  async reconcileAllLinkedVehicleHealth(
    actorRef = 'vendor-health-scheduler',
  ): Promise<{ held: number; released: number; updated: number }> {
    return this.repo.transaction(async (tx) => {
      await this.repo.acquireVehicleHealthLock(tx);
      return this.reconcileLinkedVehicleHealth(tx, actorRef);
    });
  }

  /** Applies or releases automatic holds without overwriting manual Vehicle state. */
  private async reconcileLinkedVehicleHealth(
    tx: Parameters<Parameters<VendorRepository['transaction']>[0]>[0],
    actorRef: string,
    organizationId?: string,
    vendorId?: string,
    leaseId?: string,
  ): Promise<{ held: number; released: number; updated: number }> {
    const rows = await this.repo.listLinkedVehicleHealth(
      tx,
      organizationId,
      vendorId,
      leaseId,
    );
    const today = new Date().toISOString().slice(0, 10);
    const result = { held: 0, released: 0, updated: 0 };
    for (const row of rows) {
      const reasons = linkedVehicleHealthReasons(row, today);
      const current = row.vehicle;
      if (reasons.length > 0) {
        const reason = reasons.join('|');
        if (
          current.vendorHealthHold &&
          current.vendorHealthHoldReason === reason
        )
          continue;
        const firstHold = !current.vendorHealthHold;
        await this.repo.updateLinkedVehicle(
          current.id,
          current.organizationId,
          {
            vendorHealthHold: true,
            vendorHealthHoldReason: reason,
            vendorHealthPreviousOperationalStatus: firstHold
              ? current.operationalStatus
              : current.vendorHealthPreviousOperationalStatus,
            vendorHealthPreviousBookingPoolFlag: firstHold
              ? current.bookingPoolFlag
              : current.vendorHealthPreviousBookingPoolFlag,
            vendorHealthHeldAtUtc: firstHold
              ? new Date()
              : current.vendorHealthHeldAtUtc,
            operationalStatus: 'Quarantined',
            bookingPoolFlag: false,
          },
          tx,
        );
        if (firstHold) {
          await this.repo.insertVehicleHealthHistory(
            {
              vehicleId: current.id,
              fromStatus: `Operational:${current.operationalStatus ?? 'None'}`,
              toStatus: 'Operational:Quarantined',
              reason: `vendor-health-hold:${reason}`,
              actorRef,
            },
            tx,
          );
          result.held += 1;
        } else {
          result.updated += 1;
        }
        await this.audit.record(
          {
            actorRef,
            action: firstHold
              ? 'VEHICLE_VENDOR_HEALTH_HELD'
              : 'VEHICLE_VENDOR_HEALTH_HOLD_UPDATED',
            entityRef: `vehicle:${current.id}`,
            before: {
              operationalStatus: current.operationalStatus,
              bookingPoolFlag: current.bookingPoolFlag,
              reason: current.vendorHealthHoldReason,
            },
            after: {
              operationalStatus: 'Quarantined',
              bookingPoolFlag: false,
              reason,
            },
            organizationId: current.organizationId,
          },
          tx,
        );
        await this.outbox.enqueue(
          {
            aggregateType: 'vehicle',
            aggregateId: current.id,
            eventType: 'VehicleChanged',
            payload: {
              change: firstHold
                ? 'vendor-health-held'
                : 'vendor-health-hold-updated',
              reason,
            },
          },
          tx,
        );
        continue;
      }
      if (!current.vendorHealthHold) continue;
      const restoredPool =
        current.vendorHealthPreviousBookingPoolFlag === true &&
        vehicleComplianceIsCurrent(current, today);
      await this.repo.updateLinkedVehicle(
        current.id,
        current.organizationId,
        {
          operationalStatus: current.vendorHealthPreviousOperationalStatus,
          bookingPoolFlag: restoredPool,
          vendorHealthHold: false,
          vendorHealthHoldReason: null,
          vendorHealthPreviousOperationalStatus: null,
          vendorHealthPreviousBookingPoolFlag: null,
          vendorHealthHeldAtUtc: null,
        },
        tx,
      );
      await this.repo.insertVehicleHealthHistory(
        {
          vehicleId: current.id,
          fromStatus: 'Operational:Quarantined',
          toStatus: `Operational:${current.vendorHealthPreviousOperationalStatus ?? 'None'}`,
          reason: restoredPool
            ? 'vendor-health-restored'
            : 'vendor-health-restored-compliance-blocked',
          actorRef,
        },
        tx,
      );
      await this.audit.record(
        {
          actorRef,
          action: 'VEHICLE_VENDOR_HEALTH_RELEASED',
          entityRef: `vehicle:${current.id}`,
          before: {
            operationalStatus: current.operationalStatus,
            bookingPoolFlag: current.bookingPoolFlag,
            reason: current.vendorHealthHoldReason,
          },
          after: {
            operationalStatus: current.vendorHealthPreviousOperationalStatus,
            bookingPoolFlag: restoredPool,
          },
          organizationId: current.organizationId,
        },
        tx,
      );
      await this.outbox.enqueue(
        {
          aggregateType: 'vehicle',
          aggregateId: current.id,
          eventType: 'VehicleChanged',
          payload: {
            change: 'vendor-health-released',
            bookingPoolFlag: restoredPool,
          },
        },
        tx,
      );
      result.released += 1;
    }
    return result;
  }

  private async requireVendor(
    id: string,
    organizationId: string,
  ): Promise<VendorRow> {
    const found = await this.repo.findVendorById(id, organizationId);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown vendor',
        reasons: [`${VENDOR_REASON.notFound}:${id}`],
      });
    }
    return found;
  }

  private async requireLease(
    id: string,
    organizationId: string,
  ): Promise<LeaseRow> {
    const found = await this.repo.findLeaseById(id, organizationId);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown lease contract',
        reasons: [`${VENDOR_REASON.leaseNotFound}:${id}`],
      });
    }
    return found;
  }

  /** Requires one Vendor document version inside its organization and parent. */
  private async requireDocument(
    id: string,
    vendorId: string,
    organizationId: string,
  ): Promise<VendorDocumentRow> {
    const found = await this.repo.findDocumentById(
      id,
      vendorId,
      organizationId,
    );
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown vendor document',
        reasons: [`${VENDOR_REASON.documentNotFound}:${id}`],
      });
    }
    return found;
  }

  private async requireCategory(code: string): Promise<void> {
    const values = await this.lookups.getValues(VENDOR_CATEGORY_LOOKUP);
    if (!values.some((v) => v.code === code)) {
      throw new BadRequestException({
        title: 'Invalid vendor category',
        reasons: [`${VENDOR_REASON.categoryInvalid}:${code}`],
      });
    }
  }

  /** Requires a configured Vendor document type lookup code. */
  private async requireDocumentType(code: string): Promise<void> {
    const values = await this.lookups.getValues(VENDOR_DOCUMENT_TYPE_LOOKUP);
    if (!values.some((value) => value.code === code)) {
      throw new BadRequestException({
        title: 'Invalid vendor document type',
        reasons: [`${VENDOR_REASON.documentTypeInvalid}:${code}`],
      });
    }
  }

  /** Requires every configured activation document to be confirmed and current. */
  private async assertActivationEvidenceComplete(
    vendorId: string,
    organizationId: string,
  ): Promise<void> {
    const documentRules = await this.lookups.getValueRules(
      VENDOR_DOCUMENT_TYPE_LOOKUP,
    );
    const today = new Date().toISOString().slice(0, 10);
    const reasons: string[] = [];

    await Promise.all(
      documentRules
        .filter((rule) => rule.metadata?.required === true)
        .map(async (rule) => {
          const document = await this.repo.currentConfirmedDocument(
            vendorId,
            rule.code,
            organizationId,
          );
          if (!document) {
            reasons.push(`vendor-required-document-missing:${rule.code}`);
            return;
          }
          if (
            rule.metadata?.tracksExpiry === true &&
            (!document.expiryDate || document.expiryDate < today)
          ) {
            reasons.push(`vendor-required-document-not-current:${rule.code}`);
          }
        }),
    );

    if (reasons.length > 0) {
      throw new ConflictException({
        title: 'Vendor activation evidence is incomplete',
        reasons: [
          VENDOR_REASON.activationEvidenceIncomplete,
          ...reasons.sort(),
        ],
      });
    }
  }

  /** Enforces issue/expiry chronology for direct typed callers. */
  private assertDocumentDates(
    issueDate?: string | null,
    expiryDate?: string | null,
  ): void {
    if (issueDate && expiryDate && expiryDate < issueDate) {
      throw new BadRequestException({
        title: 'Vendor document expiry precedes its issue date',
        reasons: [VENDOR_REASON.documentInvalidDateRange],
      });
    }
  }

  /** Requires an opaque object key under the approved Vendor document prefix. */
  private assertDocumentBlobRef(blobRef: string): void {
    if (
      blobRef.length > 512 ||
      !/^vendor-documents\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(blobRef) ||
      blobRef.includes('..') ||
      blobRef.includes('//')
    ) {
      throw new BadRequestException({
        title: 'Invalid Vendor document storage reference',
        reasons: [VENDOR_REASON.documentStorageRefInvalid],
      });
    }
  }

  /** Requires a permitted document lifecycle transition. */
  private assertDocumentTransition(
    document: VendorDocumentRow,
    allowed: VendorDocumentRow['status'][],
    target: VendorDocumentRow['status'],
  ): void {
    if (!allowed.includes(document.status)) {
      throw this.invalidDocumentTransition(document.status, target);
    }
  }

  /** Creates a stable invalid-transition response for Vendor documents. */
  private invalidDocumentTransition(
    from: VendorDocumentRow['status'],
    to: VendorDocumentRow['status'],
  ): ConflictException {
    return new ConflictException({
      title: 'Invalid vendor document lifecycle transition',
      reasons: [`${VENDOR_REASON.documentInvalidTransition}:${from}->${to}`],
    });
  }

  /** Creates the stable concurrent-version conflict response. */
  private documentVersionConflict(): ConflictException {
    return new ConflictException({
      title: 'Vendor document version changed concurrently',
      reasons: [VENDOR_REASON.documentVersionConflict, 'retryable'],
    });
  }

  /** Maps document constraint races to a stable version conflict. */
  private mapDocumentDbError(error: unknown): Error {
    const mapped = toDbException(error);
    return mapped instanceof ConflictException
      ? this.documentVersionConflict()
      : mapped;
  }
}

/** Masks an IBAN, keeping the first 2 and last 4 characters. */
function maskIban(iban?: string): string | null {
  if (!iban) return null;
  const trimmed = iban.replace(/\s+/g, '');
  if (trimmed.length <= 6) return '*'.repeat(trimmed.length);
  return `${trimmed.slice(0, 2)}${'*'.repeat(trimmed.length - 6)}${trimmed.slice(-4)}`;
}

/** Returns stable unhealthy dependency reasons for one linked leased Vehicle. */
function linkedVehicleHealthReasons(
  row: Awaited<ReturnType<VendorRepository['listLinkedVehicleHealth']>>[number],
  today: string,
): string[] {
  const reasons: string[] = [];
  if (row.vendorStatus !== 'Active')
    reasons.push(`vendor-status:${row.vendorStatus}`);
  if (!['Active', 'ExpiringSoon'].includes(row.leaseStatus))
    reasons.push(`lease-status:${row.leaseStatus}`);
  if (row.leaseEndDate && row.leaseEndDate < today)
    reasons.push(`lease-expired:${row.leaseEndDate}`);
  return reasons.sort();
}

/** Prevents automatic pool restoration when Vehicle compliance became stale. */
function vehicleComplianceIsCurrent(
  current: Awaited<
    ReturnType<VendorRepository['listLinkedVehicleHealth']>
  >[number]['vehicle'],
  today: string,
): boolean {
  return Boolean(
    current.mulkiyaNumber &&
      current.mulkiyaExpiry &&
      current.mulkiyaExpiry >= today &&
      current.insurancePolicyNumber &&
      current.insuranceExpiry &&
      current.insuranceExpiry >= today,
  );
}

function toVendorDto(v: VendorRow): VendorDto {
  return {
    id: v.id,
    legalName: v.legalName,
    tradeName: v.tradeName,
    tradeLicenceNumber: v.tradeLicenceNumber,
    tradeLicenceEmirate: v.tradeLicenceEmirate,
    taxRegistrationNumber: v.taxRegistrationNumber,
    categoryCode: v.categoryCode,
    primaryContactName: v.primaryContactName,
    primaryContactRole: v.primaryContactRole,
    primaryContactEmail: v.primaryContactEmail,
    primaryContactPhone: v.primaryContactPhone,
    paymentTerms: v.paymentTerms,
    currency: v.currency,
    bankIbanMasked: v.bankIbanMasked,
    sourceMode: v.sourceMode,
    sourceSystem: v.sourceSystem,
    externalRef: v.externalRef,
    dataQualityFlag: v.dataQualityFlag,
    vendorPortalEnabled: v.vendorPortalEnabled,
    status: v.status,
    notes: v.notes,
    createdAtUtc: v.createdAtUtc.toISOString(),
    updatedAtUtc: v.updatedAtUtc.toISOString(),
  };
}

/** Maps persisted Vendor defaults to the public onboarding profile projection. */
function toVendorOnboardingProfileDto(
  profile: VendorOnboardingProfileRow,
): VendorOnboardingProfileDto {
  return {
    vendorId: profile.vendorId,
    standardOffHireNoticeDays: profile.standardOffHireNoticeDays,
    earlyTerminationPenalty: profile.earlyTerminationPenalty,
    renewalOptions: profile.renewalOptions,
    escalationClause: profile.escalationClause,
    replacementClause: profile.replacementClause,
    alertLadder: profile.alertLadder,
    accessMode: 'ManualInternal',
    updatedAtUtc: profile.updatedAtUtc.toISOString(),
  };
}

function toLeaseDto(l: LeaseRow): LeaseContractDto {
  return {
    id: l.id,
    vendorId: l.vendorId,
    contractRef: l.contractRef,
    scopeNodeId: l.scopeNodeId,
    monthlyAmount: l.monthlyAmount,
    currency: l.currency,
    startDate: l.startDate,
    endDate: l.endDate,
    offHireNoticeDays: l.offHireNoticeDays,
    earlyTerminationPenalty: l.earlyTerminationPenalty,
    renewalOptions: l.renewalOptions,
    escalationClause: l.escalationClause,
    replacementClause: l.replacementClause,
    alertLadder: l.alertLadder,
    status: l.status,
    renewedIntoContractRef: l.renewedIntoContractRef,
    createdAtUtc: l.createdAtUtc.toISOString(),
    updatedAtUtc: l.updatedAtUtc.toISOString(),
  };
}

function toVendorDocumentDto(document: VendorDocumentRow): VendorDocumentDto {
  return {
    id: document.id,
    vendorId: document.vendorId,
    documentTypeCode: document.documentTypeCode,
    version: document.version,
    documentReference: document.documentReference,
    blobRef: document.blobRef,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    status: document.status,
    extractedMetadata:
      (document.extractedMetadata as Record<string, unknown> | null) ?? null,
    confirmedMetadata:
      (document.confirmedMetadata as Record<string, unknown> | null) ?? null,
    confirmedByActorRef: document.confirmedByActorRef,
    confirmedAtUtc: document.confirmedAtUtc?.toISOString() ?? null,
    supersededById: document.supersededById,
    createdByActorRef: document.createdByActorRef,
    createdAtUtc: document.createdAtUtc.toISOString(),
    updatedAtUtc: document.updatedAtUtc.toISOString(),
  };
}
