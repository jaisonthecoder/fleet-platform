import { type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { PermissionGuard } from '../../src/common/guards/permission.guard';
import { TenantGuard } from '../../src/common/guards/tenant.guard';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { INTERNAL_ROLE_KEYS, PERMISSIONS, ROLES } from '../../src/contracts/permissions';
import { UsersController } from '../../src/modules/users/users.controller';
import { UsersRepository } from '../../src/modules/users/users.repository';
import { UsersService } from '../../src/modules/users/users.service';
import { AnalyticsService } from '../../src/common/analytics/analytics.service';
import { noAnalytics } from '../fixtures/analytics.fixture';
import { removeStaffRoles, seedStaffRoles, seedTwoTenants, type StaffRoleFixture, type TwoTenants } from '../fixtures/tenants.fixture';

describe('staff HTTP authorization with injected identity (not Microsoft authentication)', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let fixture: StaffRoleFixture;
  let tenants: TwoTenants;
  let repository: UsersRepository;
  let actor: TenantContextData;
  const context = new TenantContext();
  const staffPermissions = [PERMISSIONS.ADMIN_STAFF_READ, PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE];

  beforeAll(async () => {
    database = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }),
    });
    await database.$connect();
    tenants = await seedTwoTenants(database);
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService, UsersRepository,
        { provide: PrismaService, useValue: database },
        { provide: TenantContext, useValue: context },
        // Supplied by the global CommonModule in the running application, which this
        // harness deliberately does not import - it builds only the slice under test.
        { provide: AnalyticsService, useValue: noAnalytics() }],
    }).compile();
    repository = moduleRef.get(UsersRepository);
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning();
    app.use((_request: Request, _response: Response, next: NextFunction) => context.run({ ...actor }, next));
    const reflector = new Reflector();
    app.useGlobalGuards(new TenantGuard(reflector, context), new PermissionGuard(reflector, context));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  beforeEach(async () => {
    fixture = await seedStaffRoles(database);
    actor = {
      userId: fixture.admin.id, customerGroupId: null, isInternal: true, accountIds: [],
      permissions: new Set(staffPermissions), correlationId: `staff-http-${fixture.admin.id}`,
    };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (fixture) await removeStaffRoles(database, fixture);
  });

  afterAll(async () => {
    try { await app?.close(); } finally { await database?.$disconnect(); }
  });

  const routes = [
    { name: 'GET staff', handler: 'list', method: 'get', suffix: '' },
    { name: 'GET role presets', handler: 'presets', method: 'get', suffix: '/role-presets' },
    { name: 'PUT staff roles', handler: 'updateRoles', method: 'put', suffix: '/roles' },
  ] as const;
  const deniedActors = ['internal without permissions', 'internal with customer administration only',
    'customer administrator', 'customer with staff permission claims', 'impersonating staff'] as const;

  describe.each(routes)('$name', (route) => {
    it.each(deniedActors)('returns HTTP 403 for %s before repository access', async (kind) => {
      const customer = kind === 'customer administrator' || kind === 'customer with staff permission claims';
      const hasStaffPermissions = kind === 'customer with staff permission claims' || kind === 'impersonating staff';
      actor = { ...actor,
        userId: customer ? tenants.a.userId : fixture.admin.id,
        customerGroupId: customer ? tenants.a.groupId : null,
        isInternal: !customer,
        onBehalfOfUserId: kind === 'impersonating staff' ? tenants.a.userId : null,
        permissions: new Set(hasStaffPermissions ? staffPermissions
          : kind === 'internal without permissions' ? [] : [PERMISSIONS.USERS_MANAGE]),
      };
      const access = jest.spyOn(repository, 'runInternal');
      const handler = jest.spyOn(app.get(UsersService), route.handler);
      const path = route.method === 'put' ? `/api/users/staff/${fixture.target.id}/roles` : `/api/users/staff${route.suffix}`;
      const call = request(app.getHttpServer())[route.method](path);
      if (route.method === 'put') call.send({ roleKeys: [ROLES.PLATFORM_ADMIN], updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Must be denied' });
      const response = await call.expect(403);
      expect(response.body.statusCode).toBe(403);
      expect(response.body).not.toHaveProperty('items');
      expect(response.body).not.toHaveProperty('roleKeys');
      expect(access).not.toHaveBeenCalled();
      if (hasStaffPermissions) expect(handler).toHaveBeenCalledTimes(1);
      else expect(handler).not.toHaveBeenCalled();
    });
  });

  it('allows staff read permission on both GET routes but refuses role assignment', async () => {
    actor.permissions = new Set([PERMISSIONS.ADMIN_STAFF_READ]);
    const response = await request(app.getHttpServer()).get('/api/users/staff')
      .query({ search: fixture.target.email }).expect('Cache-Control', 'no-store').expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items).toEqual([expect.objectContaining({ id: fixture.target.id })]);
    const presets = await request(app.getHttpServer()).get('/api/users/staff/role-presets')
      .expect('Cache-Control', 'no-store').expect(200);
    // Five internal presets are seeded now, not the single retired one.
    expect(presets.body.map(({ key }: { key: string }) => key).sort()).toEqual([...INTERNAL_ROLE_KEYS].sort());
    expect(presets.body).toContainEqual({ key: ROLES.PLATFORM_ADMIN, permissions: expect.arrayContaining([...staffPermissions]) });
    await request(app.getHttpServer()).put(`/api/users/staff/${fixture.target.id}/roles`)
      .send({ roleKeys: [ROLES.PLATFORM_ADMIN], updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Read access only' }).expect(403);
  });

  it('allows a database-authorized internal administrator to assign the preset', async () => {
    const response = await request(app.getHttpServer()).put(`/api/users/staff/${fixture.target.id}/roles`)
      .send({ roleKeys: [ROLES.PLATFORM_ADMIN], updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Delegate staff administration' })
      .expect('Cache-Control', 'no-store').expect(200);
    expect(response.body.roleKeys).toEqual([ROLES.PLATFORM_ADMIN, fixture.retainedRole.key].sort());
    // platform_admin carries the whole internal set, so derive the expectation from the
    // database rather than pinning a literal list that drifts every time a permission lands.
    // role_permission is readable only under the identity-resolution policy.
    const granted = await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.identity_lookup', 'on', true)`;
      return transaction.rolePermission.findMany({
        where: { role: { key: { in: [ROLES.PLATFORM_ADMIN, fixture.retainedRole.key] } } },
        select: { permissionKey: true },
      });
    });
    const expectedPermissions = [...new Set(granted.map(({ permissionKey }) => permissionKey))].sort();
    expect(expectedPermissions).toEqual(expect.arrayContaining([...staffPermissions]));
    expect(response.body.permissions).toEqual(expectedPermissions);
    expect(response.body.updatedAt).not.toBe(fixture.target.updatedAt.toISOString());
  });

  it('refuses a previously authorized context after the actor loses database roles', async () => {
    await context.run(actor, () => repository.runInternal((transaction) =>
      transaction.userRole.deleteMany({ where: { userId: fixture.admin.id } })));
    await request(app.getHttpServer()).put(`/api/users/staff/${fixture.target.id}/roles`)
      .send({ roleKeys: [ROLES.PLATFORM_ADMIN], updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Stale actor permission' }).expect(403);
    const target = await context.run(actor, () => repository.runInternal((transaction) =>
      transaction.user.findUniqueOrThrow({ where: { id: fixture.target.id }, include: { roles: true } })));
    expect(target.roles.map(({ roleId }) => roleId)).toEqual([fixture.retainedRole.id]);
    expect(target.updatedAt).toEqual(fixture.target.updatedAt);
  });

  it('does not permit a customer record to be targeted by the staff role endpoint', async () => {
    await request(app.getHttpServer()).put(`/api/users/staff/${tenants.a.userId}/roles`)
      .send({ roleKeys: [ROLES.PLATFORM_ADMIN], updatedAt: fixture.target.updatedAt.toISOString(), reason: 'Wrong audience' }).expect(404);
  });
});
