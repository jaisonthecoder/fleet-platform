import { noAnalytics } from '../../../test/fixtures/analytics.fixture';
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantContext, type TenantContextData } from '../../common/tenancy/tenant-context';
import type { TenantClient } from '../../common/tenancy/tenant.repository';
import { StaffListQuerySchema, StaffRoleUpdateSchema } from '../../contracts/dto/staff.dto';
import { INTERNAL_ROLE_KEYS, PERMISSIONS } from '../../contracts/permissions';
import { IdentityService } from '../identity/identity.service';
import { UsersController } from './users.controller';
import type { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const actorId = '9abc3338-a079-48c6-9105-0a93617f8f44';
const targetId = '62c2a080-c2e2-401b-9230-b7836da23b7e';
const timestamp = '2026-09-12T10:00:00.000Z';
const role = { id: '9ba0d274-646f-4bd3-a67a-cb3164790b74', key: 'platform_admin', isInternal: true, permissions: [
  { permissionKey: PERMISSIONS.ADMIN_STAFF_READ }, { permissionKey: PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE },
] };

/**
 * updateRoles refuses to run unless every internal preset is present, so the
 * mock must return all of them and not just the one under test.
 */
const allPresets = [
  role,
  ...INTERNAL_ROLE_KEYS.filter((key) => key !== role.key).map((key, index) => ({
    id: `0000000${index}-0000-4000-8000-00000000000${index}`,
    key,
    isInternal: true,
    permissions: [],
  })),
];
const actorContext: TenantContextData = {
  userId: actorId, customerGroupId: null, isInternal: true, accountIds: [],
  permissions: new Set([PERMISSIONS.ADMIN_STAFF_READ, PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE]), correlationId: 'staff-role-test',
};

function staff(id: string, admin: boolean) {
  return { id, displayName: 'Fictional staff', email: 'staff@example.test', status: 'active', isInternal: true, branchId: null, branch: null, lastLoginAt: null, updatedAt: new Date(timestamp), roles: admin ? [{ role, roleId: role.id, userId: id }] : [] };
}

function setup() {
  const context = new TenantContext();
  const transaction = {
    $executeRaw: jest.fn().mockResolvedValue(1), $queryRaw: jest.fn().mockResolvedValue([{ id: targetId }]),
    user: {
      findFirst: jest.fn().mockResolvedValueOnce(staff(actorId, true)).mockResolvedValueOnce(staff(targetId, false)),
      findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockImplementation(({ data }: { data: { updatedAt: Date } }) => Promise.resolve({ ...staff(targetId, true), updatedAt: data.updatedAt })),
    },
    role: { findMany: jest.fn().mockResolvedValue(allPresets) },
    branch: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    userRole: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const runInternal = jest.fn((callback: (client: TenantClient) => Promise<unknown>) => callback(transaction as unknown as TenantClient));
  const repository = { runInternal } as unknown as UsersRepository;
  const service = new UsersService(repository, context, noAnalytics());
  return { context, transaction, runInternal, service };
}

describe('staff role contracts and endpoint permissions', () => {
  it('accepts removal and rejects arbitrary permissions, duplicate roles and tenant fields', () => {
    expect(StaffRoleUpdateSchema.safeParse({ roleKeys: [], updatedAt: timestamp, reason: 'Access no longer needed' }).success).toBe(true);
    for (const roleKeys of [['quotes.read'], ['customer_admin'], ['platform_admin', 'platform_admin']]) {
      expect(StaffRoleUpdateSchema.safeParse({ roleKeys, updatedAt: timestamp, reason: 'Change' }).success).toBe(false);
    }
    expect(StaffRoleUpdateSchema.safeParse({ roleKeys: [], updatedAt: timestamp, reason: ' ', customerGroupId: targetId }).success).toBe(false);
    expect(StaffListQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });

  it.each(['list', 'presets', 'updateRoles'] as const)('%s rejects customer users.manage alone with 403', (method) => {
    const context = new TenantContext();
    const guard = new PermissionGuard(new Reflector(), context);
    const execution = { getHandler: () => UsersController.prototype[method], getClass: () => UsersController } as unknown as ExecutionContext;
    expect(() => context.run({ ...actorContext, permissions: new Set([PERMISSIONS.USERS_MANAGE]) }, () => guard.canActivate(execution))).toThrow(ForbiddenException);
  });

  it('validates the request before calling the service', () => {
    const service = { updateRoles: jest.fn() } as unknown as UsersService;
    const controller = new UsersController(service);
    expect(() => controller.updateRoles(targetId, { permissionKeys: ['admin.staff.roles.manage'] })).toThrow(BadRequestException);
    expect(service.updateRoles).not.toHaveBeenCalled();
  });
});

describe('staff role assignment', () => {
  it('rejects customer and impersonated contexts before database access', async () => {
    const { context, service, runInternal } = setup();
    for (const actor of [{ ...actorContext, isInternal: false }, { ...actorContext, onBehalfOfUserId: targetId }]) {
      await expect(context.run(actor, () => service.updateRoles(targetId, { roleKeys: [], branchId: null, updatedAt: timestamp, reason: 'Remove' }))).rejects.toThrow(ForbiddenException);
    }
    expect(runInternal).not.toHaveBeenCalled();
  });

  it('locks and rechecks the actor before writing and audits before/after atomically', async () => {
    const { context, service, transaction } = setup();
    await context.run(actorContext, () => service.updateRoles(targetId, { roleKeys: ['platform_admin'], branchId: null, updatedAt: timestamp, reason: 'Delegate staff administration' }));
    expect(transaction.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(transaction.user.findFirst.mock.invocationCallOrder[0]!);
    expect(transaction.userRole.createMany).toHaveBeenCalledWith({ data: [{ userId: targetId, roleId: role.id, assignedById: actorId }] });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'staff.roles.changed', actorUserId: actorId, entityId: targetId, metadata: expect.objectContaining({ before: [], after: ['platform_admin'], reason: 'Delegate staff administration' }) }) });
  });

  it('rejects a stale version without writing roles or audit', async () => {
    const { context, service, transaction } = setup();
    await expect(context.run(actorContext, () => service.updateRoles(targetId, { roleKeys: [], branchId: null, updatedAt: '2026-09-11T10:00:00.000Z', reason: 'Remove' }))).rejects.toThrow(ConflictException);
    expect(transaction.userRole.deleteMany).not.toHaveBeenCalled();
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a revoked actor after acquiring the shared lock', async () => {
    const { context, service, transaction } = setup();
    transaction.user.findFirst.mockReset().mockResolvedValueOnce(staff(actorId, false));
    await expect(context.run(actorContext, () => service.updateRoles(targetId, { roleKeys: [], branchId: null, updatedAt: timestamp, reason: 'Remove' }))).rejects.toThrow(ForbiddenException);
    expect(transaction.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks self-demotion', async () => {
    const { context, service, transaction } = setup();
    transaction.user.findFirst.mockReset().mockResolvedValue(staff(actorId, true));
    await expect(context.run(actorContext, () => service.updateRoles(actorId, { roleKeys: [], branchId: null, updatedAt: timestamp, reason: 'Remove' }))).rejects.toThrow(ConflictException);
    expect(transaction.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks removal when no other active administrator remains', async () => {
    const { context, service, transaction } = setup();
    transaction.user.findFirst.mockReset().mockResolvedValueOnce(staff(actorId, true)).mockResolvedValueOnce(staff(targetId, true));
    transaction.user.count.mockResolvedValue(0);
    await expect(context.run(actorContext, () => service.updateRoles(targetId, { roleKeys: [], branchId: null, updatedAt: timestamp, reason: 'Remove' }))).rejects.toThrow(ConflictException);
    expect(transaction.auditEvent.create).not.toHaveBeenCalled();
  });

  it('propagates audit failure so the real repository transaction rolls back', async () => {
    const { context, service, transaction } = setup();
    transaction.auditEvent.create.mockRejectedValue(new Error('audit unavailable'));
    await expect(context.run(actorContext, () => service.updateRoles(targetId, { roleKeys: ['platform_admin'], branchId: null, updatedAt: timestamp, reason: 'Delegate' }))).rejects.toThrow('audit unavailable');
  });
});

describe('staff identity resolution', () => {
  const issuer = 'https://login.microsoftonline.com/3b618463-9352-4fa4-a67c-112da2837c29/v2.0';
  const claims = { issuer, subject: 'oid-1', email: 'new.starter@adports.ae', name: 'New Starter' };

  function build(settings: Record<string, unknown>, ...results: unknown[][]) {
    const $queryRaw = jest.fn();
    for (const result of results) $queryRaw.mockResolvedValueOnce(result);
    $queryRaw.mockResolvedValue([]);
    const prisma = { $queryRaw } as unknown as ConstructorParameters<typeof IdentityService>[0];
    const config = { get: (key: string) => settings[key] } as unknown as ConstructorParameters<typeof IdentityService>[1];
    return { service: new IdentityService(prisma, config), $queryRaw };
  }

  const registered = [{ user_id: targetId, customer_group_id: null, is_internal: true, status: 'registered', display_name: 'New Starter', email: 'new.starter@adports.ae', permissions: [], account_ids: [] }];

  it('registers an eligible first sign-in with no permissions at all', async () => {
    const { service, $queryRaw } = build({ 'identity.staffEmailDomains': ['adports.ae'] }, [], [{}], registered);
    const identity = await service.resolve(claims);
    expect(identity).toMatchObject({ id: targetId, status: 'registered', isInternal: true, permissions: [] });
    // lookup, register, lookup again.
    expect($queryRaw).toHaveBeenCalledTimes(3);
  });

  it('refuses to self-register an identity outside the configured staff domains', async () => {
    const { service, $queryRaw } = build({ 'identity.staffEmailDomains': ['adports.ae'] }, []);
    expect(await service.resolve({ ...claims, email: 'outsider@example.test' })).toBeNull();
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it('never registers an identity that carries no email', async () => {
    const { service, $queryRaw } = build({ 'identity.staffEmailDomains': [] }, []);
    expect(await service.resolve({ issuer, subject: 'oid-2' })).toBeNull();
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it('lets a configured bootstrap administrator in before any role exists', async () => {
    const { service } = build(
      { 'identity.staffEmailDomains': ['adports.ae'], 'identity.bootstrapAdmins': ['new.starter@adports.ae'] },
      registered,
    );
    const identity = await service.resolve(claims);
    expect(identity?.status).toBe('active');
    expect(identity?.permissions).toContain(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE);
  });

  it('gives an unlisted identity no bootstrap access', async () => {
    const { service } = build(
      { 'identity.staffEmailDomains': ['adports.ae'], 'identity.bootstrapAdmins': ['someone.else@adports.ae'] },
      registered,
    );
    const identity = await service.resolve(claims);
    expect(identity?.status).toBe('registered');
    expect(identity?.permissions).toEqual([]);
  });
});
