import { analyticsFor } from '../fixtures/analytics.fixture';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import type { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import type { StaffRoleUpdate } from '../../src/contracts/dto/staff.dto';
import { PERMISSIONS, ROLES } from '../../src/contracts/permissions';
import { UsersRepository } from '../../src/modules/users/users.repository';
import { UsersService } from '../../src/modules/users/users.service';
import { removeStaffRoles, seedStaffRoles, seedTwoTenants, type StaffRoleFixture, type TwoTenants } from '../fixtures/tenants.fixture';

describe('staff role transactions on the disposable database', () => {
  let database: PrismaClient;
  let fixture: StaffRoleFixture;
  let tenants: TwoTenants;
  let repository: UsersRepository;
  let service: UsersService;
  const context = new TenantContext();

  function actor(userId = fixture.admin.id): TenantContextData {
    return { userId, customerGroupId: null, isInternal: true, accountIds: [],
      permissions: new Set([PERMISSIONS.ADMIN_STAFF_READ, PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE]),
      correlationId: `staff-db-${userId}` };
  }

  beforeAll(async () => {
    database = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }),
    });
    await database.$connect();
    tenants = await seedTwoTenants(database);
    repository = new UsersRepository(database as PrismaService, context);
    service = new UsersService(repository, context, analyticsFor(repository, context));
  });

  beforeEach(async () => { fixture = await seedStaffRoles(database); });
  afterEach(async () => { if (fixture) await removeStaffRoles(database, fixture); });
  afterAll(async () => { await database?.$disconnect(); });

  function snapshot(id: string) {
    return context.run(actor(), () => repository.runInternal(async (transaction) => {
      const user = await transaction.user.findUniqueOrThrow({ where: { id }, include: { roles: { include: { role: true } } } });
      const audit = await transaction.auditEvent.findMany({ where: { entityType: 'user', entityId: id, action: 'staff.roles.changed' }, orderBy: { createdAt: 'asc' } });
      return { roleKeys: user.roles.map(({ role }) => role.key).sort(), updatedAt: user.updatedAt.toISOString(), audit };
    }));
  }

  function assign(id: string, update: StaffRoleUpdate, userId = fixture.admin.id) {
    return context.run(actor(userId), () => service.updateRoles(id, update));
  }

  it('commits the preset and version with one before/after/reason audit, retaining unrelated roles', async () => {
    const before = await snapshot(fixture.target.id);
    const result = await assign(fixture.target.id, {
      roleKeys: [ROLES.PLATFORM_ADMIN], branchId: null, updatedAt: before.updatedAt, reason: 'Delegate staff administration',
    });
    const after = await snapshot(fixture.target.id);
    expect(after.roleKeys).toEqual([ROLES.PLATFORM_ADMIN, fixture.retainedRole.key].sort());
    expect(after.updatedAt).toBe(result.updatedAt);
    expect(after.updatedAt).not.toBe(before.updatedAt);
    expect(after.audit).toEqual([expect.objectContaining({
      customerGroupId: null, actorUserId: fixture.admin.id, entityType: 'user', entityId: fixture.target.id,
      metadata: { before: before.roleKeys, after: after.roleKeys, branchBefore: null, branchAfter: null, reason: 'Delegate staff administration', correlationId: actor().correlationId },
    })]);
  });

  it('allows only one of two administrators concurrently removing each other to commit', async () => {
    const admins = await context.run(actor(), () => repository.runInternal((transaction) => transaction.user.findMany({
      where: { isInternal: true, status: 'active', roles: { some: { role: { permissions: { some: { permissionKey: PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE } } } } } },
      select: { id: true },
    })));
    expect(admins.map(({ id }) => id).sort()).toEqual([fixture.admin.id, fixture.secondAdmin.id].sort());
    const results = await Promise.allSettled([
      assign(fixture.secondAdmin.id, { roleKeys: [], branchId: null, updatedAt: fixture.secondAdmin.updatedAt.toISOString(), reason: 'First concurrent removal' }, fixture.admin.id),
      assign(fixture.admin.id, { roleKeys: [], branchId: null, updatedAt: fixture.admin.updatedAt.toISOString(), reason: 'Second concurrent removal' }, fixture.secondAdmin.id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(ForbiddenException);
    const states = await Promise.all([snapshot(fixture.admin.id), snapshot(fixture.secondAdmin.id)]);
    expect(states.filter((state) => state.roleKeys.includes(ROLES.PLATFORM_ADMIN))).toHaveLength(1);
    expect(states.flatMap((state) => state.audit)).toHaveLength(1);
    const survivor = states.find((state) => state.roleKeys.includes(ROLES.PLATFORM_ADMIN))!;
    expect(survivor.updatedAt).toBe(fixture.admin.updatedAt.toISOString());
    expect(survivor.audit).toEqual([]);
    const removed = states.find((state) => !state.roleKeys.includes(ROLES.PLATFORM_ADMIN))!;
    expect(removed.updatedAt).not.toBe(fixture.admin.updatedAt.toISOString());
    expect(removed.audit[0]!.metadata).toEqual(expect.objectContaining({ before: [ROLES.PLATFORM_ADMIN], after: [] }));
  });

  it('prevents the sole remaining active administrator from removing their own access', async () => {
    await assign(fixture.secondAdmin.id, { roleKeys: [], branchId: null, updatedAt: fixture.secondAdmin.updatedAt.toISOString(), reason: 'Remove second administrator' });
    const before = await snapshot(fixture.admin.id);
    await expect(assign(fixture.admin.id, { roleKeys: [], branchId: null, updatedAt: before.updatedAt, reason: 'Remove final administrator' }))
      .rejects.toMatchObject({ response: expect.objectContaining({ details: { code: 'SELF_ADMIN_REMOVAL' } }) });
    expect(await snapshot(fixture.admin.id)).toEqual(before);
  });

  it('rejects a stale version after a committed assignment without changing roles, version or audit', async () => {
    const original = await snapshot(fixture.target.id);
    await assign(fixture.target.id, { roleKeys: [ROLES.PLATFORM_ADMIN], branchId: null, updatedAt: original.updatedAt, reason: 'First editor' });
    const committed = await snapshot(fixture.target.id);
    await expect(assign(fixture.target.id, { roleKeys: [], branchId: null, updatedAt: original.updatedAt, reason: 'Stale editor' }))
      .rejects.toMatchObject({ response: expect.objectContaining({ details: { code: 'STALE_STAFF' } }) });
    expect(await snapshot(fixture.target.id)).toEqual(committed);
  });

  it('serializes concurrent saves of the same version and audits only the winner', async () => {
    const original = await snapshot(fixture.target.id);
    const results = await Promise.allSettled([
      assign(fixture.target.id, { roleKeys: [ROLES.PLATFORM_ADMIN], branchId: null, updatedAt: original.updatedAt, reason: 'First editor' }),
      assign(fixture.target.id, { roleKeys: [ROLES.PLATFORM_ADMIN], branchId: null, updatedAt: original.updatedAt, reason: 'Second editor' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(ConflictException);
    expect((rejected[0]!.reason as ConflictException).getResponse()).toMatchObject({ details: { code: 'STALE_STAFF' } });
    const committed = await snapshot(fixture.target.id);
    expect(committed.roleKeys).toEqual([ROLES.PLATFORM_ADMIN, fixture.retainedRole.key].sort());
    expect(committed.audit).toHaveLength(1);
  });

  it.each(['grant', 'remove'] as const)('rolls back actual %s and version writes when PostgreSQL rejects the audit insert', async (change) => {
    if (change === 'remove') {
      await assign(fixture.target.id, { roleKeys: [ROLES.PLATFORM_ADMIN], branchId: null, updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Initial assignment' });
    }
    const before = await snapshot(fixture.target.id);
    let writtenVersion: Date | undefined;
    let insertedRoles = 0;
    let deletedRoles = 0;
    let auditAttempted = false;
    const failingDatabase = database.$extends({ query: {
      userRole: {
        async deleteMany({ args, query }) {
          const result = await query(args);
          deletedRoles += result.count;
          return result;
        },
        async createMany({ args, query }) {
          const result = await query(args);
          insertedRoles += result.count;
          return result;
        },
      },
      user: { async update({ args, query }) {
        const result = await query(args);
        // The extension callback types updatedAt through Prisma's generic payload mapper, not as Date.
        writtenVersion = result.updatedAt as unknown as Date;
        return result;
      } },
      auditEvent: { async create({ args, query }) {
        auditAttempted = true;
        return query({ ...args, data: { ...args.data, action: 'x'.repeat(121) } });
      } },
    } });
    const failingService = new UsersService(new UsersRepository(failingDatabase as unknown as PrismaService, context), context, analyticsFor(repository, context));
    await expect(context.run(actor(), () => failingService.updateRoles(fixture.target.id, {
      roleKeys: change === 'grant' ? [ROLES.PLATFORM_ADMIN] : [], branchId: null, updatedAt: before.updatedAt, reason: 'Audit must commit with roles',
    }))).rejects.toMatchObject({ code: 'P2000' });
    expect(auditAttempted).toBe(true);
    expect(insertedRoles).toBe(change === 'grant' ? 1 : 0);
    expect(deletedRoles).toBe(change === 'remove' ? 1 : 0);
    expect(writtenVersion).toBeInstanceOf(Date);
    expect(writtenVersion!.toISOString()).not.toBe(before.updatedAt);
    expect(await snapshot(fixture.target.id)).toEqual(before);
    const audits = await context.run(actor(), () => repository.runInternal((transaction) =>
      transaction.auditEvent.findMany({ where: { entityId: fixture.target.id } })));
    expect(audits).toEqual(before.audit);
  });

  it('keeps staff records and their role-change audit invisible to either customer tenant', async () => {
    await assign(fixture.target.id, { roleKeys: [ROLES.PLATFORM_ADMIN], branchId: null, updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Internal audit visibility' });
    expect((await snapshot(fixture.target.id)).audit).toHaveLength(1);
    for (const tenant of [tenants.a, tenants.b]) {
      await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.customer_group_id', ${tenant.groupId}, true)`;
        await transaction.$executeRaw`SELECT set_config('app.is_internal', 'false', true)`;
        expect(await transaction.user.findUnique({ where: { id: fixture.target.id } })).toBeNull();
        expect(await transaction.auditEvent.findMany({ where: { entityId: fixture.target.id } })).toEqual([]);
      });
    }
  });
});
