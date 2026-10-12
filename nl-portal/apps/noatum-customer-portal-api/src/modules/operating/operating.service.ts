import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import type { TenantClient } from '../../common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../contracts/permissions';
import type {
  BranchCreate,
  BranchDto,
  BranchListDto,
  BranchQuery,
  BranchUpdate,
  CargoWiseBranchListDto,
  CargoWiseBranchQuery,
  RegionCreate,
  RegionDto,
  RegionListDto,
  RegionQuery,
  RegionUpdate,
} from '../../contracts/dto/operating.dto';
import { OperatingRepository } from './operating.repository';

const regionInclude = { _count: { select: { branches: true } } } as const;
type RegionRecord = Prisma.RegionGetPayload<{ include: typeof regionInclude }>;

const branchInclude = {
  region: { select: { name: true } },
  _count: { select: { users: true, servicedLinks: true } },
} as const;
type BranchRecord = Prisma.BranchGetPayload<{ include: typeof branchInclude }>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function regionDto(record: RegionRecord): RegionDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    isActive: record.isActive,
    branchCount: record._count.branches,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function branchDto(record: BranchRecord): BranchDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    city: record.city,
    countryCode: record.countryCode,
    regionId: record.regionId,
    regionName: record.region?.name ?? null,
    sourceBranchCode: record.sourceBranchCode,
    source: record.source,
    isActive: record.isActive,
    staffCount: record._count.users,
    servicedCount: record._count.servicedLinks,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * The operating structure of regions and branches.
 *
 * Portal-owned reference data: writes are plain Prisma under an internal context,
 * every mutation is audited, and the two protections that matter are enforced here
 * rather than left to the caller — a branch that still holds staff or services a
 * customer cannot be switched off, and a code cannot be changed once it is in use.
 */
@Injectable()
export class OperatingService {
  private readonly logger = new Logger(OperatingService.name);

  constructor(
    private readonly repository: OperatingRepository,
    private readonly context: TenantContext,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Operating administration is internal-only; an impersonating session never writes. */
  private authorize(permission: string, write = false) {
    const actor = this.context.require();
    if (!actor.isInternal || !actor.permissions.has(permission)) {
      throw new ForbiddenException('Internal staff permission required.');
    }
    if (write && actor.onBehalfOfUserId) {
      throw new ForbiddenException('Impersonated sessions are read-only.');
    }
    return actor;
  }

  // -------------------------------------------------------------------------
  // Regions
  // -------------------------------------------------------------------------

  async listRegions(query: RegionQuery): Promise<RegionListDto> {
    this.authorize(PERMISSIONS.ADMIN_OPERATING_READ);

    const where: Prisma.RegionWhereInput = {
      ...(query.status === 'all' ? {} : { isActive: query.status === 'active' }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.repository.runInternal(async (tx) => {
      const [records, total] = await Promise.all([
        tx.region.findMany({
          where,
          include: regionInclude,
          orderBy: [{ code: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.region.count({ where }),
      ]);
      return { items: records.map(regionDto), total, page: query.page, pageSize: query.pageSize };
    });
  }

  async createRegion(input: RegionCreate): Promise<RegionDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_OPERATING_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      const created = await tx.region
        .create({ data: { code: input.code, name: input.name }, include: regionInclude })
        .catch((error: unknown) => {
          if (isUniqueViolation(error)) {
            throw new ConflictException({ message: 'A region with that code already exists.', details: { code: 'REGION_CODE_TAKEN' } });
          }
          throw error;
        });

      await this.audit(tx, actor, 'operating.region.created', 'region', created.id, { code: created.code, name: created.name });
      this.track('operating.region.created', created.id);
      return regionDto(created);
    });
  }

  async updateRegion(id: string, input: RegionUpdate): Promise<RegionDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_OPERATING_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      const target = await tx.region.findUnique({ where: { id }, include: regionInclude });
      if (!target) throw new NotFoundException('Region not found.');
      if (target.updatedAt.toISOString() !== input.updatedAt) {
        throw new ConflictException({ message: 'Reload the region before saving.', details: { code: 'STALE_REGION' } });
      }

      const saved = await tx.region.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: regionInclude,
      });

      await this.audit(tx, actor, 'operating.region.updated', 'region', id, {
        before: { name: target.name, isActive: target.isActive },
        after: { name: saved.name, isActive: saved.isActive },
      });
      this.track('operating.region.updated', id);
      return regionDto(saved);
    });
  }

  // -------------------------------------------------------------------------
  // Branches
  // -------------------------------------------------------------------------

  async listBranches(query: BranchQuery): Promise<BranchListDto> {
    this.authorize(PERMISSIONS.ADMIN_OPERATING_READ);

    const where: Prisma.BranchWhereInput = {
      ...(query.status === 'all' ? {} : { isActive: query.status === 'active' }),
      ...(query.regionId ? { regionId: query.regionId } : {}),
      ...(query.mapped === 'all'
        ? {}
        : query.mapped === 'mapped'
          ? { NOT: { sourceBranchCode: null } }
          : { sourceBranchCode: null }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.repository.runInternal(async (tx) => {
      const [records, total] = await Promise.all([
        tx.branch.findMany({
          where,
          include: branchInclude,
          orderBy: [{ code: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.branch.count({ where }),
      ]);
      return { items: records.map(branchDto), total, page: query.page, pageSize: query.pageSize };
    });
  }

  async branchDetail(id: string): Promise<BranchDto> {
    this.authorize(PERMISSIONS.ADMIN_OPERATING_READ);

    return this.repository.runInternal(async (tx) => {
      const record = await tx.branch.findUnique({ where: { id }, include: branchInclude });
      if (!record) throw new NotFoundException('Branch not found.');
      return branchDto(record);
    });
  }

  async createBranch(input: BranchCreate): Promise<BranchDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_OPERATING_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      await this.requireRegion(tx, input.regionId ?? null);

      const created = await tx.branch
        .create({
          data: {
            code: input.code,
            name: input.name,
            city: input.city ?? null,
            countryCode: input.countryCode ?? null,
            regionId: input.regionId ?? null,
            sourceBranchCode: input.sourceBranchCode ?? null,
            source: 'manual',
          },
          include: branchInclude,
        })
        .catch((error: unknown) => {
          if (isUniqueViolation(error)) {
            throw new ConflictException({ message: 'A branch with that code already exists.', details: { code: 'BRANCH_CODE_TAKEN' } });
          }
          throw error;
        });

      await this.audit(tx, actor, 'operating.branch.created', 'branch', created.id, {
        code: created.code,
        name: created.name,
        regionId: created.regionId,
      });
      this.track('operating.branch.created', created.id);
      return branchDto(created);
    });
  }

  async updateBranch(id: string, input: BranchUpdate): Promise<BranchDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_OPERATING_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      const target = await tx.branch.findUnique({ where: { id }, include: branchInclude });
      if (!target) throw new NotFoundException('Branch not found.');
      if (target.updatedAt.toISOString() !== input.updatedAt) {
        throw new ConflictException({ message: 'Reload the branch before saving.', details: { code: 'STALE_BRANCH' } });
      }
      if (input.regionId !== undefined) await this.requireRegion(tx, input.regionId ?? null);

      // A branch still holding staff or servicing a customer cannot be switched off:
      // pricing scope and servicing would silently lose their office.
      if (input.isActive === false && target.isActive && (target._count.users > 0 || target._count.servicedLinks > 0)) {
        throw new ConflictException({
          message: 'This branch still has staff assigned or customers serviced.',
          details: { code: 'BRANCH_IN_USE', staff: target._count.users, serviced: target._count.servicedLinks },
        });
      }

      const saved = await tx.branch.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.city !== undefined ? { city: input.city ?? null } : {}),
          ...(input.countryCode !== undefined ? { countryCode: input.countryCode ?? null } : {}),
          ...(input.sourceBranchCode !== undefined ? { sourceBranchCode: input.sourceBranchCode ?? null } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.regionId !== undefined
            ? input.regionId
              ? { region: { connect: { id: input.regionId } } }
              : { region: { disconnect: true } }
            : {}),
        },
        include: branchInclude,
      });

      await this.audit(tx, actor, 'operating.branch.updated', 'branch', id, {
        before: {
          name: target.name,
          city: target.city,
          countryCode: target.countryCode,
          regionId: target.regionId,
          sourceBranchCode: target.sourceBranchCode,
          isActive: target.isActive,
        },
        after: {
          name: saved.name,
          city: saved.city,
          countryCode: saved.countryCode,
          regionId: saved.regionId,
          sourceBranchCode: saved.sourceBranchCode,
          isActive: saved.isActive,
        },
      });
      this.track('operating.branch.updated', id);
      return branchDto(saved);
    });
  }

  async listCargoWiseBranches(query: CargoWiseBranchQuery): Promise<CargoWiseBranchListDto> {
    this.authorize(PERMISSIONS.ADMIN_OPERATING_READ);

    return this.repository.runInternal(async (tx) => {
      const groups = await tx.masterOrg.groupBy({
        by: ['sourceBranchCode'],
        where: { sourceBranchCode: { not: null }, isActive: true },
        _count: { _all: true },
      });
      const codes = groups
        .map((group) => group.sourceBranchCode)
        .filter((code): code is string => Boolean(code && code.trim() !== ''));
      const branches = codes.length
        ? await tx.branch.findMany({
            where: { sourceBranchCode: { in: codes } },
            select: { id: true, code: true, name: true, sourceBranchCode: true },
          })
        : [];
      const byCode = new Map(branches.map((branch) => [branch.sourceBranchCode as string, branch]));

      let items = groups
        .filter((group) => Boolean(group.sourceBranchCode && group.sourceBranchCode.trim() !== ''))
        .map((group) => {
          const code = group.sourceBranchCode as string;
          const branch = byCode.get(code);
          return {
            cw1Code: code,
            organisationCount: group._count._all,
            mappedBranchId: branch?.id ?? null,
            mappedBranchCode: branch?.code ?? null,
            mappedBranchName: branch?.name ?? null,
          };
        })
        .sort((a, b) => a.cw1Code.localeCompare(b.cw1Code));

      if (query.mapped === 'mapped') items = items.filter((item) => item.mappedBranchId);
      if (query.mapped === 'unmapped') items = items.filter((item) => !item.mappedBranchId);

      return { items, total: items.length };
    });
  }

  private async requireRegion(tx: TenantClient, regionId: string | null): Promise<void> {
    if (!regionId) return;
    const region = await tx.region.findFirst({ where: { id: regionId, isActive: true } });
    if (!region) throw new ConflictException({ message: 'Select an active region.', details: { code: 'REGION_UNAVAILABLE' } });
  }

  private async audit(
    tx: TenantClient,
    actor: { userId: string; correlationId: string },
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: { actorUserId: actor.userId, action, entityType, entityId, metadata: { ...metadata, correlationId: actor.correlationId } },
    });
  }

  private track(action: string, entityId?: string): void {
    const actor = this.context.require();
    this.logger.log({ event: 'AnalyticsEvent', action, actorUserId: actor.userId, entityId, correlationId: actor.correlationId });
    void this.analytics.record({ action, entityType: 'operating', entityId });
  }
}
