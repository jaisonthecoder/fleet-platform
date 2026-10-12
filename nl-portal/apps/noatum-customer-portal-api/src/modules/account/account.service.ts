import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { TenantRepository, type TenantClient } from '../../common/tenancy/tenant.repository';
import {
  AssignableRoleSchema,
  ChangeRolesSchema,
  InviteColleagueSchema,
  PERMISSIONS,
  ROLE_PRESETS,
  type AccountActionReason,
  type AccountContactDto,
  type AccountInvitationDto,
  type AccountOverviewDto,
  type AccountRolePresetDto,
  type AccountSetupStepDto,
  type AccountUserDto,
  type AssignableRole,
} from '../../contracts';
import { createInvitationToken } from '../../contracts/dto/invitation.dto';

/** The design caps resends at three; a fourth means "revoke and start again". */
const RESEND_LIMIT = 3;
const INVITATION_TTL_DAYS = 7;
/** Anti-abuse. An administrator onboarding a department sends a handful, not a hundred. */
const INVITES_PER_DAY = 20;

const ASSIGNABLE = new Set<string>(AssignableRoleSchema.options);

/**
 * The customer's own account.
 *
 * Every read and write is scoped by `repo.run()`, which sets the tenant from the
 * session and lets row-level security do the filtering. No method here takes a
 * customer id, and none may ever be given one: the Noatum-side equivalent in
 * `customers.service` is told which customer to act on, and that is precisely
 * what a customer administrator must not be able to say.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly repo: TenantRepository,
    private readonly context: TenantContext,
  ) {}

  /* ── the dashboard's single call ───────────────────────────────────────── */

  async overview(): Promise<AccountOverviewDto> {
    const { userId, permissions } = this.context.require();

    return this.repo.run(async (tx) => {
      const groupId = this.context.requireGroupId();

      const [group, me, accounts, userCount, pendingInvitationCount, addressCount, quoteCount] =
        await Promise.all([
          tx.customerGroup.findUnique({
            where: { id: groupId },
            include: { defaultServicingBranch: true },
          }),
          tx.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } }, accounts: { include: { account: true } } },
          }),
          tx.customerAccount.findMany({
            where: { isActive: true },
            include: { servicingBranch: true },
            orderBy: { name: 'asc' },
          }),
          tx.user.count(),
          tx.invitation.count({ where: { status: 'pending' } }),
          tx.addressBookEntry.count(),
          tx.quote.count(),
        ]);

      if (!group || !me) throw new NotFoundException('Account not found.');

      /*
       * Setup steps are reported, never assumed.
       *
       * Three of them are observable from data the platform already holds. The
       * other two are not: there is no record of a profile having been reviewed,
       * and notification preferences do not exist yet. Those come back
       * `trackable: false` so the screen can offer the step without claiming to
       * know whether it is finished — which is better than a checklist that
       * quietly lies in either direction.
       */
      const setup: AccountSetupStepDto[] = [
        { id: 'profile', done: false, trackable: false },
        { id: 'users', done: userCount > 1 || pendingInvitationCount > 0, trackable: true },
        { id: 'addresses', done: addressCount > 0, trackable: true },
        { id: 'alerts', done: false, trackable: false },
        { id: 'quote', done: quoteCount > 0, trackable: true },
      ];

      /*
       * Named Noatum contacts have no home in the schema yet: `branch` carries a
       * code, a name and a city, and nothing links a customer to the people who
       * look after it. The call exists and returns an empty list rather than
       * inventing one, so the block appears the moment that data does.
       */
      const contacts: AccountContactDto[] = [];

      const branch = accounts.find((a) => a.servicingBranch)?.servicingBranch ?? group.defaultServicingBranch;

      return {
        customerName: group.name,
        legalName: group.legalName,
        countryCode: group.countryCode,
        tier: group.tier,
        roleNames: me.roles.map((r) => r.role.name),
        permissions: [...permissions],
        offices: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          cw1OrgCode: account.cw1OrgCode,
          servicingBranchName: account.servicingBranch?.name ?? null,
        })),
        servicingBranchName: branch?.name ?? null,
        servicingBranchCode: branch?.code ?? null,
        signInEmail: me.email,
        signInMethod: me.entraObjectId ? 'entra' : 'portal',
        setup,
        contacts,
        /*
         * Real counts of what is visible today, not a progress bar for a
         * back-office sweep. The design showed "1,412 of 1,412 shipments
         * re-evaluated"; no such process exists, and a bar that fills itself
         * would be theatre. A count that says zero is at least true.
         */
        records: {
          shipments: 0,
          quotations: quoteCount,
          invoices: 0,
          bookings: 0,
        },
        userCount,
        pendingInvitationCount,
      };
    });
  }

  /* ── people ────────────────────────────────────────────────────────────── */

  async users(): Promise<AccountUserDto[]> {
    const { userId } = this.context.require();

    return this.repo.run(async (tx) => {
      const rows = await tx.user.findMany({
        where: { isInternal: false },
        include: { roles: { include: { role: true } }, accounts: { include: { account: true } } },
        orderBy: [{ displayName: 'asc' }],
      });

      return rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        status: row.status,
        roleKeys: row.roles.map((r) => r.role.key),
        roleNames: row.roles.map((r) => r.role.name),
        // No rows in user_account_access means every office, not none.
        officeName: row.accounts.length === 1 ? (row.accounts[0]?.account.name ?? null) : null,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        isSelf: row.id === userId,
      }));
    });
  }

  async rolePresets(): Promise<AccountRolePresetDto[]> {
    return this.repo.run(async (tx) => {
      const roles = await tx.role.findMany({
        where: { key: { in: [...ASSIGNABLE] }, isInternal: false },
        orderBy: { key: 'asc' },
      });

      return roles.map((role) => ({
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: [...(ROLE_PRESETS[role.key as AssignableRole] ?? [])],
      }));
    });
  }

  async invitations(): Promise<AccountInvitationDto[]> {
    return this.repo.run(async (tx) => {
      const rows = await tx.invitation.findMany({
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
      });
      return rows.map((row) => this.toInvitation(row, null));
    });
  }

  async invite(input: unknown): Promise<AccountInvitationDto> {
    const data = InviteColleagueSchema.parse(input);
    const { userId } = this.context.require();

    return this.repo.run(async (tx) => {
      const groupId = this.context.requireGroupId();
      const group = await tx.customerGroup.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Account not found.');

      /*
       * The domain rule, and the one place this differs from the Noatum-side
       * invite: a Customer Admin cannot override it.
       *
       * Noatum can invite an outside address with a recorded reason, because
       * Noatum owns the relationship. A customer administrator inviting anyone
       * with any address would turn a portal account into an open door onto
       * their own shipment data, so here it is a hard refusal with no override
       * parameter to find.
       */
      const domain = data.email.split('@')[1] ?? '';
      if (group.emailDomains.length > 0 && !group.emailDomains.includes(domain)) {
        throw new ConflictException({
          message: `${domain} is not one of your company's email domains. Ask your Noatum office to invite this person.`,
          details: { code: 'DOMAIN_NOT_ALLOWED', domain, allowed: group.emailDomains },
        });
      }

      const existing = await tx.user.findFirst({ where: { email: data.email } });
      if (existing) {
        throw new ConflictException({
          message: 'That person already has an account here.',
          details: { code: 'EMAIL_TAKEN' },
        });
      }

      const pending = await tx.invitation.findFirst({ where: { email: data.email, status: 'pending' } });
      if (pending) {
        throw new ConflictException({
          message: 'That person already has an invitation waiting. Revoke it before sending another.',
          details: { code: 'INVITATION_PENDING' },
        });
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const today = await tx.invitation.count({ where: { createdAt: { gte: since } } });
      if (today >= INVITES_PER_DAY) {
        throw new ConflictException({
          message: 'You have sent the maximum number of invitations for today. Try again tomorrow.',
          details: { code: 'INVITE_LIMIT' },
        });
      }

      if (data.officeAccountId) {
        // RLS keeps this inside the caller's own group, so a foreign id is "not found".
        const office = await tx.customerAccount.findUnique({ where: { id: data.officeAccountId } });
        if (!office) throw new BadRequestException('That office does not belong to your account.');
      }

      const { token, tokenHash } = createInvitationToken();
      const created = await tx.invitation.create({
        data: {
          customerGroupId: groupId,
          email: data.email,
          displayName: data.displayName,
          roleKeys: data.roleKeys,
          officeAccountId: data.officeAccountId,
          tokenHash,
          expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
          invitedById: userId,
        },
      });

      await this.audit(tx, 'invitation.sent', created.id, {
        email: data.email,
        roleKeys: data.roleKeys,
      });

      return this.toInvitation(created, token);
    });
  }

  async resend(invitationId: string, input: unknown): Promise<AccountInvitationDto> {
    const { reason } = this.reason(input);

    return this.repo.run(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation) throw new NotFoundException('Invitation not found.');
      if (invitation.status !== 'pending') {
        throw new ConflictException('That invitation is no longer waiting to be accepted.');
      }
      if (invitation.resendCount >= RESEND_LIMIT) {
        throw new ConflictException({
          message: 'This invitation has been resent three times. Revoke it and send a new one.',
          details: { code: 'RESEND_LIMIT' },
        });
      }

      const { token, tokenHash } = createInvitationToken();
      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: {
          tokenHash,
          resendCount: { increment: 1 },
          expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });

      await this.audit(tx, 'invitation.resent', invitationId, { reason });
      return this.toInvitation(updated, token);
    });
  }

  async revoke(invitationId: string, input: unknown): Promise<AccountInvitationDto> {
    const { reason } = this.reason(input);

    return this.repo.run(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation) throw new NotFoundException('Invitation not found.');
      if (invitation.status !== 'pending') {
        throw new ConflictException('That invitation is no longer waiting to be accepted.');
      }

      const updated = await tx.invitation.update({
        where: { id: invitationId },
        data: { status: 'revoked' },
      });

      await this.audit(tx, 'invitation.revoked', invitationId, { reason });
      return this.toInvitation(updated, null);
    });
  }

  async changeRoles(targetUserId: string, input: unknown): Promise<AccountUserDto> {
    const data = ChangeRolesSchema.parse(input);

    return this.repo.run(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { roles: { include: { role: true } } },
      });
      if (!target || target.isInternal) throw new NotFoundException('User not found.');

      const before = target.roles.map((r) => r.role.key);
      await this.guardLastAdministrator(tx, targetUserId, before, data.roleKeys);

      const roles = await tx.role.findMany({ where: { key: { in: data.roleKeys }, isInternal: false } });
      if (roles.length !== data.roleKeys.length) {
        throw new BadRequestException('One of those roles cannot be assigned here.');
      }

      await tx.userRole.deleteMany({ where: { userId: targetUserId } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: targetUserId, roleId: role.id })),
      });

      await tx.userAccountAccess.deleteMany({ where: { userId: targetUserId } });
      if (data.officeAccountId) {
        const office = await tx.customerAccount.findUnique({ where: { id: data.officeAccountId } });
        if (!office) throw new BadRequestException('That office does not belong to your account.');
        await tx.userAccountAccess.create({
          data: { userId: targetUserId, accountId: data.officeAccountId },
        });
      }

      await this.audit(tx, 'role.changed', targetUserId, {
        before,
        after: data.roleKeys,
        reason: data.reason,
      });

      return (await this.users()).find((u) => u.id === targetUserId)!;
    });
  }

  async setStatus(targetUserId: string, active: boolean, input: unknown): Promise<AccountUserDto> {
    const { reason } = this.reason(input);
    const { userId } = this.context.require();

    if (targetUserId === userId && !active) {
      throw new ConflictException('You cannot deactivate your own account.');
    }

    return this.repo.run(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { roles: { include: { role: true } } },
      });
      if (!target || target.isInternal) throw new NotFoundException('User not found.');

      if (!active) {
        const keys = target.roles.map((r) => r.role.key);
        await this.guardLastAdministrator(tx, targetUserId, keys, []);
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: { status: active ? 'active' : 'disabled' },
      });

      await this.audit(tx, active ? 'user.reactivated' : 'user.deactivated', targetUserId, { reason });
      return (await this.users()).find((u) => u.id === targetUserId)!;
    });
  }

  /* ── helpers ───────────────────────────────────────────────────────────── */

  /**
   * An account with nobody who can administer it is an account that needs a
   * support call to recover, so the last administrator cannot be demoted or
   * switched off — by themselves or by anyone else.
   */
  private async guardLastAdministrator(
    tx: TenantClient,
    targetUserId: string,
    before: string[],
    after: string[],
  ): Promise<void> {
    const wasAdmin = before.includes('customer_admin');
    const staysAdmin = after.includes('customer_admin');
    if (!wasAdmin || staysAdmin) return;

    const admins = await tx.userRole.count({
      where: {
        role: { key: 'customer_admin' },
        user: { status: 'active', isInternal: false },
        NOT: { userId: targetUserId },
      },
    });

    if (admins === 0) {
      throw new ConflictException({
        message: 'This is the only administrator on the account. Give someone else the role first.',
        details: { code: 'LAST_ADMINISTRATOR' },
      });
    }
  }

  private reason(input: unknown): AccountActionReason {
    if (!input || typeof input !== 'object' || typeof (input as { reason?: unknown }).reason !== 'string') {
      throw new BadRequestException('A reason is required.');
    }
    const reason = (input as { reason: string }).reason.trim();
    if (!reason) throw new BadRequestException('A reason is required.');
    return { reason: reason.slice(0, 400) };
  }

  private toInvitation(
    row: {
      id: string;
      email: string;
      displayName: string | null;
      status: string;
      roleKeys: string[];
      expiresAt: Date;
      resendCount: number;
      createdAt: Date;
    },
    token: string | null,
  ): AccountInvitationDto {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      status: row.status,
      roleKeys: row.roleKeys,
      expiresAt: row.expiresAt.toISOString(),
      resendCount: row.resendCount,
      invitedByName: null,
      createdAt: row.createdAt.toISOString(),
      inviteUrl: token,
    };
  }

  private async audit(
    tx: TenantClient,
    action: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { userId } = this.context.require();
    await tx.auditEvent.create({
      data: {
        customerGroupId: this.context.requireGroupId(),
        actorUserId: userId,
        action,
        entityType: 'account',
        entityId,
        metadata: payload as never,
      },
    });
  }
}

/** Re-exported so the controller can name the permissions it guards with. */
export const ACCOUNT_PERMISSIONS = {
  read: PERMISSIONS.USERS_READ,
  manage: PERMISSIONS.USERS_MANAGE,
} as const;
