import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { TenantContext } from '../../common/tenancy/tenant-context';
import type { TenantClient } from '../../common/tenancy/tenant.repository';
import type {
  ImportRunDto,
  ImportRunListDto,
  ImportRunRequest,
  OrganisationDetailDto,
  OrganisationListDto,
  OrganisationQuery,
  OrganisationRowDto,
} from '../../contracts/dto/organisation.dto';
import { PERMISSIONS, type PermissionKey } from '../../contracts/permissions';
import { OrganisationImportService } from '../../integration/organisations/organisation-import.service';
import { CustomersRepository } from '../customers/customers.repository';

const rowInclude = {
  accounts: { select: { customerGroupId: true, group: { select: { name: true } } }, take: 1 },
  _count: { select: { addresses: true } },
} as const;
type OrgRecord = Prisma.MasterOrgGetPayload<{ include: typeof rowInclude }>;

type ImportRunRecord = Prisma.OrgImportRunGetPayload<{ include: { startedBy: { select: { displayName: true } } } }>;

function importRun(record: ImportRunRecord): ImportRunDto {
  return {
    id: record.id,
    outcome: record.outcome,
    sourceInstance: record.sourceInstance,
    mode: record.mode,
    isAuthoritative: record.isAuthoritative,
    fileName: record.fileName,
    rowsRead: record.rowsRead,
    rowsCreated: record.rowsCreated,
    rowsUpdated: record.rowsUpdated,
    rowsUnchanged: record.rowsUnchanged,
    rowsDeactivated: record.rowsDeactivated,
    rowsRejected: record.rowsRejected,
    startedByName: record.startedBy?.displayName ?? null,
    startedAt: record.startedAt.toISOString(),
    finishedAt: record.finishedAt?.toISOString() ?? null,
    errors: record.errors,
  };
}

function row(record: OrgRecord): OrganisationRowDto {
  return {
    id: record.id,
    sourceCode: record.sourceCode,
    sourceInstance: record.sourceInstance,
    name: record.name,
    category: record.category,
    countryCode: record.countryCode,
    city: record.city,
    sourceKind: record.sourceKind,
    isActive: record.isActive,
    isSourceConfirmed: record.isSourceConfirmed,
    sourceRoles: record.sourceRoles,
    addresses: record._count.addresses,
    linkedCustomerId: record.accounts[0]?.customerGroupId ?? null,
    linkedCustomerName: record.accounts[0]?.group.name ?? null,
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
  };
}

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger(OrganisationsService.name);

  constructor(
    private readonly repository: CustomersRepository,
    private readonly context: TenantContext,
    private readonly imports: OrganisationImportService,
  ) {}

  /** The directory is internal reference data; no customer context reaches it. */
  private authorize(permission: PermissionKey = PERMISSIONS.ADMIN_ORGANISATIONS_LINK) {
    const actor = this.context.require();
    if (!actor.isInternal || !actor.permissions.has(permission)) {
      throw new ForbiddenException('Internal staff permission required.');
    }
    return actor;
  }

  /**
   * Address type codes read back as words.
   *
   * The authoritative list is CargoWise's and still awaited (gap N11), so an
   * unmapped code resolves to null and the screen shows the code itself rather
   * than inventing a meaning.
   */
  private async addressTypeLabels(tx: TenantClient): Promise<Map<string, string>> {
    const items = await tx.lookupItem.findMany({
      where: { category: { code: 'cw1_address_type' }, isActive: true },
      select: { code: true, translations: { select: { locale: true, label: true } } },
    });

    return new Map(
      items.map((item) => [
        item.code,
        item.translations.find((entry) => entry.locale === 'en-US')?.label ?? item.code,
      ]),
    );
  }

  /** Recent import runs, newest first — the operator's evidence that the mirror is fresh. */
  async runs(limit = 20): Promise<ImportRunListDto> {
    this.authorize(PERMISSIONS.ADMIN_ORGANISATIONS_IMPORT);

    return this.repository.runInternal(async (tx) => {
      const [records, total] = await Promise.all([
        tx.orgImportRun.findMany({
          orderBy: { startedAt: 'desc' },
          take: limit,
          include: { startedBy: { select: { displayName: true } } },
        }),
        tx.orgImportRun.count(),
      ]);

      return {
        items: records.map(importRun),
        total,
      };
    });
  }

  /**
   * Runs synchronously rather than through the job queue: the operator pressed a
   * button and needs the counts back to decide whether the mirror is trustworthy.
   * The scheduled path is the same service behind MasterOrgSyncHandler.
   */
  async import(input: ImportRunRequest): Promise<ImportRunDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_ORGANISATIONS_IMPORT);
    if (actor.onBehalfOfUserId) throw new ForbiddenException('Impersonated sessions are read-only.');

    const result = await this.imports.run({
      authoritative: input.authoritative,
      startedByUserId: actor.userId,
    });

    // The most destructive internal action in the product; the operator's reason
    // belongs in the audit trail, not only in the run row.
    await this.repository.runInternal((tx) =>
      tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'organisations.import.run',
          entityType: 'org_import_run',
          entityId: result.runId,
          metadata: {
            authoritative: input.authoritative,
            reason: input.reason,
            outcome: result.outcome,
            created: result.created,
            updated: result.updated,
            deactivated: result.deactivated,
            rejected: result.rejected,
            correlationId: actor.correlationId,
          } as Prisma.InputJsonValue,
        },
      }),
    );

    this.logger.log({
      event: 'AnalyticsEvent',
      action: 'organisations.import.run',
      actorUserId: actor.userId,
      entityId: result.runId,
      correlationId: actor.correlationId,
    });

    // Read back by id, not "the newest run": two concurrent imports would otherwise
    // show the operator somebody else's numbers.
    return this.runById(result.runId);
  }

  private async runById(runId: string): Promise<ImportRunDto> {
    return this.repository.runInternal(async (tx) => {
      const record = await tx.orgImportRun.findUnique({
        where: { id: runId },
        include: { startedBy: { select: { displayName: true } } },
      });
      if (!record) throw new NotFoundException('The import run was not recorded.');
      return importRun(record);
    });
  }

  async list(query: OrganisationQuery): Promise<OrganisationListDto> {
    this.authorize();

    const where: Prisma.MasterOrgWhereInput = {
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.status === 'all' ? {} : { isActive: query.status === 'active' }),
      ...(query.provenance === 'all' ? {} : { isSourceConfirmed: query.provenance === 'confirmed' }),
      ...(query.linked === 'all' ? {} : query.linked === 'linked' ? { accounts: { some: {} } } : { accounts: { none: {} } }),
      ...(query.search
        ? {
            OR: [
              { sourceCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
              { registrations: { some: { value: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    return this.repository.runInternal(async (tx) => {
      const [records, total] = await Promise.all([
        tx.masterOrg.findMany({
          where,
          include: rowInclude,
          // Provisional rows first: they are the ones needing a decision.
          orderBy: [{ isSourceConfirmed: 'asc' }, { name: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.masterOrg.count({ where }),
      ]);

      return { items: records.map(row), total, page: query.page, pageSize: query.pageSize };
    });
  }

  async detail(id: string): Promise<OrganisationDetailDto> {
    this.authorize();

    return this.repository.runInternal(async (tx) => {
      const record = await tx.masterOrg.findUnique({
        where: { id },
        include: {
          ...rowInclude,
          addresses: { orderBy: [{ isPrimary: 'desc' }, { sourceAddressCode: 'asc' }] },
          registrations: { orderBy: [{ scheme: 'asc' }] },
          changes: { orderBy: [{ createdAt: 'desc' }], take: 50, include: { run: { select: { sourceKind: true, fileName: true } } } },
        },
      });
      if (!record) throw new NotFoundException('Organisation not found.');

      const link = await tx.customerAccount.findFirst({
        where: { orgId: id },
        select: {
          linkedAt: true,
          justification: true,
          servicingBranch: { select: { code: true } },
          group: { select: { defaultServicingBranch: { select: { code: true } } } },
        },
      });

      const ownBranch = link?.servicingBranch?.code ?? null;
      const defaultBranch = link?.group.defaultServicingBranch?.code ?? null;

      const addressTypeLabels = await this.addressTypeLabels(tx);

      return {
        ...row(record),
        legalName: record.legalName,
        state: record.state,
        postcode: record.postcode,
        sourceBranchCode: record.sourceBranchCode,
        sourceControllingCustomerCode: record.sourceControllingCustomerCode,
        firstSeenAt: record.firstSeenAt.toISOString(),
        linkedAt: link?.linkedAt?.toISOString() ?? null,
        linkJustification: link?.justification ?? null,
        linkServicingBranchCode: ownBranch ?? defaultBranch,
        linkServicingInherited: ownBranch === null && defaultBranch !== null,
        addressList: record.addresses.map((address) => ({
          id: address.id,
          sourceAddressCode: address.sourceAddressCode,
          purposes: address.purposes.map((code) => ({ code, label: addressTypeLabels.get(code) ?? null })),
          isPrimary: address.isPrimary,
          companyNameOverride: address.companyNameOverride,
          addressLine1: address.addressLine1,
          city: address.city,
          state: address.state,
          postcode: address.postcode,
          countryCode: address.countryCode,
          relatedPortCode: address.relatedPortCode,
          isActive: address.isActive,
        })),
        registrations: record.registrations.map((registration) => ({
          id: registration.id,
          scheme: registration.scheme,
          schemeDescription: registration.schemeDescription,
          value: registration.value,
          jurisdiction: registration.jurisdiction,
          isCountryDefault: registration.isCountryDefault,
        })),
        history: record.changes.map((change) => ({
          id: change.id,
          changeType: change.changeType,
          createdAt: change.createdAt.toISOString(),
          runKind: change.run?.sourceKind ?? null,
          runFileName: change.run?.fileName ?? null,
        })),
      };
    });
  }
}
