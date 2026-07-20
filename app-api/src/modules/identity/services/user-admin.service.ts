import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type AssignRole,
  bucketUserSummary,
  type ListUsersQuery,
  type PagedResult,
  type UserDirectoryDto,
  type UserRoleDto,
  type UserSummaryDto,
} from '../../../contracts/user-admin.contract';
import { AuditService } from '../../platform/services/audit.service';
import { SodGuardService } from '../../platform/services/sod-guard.service';
import { IdentityRepository } from '../repositories/identity.repository';

/**
 * User/access administration (1A₂). Admins assign hierarchy-scoped roles;
 * **SoD is enforced at assignment time** (a grant that would create a forbidden
 * co-hold is rejected — LU-2), every grant is audited with the acting admin,
 * and revocation is an effective-date expiry, never a hard delete.
 */
@Injectable()
export class UserAdminService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly sod: SodGuardService,
    private readonly audit: AuditService,
  ) {}

  /** Assigns a role at a scope after checking the resulting co-hold is SoD-legal. */
  async assignRole(input: AssignRole & { organizationId: string }): Promise<{ id: string }> {
    const current = await this.repo.listActiveRolesOnScope(input.personId, input.scopeNodeId);
    // SoD-at-assignment: verify the *resulting* set, then grant.
    this.sod.assertRoleAssignment([...current, input.role]);

    const row = await this.repo.insertRoleAssignment({
      organizationId: input.organizationId,
      personId: input.personId,
      role: input.role,
      scopeNodeId: input.scopeNodeId,
      source: input.source ?? 'manual',
      assignedByPersonId: input.assignedByPersonId ?? null,
    });
    await this.audit.record({
      actorRef: input.assignedByPersonId ?? 'system',
      action: 'ROLE_ASSIGNED',
      entityRef: `person:${input.personId}`,
      after: { role: input.role, scopeNodeId: input.scopeNodeId, source: input.source ?? 'manual' },
    });
    return { id: row.id };
  }

  /** Revokes (effective-date-expires) a role assignment; audited. */
  async revokeRole(assignmentId: string, actorRef = 'system'): Promise<void> {
    const row = await this.repo.expireRoleAssignment(assignmentId);
    await this.audit.record({
      actorRef,
      action: 'ROLE_REVOKED',
      entityRef: `role-assignment:${assignmentId}`,
      after: { validTo: row?.validTo ?? null },
    });
  }

  /** Lists the workforce directory (paged + enriched: roles, cluster, account state). */
  async listUsers(query: ListUsersQuery): Promise<PagedResult<UserDirectoryDto>> {
    const { items, total } = await this.repo.listUsersPaged({
      search: query.search,
      status: query.status,
      role: query.role,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: items.map((u) => ({
        personId: u.personId,
        userId: u.userId,
        name: u.name,
        email: u.email,
        employeeId: u.employeeId,
        grade: u.grade,
        roles: u.roles,
        cluster: u.cluster,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        accountStatus: u.accountStatus,
        status: u.status,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** User-population summary tiles (bucketed by role family). */
  async summary(): Promise<UserSummaryDto> {
    return bucketUserSummary(await this.repo.summaryCounts());
  }

  /** The active roles a person holds (per-person access view). */
  async listPersonRoles(personId: string): Promise<UserRoleDto[]> {
    const rows = await this.repo.listRolesForPerson(personId);
    return rows.map((r) => ({
      assignmentId: r.assignmentId,
      role: r.role,
      scopeNodeId: r.scopeNodeId,
      scopeName: r.scopeName ?? null,
      source: r.source,
    }));
  }

  /**
   * Suspends or reactivates the SSO login account of a person. Only meaningful
   * once an account exists (JIT-provisioned on first sign-in); resolves the
   * account by user id or person id and 400s when the person has never logged in.
   */
  async setStatus(
    ref: { userId?: string; personId?: string },
    status: 'Active' | 'Suspended',
    actorRef = 'system',
  ): Promise<void> {
    const account = ref.userId
      ? await this.repo.findUserById(ref.userId)
      : ref.personId
        ? await this.repo.findUserByPersonId(ref.personId)
        : undefined;
    if (!account) {
      throw new BadRequestException({
        title: 'No login account',
        reasons: ['This person has never signed in, so there is no account to suspend or reactivate.'],
      });
    }
    await this.repo.updateUser(account.id, { status });
    await this.audit.record({
      actorRef,
      action: status === 'Suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entityRef: `user:${account.id}`,
      after: { status },
    });
  }
}
