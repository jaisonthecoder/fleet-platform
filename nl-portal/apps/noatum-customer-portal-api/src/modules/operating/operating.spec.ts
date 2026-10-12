import { noAnalytics } from '../../../test/fixtures/analytics.fixture';
import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { TenantContext, type TenantContextData } from '../../common/tenancy/tenant-context';
import type { TenantClient } from '../../common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../contracts/permissions';
import type { OperatingRepository } from './operating.repository';
import { OperatingService } from './operating.service';

/**
 * Unit coverage for the guardrails the service owns: internal-only access, the
 * unique-code conflict, optimistic concurrency, the active-region requirement,
 * and the refusal to deactivate a branch that is still in use. Prisma is mocked;
 * cross-tenant isolation is proven separately against a real database.
 *
 * Prepared alongside the slice; execution is user-scheduled.
 */

const now = new Date('2026-09-14T10:00:00.000Z');
const regionId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';

const manageContext: TenantContextData = {
  userId: 'aaaa1111-2222-4333-8444-555566667777',
  customerGroupId: null,
  isInternal: true,
  accountIds: [],
  permissions: new Set([PERMISSIONS.ADMIN_OPERATING_READ, PERMISSIONS.ADMIN_OPERATING_MANAGE]),
  correlationId: 'operating-test',
};

const customerContext: TenantContextData = {
  userId: 'bbbb1111-2222-4333-8444-555566667777',
  customerGroupId: 'cccc1111-2222-4333-8444-555566667777',
  isInternal: false,
  accountIds: [],
  permissions: new Set(),
  correlationId: 'operating-test',
};

function regionRecord(overrides: Record<string, unknown> = {}) {
  return { id: regionId, code: 'EMEA', name: 'Europe', isActive: true, createdAt: now, updatedAt: now, _count: { branches: 0 }, ...overrides };
}

function branchRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: branchId, code: 'ES-MAD', name: 'Madrid', city: 'Madrid', countryCode: 'ES', regionId,
    sourceBranchCode: null, source: 'manual', isActive: true, createdAt: now, updatedAt: now,
    region: { name: 'Europe' }, _count: { users: 0, servicedLinks: 0 }, ...overrides,
  };
}

function setup() {
  const context = new TenantContext();
  const transaction = {
    region: {
      create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), update: jest.fn(),
    },
    branch: {
      create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), update: jest.fn(),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const runInternal = jest.fn((callback: (client: TenantClient) => Promise<unknown>) => callback(transaction as unknown as TenantClient));
  const repository = { runInternal } as unknown as OperatingRepository;
  const service = new OperatingService(repository, context, noAnalytics());
  return { context, transaction, service };
}

const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('duplicate key', { code: 'P2002', clientVersion: '7' });

async function conflictCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    if (error instanceof ConflictException) {
      const body = error.getResponse() as { details?: { code?: string } };
      return body.details?.code;
    }
    throw error;
  }
}

describe('OperatingService', () => {
  it('refuses a caller who is not internal staff', async () => {
    const { context, service } = setup();
    await expect(
      context.run(customerContext, () => service.listRegions({ search: '', status: 'all', page: 1, pageSize: 25 })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a region and writes exactly one audit event', async () => {
    const { context, transaction, service } = setup();
    transaction.region.create.mockResolvedValue(regionRecord());
    const result = await context.run(manageContext, () => service.createRegion({ code: 'EMEA', name: 'Europe' }));
    expect(result.code).toBe('EMEA');
    expect(transaction.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('maps a duplicate region code to a conflict', async () => {
    const { context, transaction, service } = setup();
    transaction.region.create.mockRejectedValue(uniqueViolation());
    expect(await conflictCode(context.run(manageContext, () => service.createRegion({ code: 'EMEA', name: 'Europe' })))).toBe('REGION_CODE_TAKEN');
  });

  it('rejects a stale region update without writing', async () => {
    const { context, transaction, service } = setup();
    transaction.region.findUnique.mockResolvedValue(regionRecord());
    expect(await conflictCode(context.run(manageContext, () => service.updateRegion(regionId, { name: 'Europe, Middle East', updatedAt: '2020-01-01T00:00:00.000Z' })))).toBe('STALE_REGION');
    expect(transaction.region.update).not.toHaveBeenCalled();
  });

  it('refuses a branch that points at an inactive region', async () => {
    const { context, transaction, service } = setup();
    transaction.region.findFirst.mockResolvedValue(null);
    expect(await conflictCode(context.run(manageContext, () => service.createBranch({ code: 'ES-MAD', name: 'Madrid', regionId })))).toBe('REGION_UNAVAILABLE');
    expect(transaction.branch.create).not.toHaveBeenCalled();
  });

  it('creates a branch under an active region', async () => {
    const { context, transaction, service } = setup();
    transaction.region.findFirst.mockResolvedValue({ id: regionId, isActive: true });
    transaction.branch.create.mockResolvedValue(branchRecord());
    const result = await context.run(manageContext, () => service.createBranch({ code: 'ES-MAD', name: 'Madrid', regionId }));
    expect(result.code).toBe('ES-MAD');
    expect(transaction.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('refuses to deactivate a branch that still has staff or serviced customers', async () => {
    const { context, transaction, service } = setup();
    transaction.branch.findUnique.mockResolvedValue(branchRecord({ _count: { users: 2, servicedLinks: 0 } }));
    expect(await conflictCode(context.run(manageContext, () => service.updateBranch(branchId, { isActive: false, updatedAt: now.toISOString() })))).toBe('BRANCH_IN_USE');
    expect(transaction.branch.update).not.toHaveBeenCalled();
  });
});
