import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import { PERMISSIONS } from '../../contracts/permissions';
import { STAFF_ROLE_KEYS, type StaffAccessLinkRequest, type StaffListQuery, type StaffRoleUpdate, type StaffSecurityDto, type StaffUserDto } from '../../contracts/dto/staff.dto';
import { LocalAuthService } from '../local-auth/local-auth.service';
import { UsersRepository } from './users.repository';

const includeRoles = {
  roles: { include: { role: { include: { permissions: true } } } },
  branch: { include: { region: true } },
} as const;
type StaffRecord = Prisma.UserGetPayload<{ include: typeof includeRoles }>;

/** Pricing is branch scoped, so none of these may be held without a branch. */
const BRANCH_SCOPED_PERMISSIONS: readonly string[] = [
  PERMISSIONS.PRICING_QUEUE_READ,
  PERMISSIONS.PRICING_CLAIM,
  PERMISSIONS.PRICING_CLAIM_RELEASE,
  PERMISSIONS.PRICING_PRICE,
  PERMISSIONS.PRICING_APPROVE,
];

function permissions(user: StaffRecord): string[] {
  return [...new Set(user.roles.flatMap(({ role }) => role.permissions.map(({ permissionKey }) => permissionKey)))].sort();
}

function dto(user: StaffRecord, security: StaffSecurityDto | null = null): StaffUserDto {
  return {
    id: user.id, displayName: user.displayName, email: user.email, status: user.status,
    roleKeys: user.roles.map(({ role }) => role.key).sort(), permissions: permissions(user),
    branch: user.branch ? {
      id: user.branch.id, code: user.branch.code, name: user.branch.name,
      city: user.branch.city, countryCode: user.branch.countryCode,
      regionName: user.branch.region?.name ?? null,
    } : null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    // A real token issuer means Microsoft signs them in. The seeded `dev://` issuer is
    // not one, so a demonstration account still reads as needing a password.
    usesSso: (user.idpIssuer ?? '').startsWith('https://'),
    updatedAt: user.updatedAt.toISOString(),
    security,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repository: UsersRepository,
    private readonly context: TenantContext,
    private readonly analytics: AnalyticsService,
    // Registered only when portal password sign-in is on, so the staff screen reports
    // no sign-in state at all rather than an empty one when it is off.
    @Optional() private readonly localAuth?: LocalAuthService,
  ) {}

  private authorize(permission: string) {
    const actor = this.context.require();
    if (!actor.isInternal || actor.onBehalfOfUserId || !actor.permissions.has(permission)) {
      throw new ForbiddenException('Internal staff permission required.');
    }
    return actor;
  }

  async list(query: StaffListQuery) {
    this.authorize(PERMISSIONS.ADMIN_STAFF_READ);
    const result = await this.repository.runInternal(async (transaction) => {
      const where: Prisma.UserWhereInput = {
        isInternal: true,
        ...(query.search ? { OR: [
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ] } : {}),
      };
      const [users, total] = await Promise.all([
        transaction.user.findMany({ where, include: includeRoles, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
        transaction.user.count({ where }),
      ]);
      const security = this.localAuth ? await this.localAuth.accountSecurity(users.map((user) => user.id)) : null;
      return { items: users.map((user) => dto(user, security?.get(user.id) ?? null)), total, page: query.page, pageSize: query.pageSize };
    });
    this.track('staff.list');
    return result;
  }

  async presets() {
    this.authorize(PERMISSIONS.ADMIN_STAFF_READ);
    return this.repository.runInternal(async (transaction) => {
      const roles = await transaction.role.findMany({ where: { key: { in: [...STAFF_ROLE_KEYS] }, isInternal: true }, include: { permissions: true }, orderBy: { key: 'asc' } });
      return roles.map((role) => ({ key: role.key as (typeof STAFF_ROLE_KEYS)[number], permissions: role.permissions.map(({ permissionKey }) => permissionKey).sort() }));
    });
  }

  /** The branches an administrator may assign. Inactive branches are not offered. */
  async branches() {
    this.authorize(PERMISSIONS.ADMIN_STAFF_READ);
    return this.repository.runInternal(async (transaction) => {
      const rows = await transaction.branch.findMany({
        where: { isActive: true },
        include: { region: true },
        orderBy: [{ code: 'asc' }],
      });
      return rows.map((branch) => ({
        id: branch.id, code: branch.code, name: branch.name,
        city: branch.city, countryCode: branch.countryCode,
        regionName: branch.region?.name ?? null,
      }));
    });
  }

  async updateRoles(id: string, update: StaffRoleUpdate) {
    const actor = this.authorize(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE);
    const result = await this.repository.runInternal(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(1950502, 1)`;
      const currentActor = await transaction.user.findFirst({ where: { id: actor.userId, isInternal: true, status: 'active' }, include: includeRoles });
      if (!currentActor || !permissions(currentActor).includes(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE)) {
        throw new ForbiddenException('Staff role permission has been removed.');
      }
      await transaction.$queryRaw`SELECT id FROM "user" WHERE id = ${id}::uuid AND is_internal = true FOR UPDATE`;
      const target = await transaction.user.findFirst({ where: { id, isInternal: true }, include: includeRoles });
      if (!target) throw new NotFoundException();
      if (target.updatedAt.toISOString() !== update.updatedAt) throw new ConflictException({ message: 'Reload the staff record before saving.', details: { code: 'STALE_STAFF' } });
      const roles = await transaction.role.findMany({ where: { key: { in: [...STAFF_ROLE_KEYS] }, isInternal: true }, include: { permissions: true } });
      if (roles.length !== STAFF_ROLE_KEYS.length) throw new ConflictException({ message: 'The staff role preset migration has not been applied.', details: { code: 'PRESETS_UNAVAILABLE' } });
      const selected = roles.filter((role) => update.roleKeys.includes(role.key as (typeof STAFF_ROLE_KEYS)[number]));
      const retained = target.roles.filter(({ role }) => !STAFF_ROLE_KEYS.some((key) => key === role.key));
      const nextPermissions = new Set([
        ...retained.flatMap(({ role }) => role.permissions.map(({ permissionKey }) => permissionKey)),
        ...selected.flatMap((role) => role.permissions.map(({ permissionKey }) => permissionKey)),
      ]);
      if (id === actor.userId && !nextPermissions.has(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE)) {
        throw new ConflictException({ message: 'You cannot remove your own staff administration access.', details: { code: 'SELF_ADMIN_REMOVAL' } });
      }
      if (target.status === 'active' && permissions(target).includes(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE) && !nextPermissions.has(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE)) {
        const otherAdmins = await transaction.user.count({ where: { id: { not: id }, isInternal: true, status: 'active', roles: { some: { role: { permissions: { some: { permissionKey: PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE } } } } } } });
        if (otherAdmins === 0) throw new ConflictException({ message: 'The last active staff administrator cannot be removed.', details: { code: 'LAST_STAFF_ADMIN' } });
      }
      const before = target.roles.map(({ role }) => role.key).sort();
      const after = [...retained.map(({ role }) => role.key), ...selected.map((role) => role.key)].sort();

      // FR-IAM-003: pricing scope comes from the branch, so the grant is refused
      // rather than silently producing a person who can price nothing.
      const branchId = update.branchId;
      if (branchId) {
        const branch = await transaction.branch.findFirst({ where: { id: branchId, isActive: true } });
        if (!branch) throw new ConflictException({ message: 'Select an active branch.', details: { code: 'BRANCH_UNAVAILABLE' } });
      }
      if (!branchId && [...nextPermissions].some((permission) => BRANCH_SCOPED_PERMISSIONS.includes(permission))) {
        throw new ConflictException({ message: 'Assign a branch before granting a pricing role.', details: { code: 'BRANCH_REQUIRED' } });
      }

      const branchChanged = (target.branchId ?? null) !== (branchId ?? null);
      if (JSON.stringify(before) === JSON.stringify(after) && !branchChanged) return dto(target);
      await transaction.userRole.deleteMany({ where: { userId: id, roleId: { in: roles.map((role) => role.id) } } });
      await transaction.userRole.createMany({ data: selected.map((role) => ({ userId: id, roleId: role.id, assignedById: actor.userId })) });
      // A first grant moves the person out of access-pending. Removing roles does not
      // reverse it: withdrawing access is deactivation, which is a separate action.
      const status = target.status === 'registered' && after.length > 0 ? 'active' as const : target.status;
      const saved = await transaction.user.update({ where: { id }, data: { status, branchId: branchId ?? null, updatedAt: new Date(Math.max(Date.now(), target.updatedAt.getTime() + 1)) }, include: includeRoles });
      await transaction.auditEvent.create({ data: {
        actorUserId: actor.userId, action: 'staff.roles.changed', entityType: 'user', entityId: id,
        metadata: { before, after, branchBefore: target.branchId ?? null, branchAfter: branchId ?? null, reason: update.reason, correlationId: actor.correlationId },
      } });
      return dto(saved);
    });
    this.track('staff.roles.saved', id);
    return result;
  }

  /**
   * Hands a member of staff a one-time link to choose a password.
   *
   * For anyone the company's Microsoft sign-in does not cover: the first administrator,
   * a contractor outside the tenant, someone whose account is not yet in Entra, and the
   * fictional staff a demonstration environment carries. Microsoft sign-in is untouched
   * by this - an account that has it keeps using it and needs no link.
   *
   * The link is shown once and never stored, so it cannot be read back off a screen or
   * out of the database later. Issuing another supersedes it, which is how an operator
   * recovers from losing one.
   */
  async issueAccessLink(id: string, input: StaffAccessLinkRequest) {
    const actor = this.authorize(PERMISSIONS.ADMIN_STAFF_ROLES_MANAGE);
    if (!this.localAuth) {
      throw new ServiceUnavailableException({
        message: 'Portal password sign-in is switched off, so no link can be issued.',
        details: { code: 'LOCAL_AUTH_UNAVAILABLE' },
      });
    }

    const target = await this.repository.runInternal(async (transaction) => {
      const found = await transaction.user.findFirst({ where: { id, isInternal: true } });
      if (!found) throw new NotFoundException();
      if (found.status === 'suspended' || found.status === 'disabled') {
        throw new ConflictException({
          message: 'This account is not active, so a sign-in link would not work.',
          details: { code: 'ACCOUNT_INACTIVE' },
        });
      }
      await transaction.auditEvent.create({ data: {
        actorUserId: actor.userId, action: 'staff.access_link.issued', entityType: 'user', entityId: id,
        metadata: { email: found.email, reason: input.reason, correlationId: actor.correlationId },
      } });
      return found;
    });

    const security = (await this.localAuth.accountSecurity([id])).get(id);
    const issued = await this.localAuth.issueStaffAccessLink({
      userId: target.id,
      email: target.email,
      displayName: target.displayName,
      hasPassword: security?.hasPassword ?? false,
    });

    this.track('staff.access_link.issued', id);
    return issued;
  }

  private track(action: string, entityId?: string) {    const actor = this.context.require();
    this.logger.log({ event: 'AnalyticsEvent', action, actorUserId: actor.userId, entityId, correlationId: actor.correlationId });
    // Not awaited: the caller's write has already committed, and a counting
    // failure must not turn a successful action into an error.
    void this.analytics.record({ action, entityType: 'user', entityId });
  }
}
