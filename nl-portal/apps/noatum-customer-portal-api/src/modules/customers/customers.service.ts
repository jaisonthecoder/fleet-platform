import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type CustomerStatus } from '@prisma/client';

import { TenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import type { TenantClient } from '../../common/tenancy/tenant.repository';
import { EmailAdapter } from '../../contracts/adapters/email.adapter';
import { LocalAuthService } from '../local-auth/local-auth.service';
import {
  CUSTOMER_TRANSITIONS,
  DISCARDABLE_CUSTOMER_STATUSES,
  canTransition,
  goLiveReadiness,
} from '../../contracts/customer.status';
import type {
  AccountAction,
  AccountActionResultDto,
  CustomerCreate,
  CustomerDetailDto,
  CustomerLinkDto,
  CustomerListDto,
  CustomerQuery,
  CustomerStatusChange,
  CustomerTaskDto,
  CustomerUpdate,
  CustomerUserListDto,
  CustomerUserQuery,
  DirectoryListDto,
  DirectoryOrganisationDto,
  OrganisationLinkCreate,
  OrganisationLinkRemove,
  OrganisationLinkServicing,
  OrganisationSearch,
  UserAccessUpdate,
} from '../../contracts/dto/customer.dto';
import { PERMISSIONS, ROLES } from '../../contracts/permissions';
import {
  INVITATION_TTL_DAYS,
  createInvitationToken,
  type InvitationDto,
  type InviteAdministrator,
} from '../../contracts/dto/invitation.dto';
import { CustomersRepository } from './customers.repository';

const customerInclude = {
  parent: { select: { id: true, name: true } },
  defaultServicingBranch: { select: { id: true, code: true } },
  _count: { select: { users: true, accounts: true } },
} as const;
type CustomerRecord = Prisma.CustomerGroupGetPayload<{ include: typeof customerInclude }>;

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly repository: CustomersRepository,
    private readonly context: TenantContext,
    private readonly analytics: AnalyticsService,
    private readonly email: EmailAdapter,
    private readonly config: ConfigService,
    // Present only while the pilot's portal-managed sign-in is switched on (ADR-006).
    // Without it the invitation still stands; there is simply no password to set.
    @Optional() private readonly localAuth?: LocalAuthService,
  ) {}

  /** Customer administration is internal-only; an impersonating session never writes. */
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

  async list(query: CustomerQuery): Promise<CustomerListDto> {
    this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_READ);

    const where: Prisma.CustomerGroupWhereInput = {
      ...(query.status === 'all' ? {} : { status: query.status as CustomerStatus }),
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.repository.runInternal(async (tx) => {
      const [records, total] = await Promise.all([
        tx.customerGroup.findMany({
          where,
          include: customerInclude,
          orderBy: [{ name: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.customerGroup.count({ where }),
      ]);

      const summaries = await Promise.all(records.map((record) => this.summary(tx, record)));
      // Filtered after mapping because "blocked" is derived, not stored. Safe at
      // this scale; if the customer count ever justifies it, store the flag.
      const items = query.blocked === undefined ? summaries : summaries.filter((item) => item.blocked === query.blocked);

      return { items, total, page: query.page, pageSize: query.pageSize };
    });
  }

  async detail(id: string): Promise<CustomerDetailDto> {
    this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_READ);
    return this.repository.runInternal((tx) => this.detailInternal(tx, id));
  }

  async create(input: CustomerCreate): Promise<CustomerDetailDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      if (input.parentId) await this.requireCustomer(tx, input.parentId, 'Parent customer not found.');

      const created = await tx.customerGroup
        .create({
          data: {
            name: input.name,
            legalName: input.legalName,
            slug: input.slug,
            countryCode: input.countryCode,
            tier: input.tier,
            emailDomains: input.emailDomains,
            parentId: input.parentId,
            defaultServicingBranchId: input.defaultServicingBranchId,
          },
        })
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'That short name is already in use.', details: { code: 'SLUG_TAKEN' } });
          }
          throw error;
        });

      await this.audit(tx, actor, 'customer.created', created.id, {
        name: created.name,
        slug: created.slug,
        reason: input.reason,
      });
      this.track('customer.created', created.id);
      return this.detailInternal(tx, created.id);
    });
  }

  async update(id: string, input: CustomerUpdate): Promise<CustomerDetailDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      const before = await this.requireCustomer(tx, id);
      this.requireFresh(before.updatedAt, input.updatedAt);

      if (input.parentId) {
        if (input.parentId === id) {
          throw new BadRequestException({ message: 'A customer cannot be its own parent.', details: { code: 'SELF_PARENT' } });
        }
        await this.requireCustomer(tx, input.parentId, 'Parent customer not found.');
        await this.refuseHierarchyCycle(tx, id, input.parentId);
      }

      await tx.customerGroup.update({
        where: { id },
        data: {
          name: input.name,
          legalName: input.legalName,
          countryCode: input.countryCode,
          tier: input.tier,
          emailDomains: input.emailDomains,
          parentId: input.parentId,
          defaultServicingBranchId: input.defaultServicingBranchId,
        },
      });

      await this.audit(tx, actor, 'customer.updated', id, {
        before: { name: before.name, tier: before.tier, parentId: before.parentId, emailDomains: before.emailDomains },
        after: { name: input.name, tier: input.tier, parentId: input.parentId, emailDomains: input.emailDomains },
        reason: input.reason,
      });
      this.track('customer.updated', id);
      return this.detailInternal(tx, id);
    });
  }

  /**
   * CO-D01: going live is refused, not warned, when the customer would be unusable.
   * The refusal names exactly what is missing so it is one click to fix.
   */
  async changeStatus(id: string, target: CustomerStatus, input: CustomerStatusChange): Promise<CustomerDetailDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      const before = await this.requireCustomer(tx, id);
      this.requireFresh(before.updatedAt, input.updatedAt);

      if (before.status === target) {
        throw new ConflictException({
          message: `This customer is already ${target}.`,
          details: { code: 'STATUS_UNCHANGED' },
        });
      }
      if (!canTransition(before.status, target)) {
        throw new ConflictException({
          message: `A ${before.status} customer cannot become ${target}.`,
          details: { code: 'TRANSITION_NOT_ALLOWED', from: before.status, to: target },
        });
      }

      if (target === 'active' && before.status !== 'suspended') {
        const readiness = goLiveReadiness(await this.goLiveFacts(tx, id));
        if (!readiness.ready) {
          throw new ConflictException({
            message: `Not ready to go live. Still needs ${readiness.missing.join(' and ')}.`,
            details: { code: 'NOT_READY_TO_GO_LIVE', missing: readiness.missing },
          });
        }
      }

      await tx.customerGroup.update({
        where: { id },
        data: {
          status: target,
          // The legacy flag stays consistent so nothing reading it drifts from status.
          isActive: target === 'active',
        },
      });

      // CO-D02: closing releases the organisation codes. Without this a departed
      // customer locks its codes forever against the one-code-one-customer index
      // and nobody can work out why a new link is refused.
      let released = 0;
      if (target === 'closed') {
        const links = await tx.customerAccount.findMany({ where: { customerGroupId: id }, select: { id: true, cw1OrgCode: true } });
        released = links.length;
        await tx.customerAccount.deleteMany({ where: { customerGroupId: id } });
        await tx.user.updateMany({ where: { customerGroupId: id }, data: { status: 'disabled' } });
        await this.audit(tx, actor, 'customer.links.released', id, {
          codes: links.map((link) => link.cw1OrgCode),
          reason: input.reason,
        });
      }

      await this.audit(tx, actor, 'customer.status.changed', id, {
        before: before.status,
        after: target,
        releasedLinks: released,
        reason: input.reason,
      });
      this.track(`customer.${target}`, id);
      return this.detailInternal(tx, id);
    });
  }

  async discard(id: string, input: CustomerStatusChange): Promise<void> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    await this.repository.runInternal(async (tx) => {
      const before = await this.requireCustomer(tx, id);
      this.requireFresh(before.updatedAt, input.updatedAt);

      if (!DISCARDABLE_CUSTOMER_STATUSES.includes(before.status)) {
        throw new ConflictException({
          message: 'Only a customer that has never gone live can be discarded. Close it instead.',
          details: { code: 'NOT_DISCARDABLE' },
        });
      }
      if (before._count.users > 0) {
        throw new ConflictException({
          message: 'This customer has users. Close it instead of discarding it.',
          details: { code: 'HAS_USERS' },
        });
      }

      await this.audit(tx, actor, 'customer.discarded', id, { name: before.name, slug: before.slug, reason: input.reason });
      await tx.customerAccount.deleteMany({ where: { customerGroupId: id } });
      await tx.customerGroup.delete({ where: { id } });
      this.track('customer.discarded', id);
    });
  }

  // -------------------------------------------------------------------------
  // Organisations
  // -------------------------------------------------------------------------

  async searchDirectory(query: OrganisationSearch): Promise<DirectoryListDto> {
    this.authorize(PERMISSIONS.ADMIN_ORGANISATIONS_LINK);

    const where: Prisma.MasterOrgWhereInput = {
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.unlinkedOnly ? { accounts: { none: {} } } : {}),
      ...(query.search
        ? {
            OR: [
              { sourceCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { registrations: { some: { value: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    return this.repository.runInternal(async (tx) => {
      const [records, total] = await Promise.all([
        tx.masterOrg.findMany({
          where,
          include: { accounts: { select: { group: { select: { name: true } } }, take: 1 } },
          orderBy: [{ name: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.masterOrg.count({ where }),
      ]);

      const items: DirectoryOrganisationDto[] = records.map((record) => {
        const linkedCustomerName = record.accounts[0]?.group.name ?? null;
        return {
          id: record.id,
          sourceCode: record.sourceCode,
          sourceInstance: record.sourceInstance,
          name: record.name,
          category: record.category,
          countryCode: record.countryCode,
          city: record.city,
          isActive: record.isActive,
          isSourceConfirmed: record.isSourceConfirmed,
          sourceRoles: record.sourceRoles,
          linkedCustomerName,
          blockedReason: this.attachBlockedReason(record, linkedCustomerName),
        };
      });

      return { items, total, page: query.page, pageSize: query.pageSize };
    });
  }

  async attach(customerId: string, input: OrganisationLinkCreate): Promise<CustomerDetailDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_ORGANISATIONS_LINK, true);

    return this.repository.runInternal(async (tx) => {
      const customer = await this.requireCustomer(tx, customerId);
      if (customer.status === 'closed') {
        throw new ConflictException({ message: 'A closed customer cannot take new links.', details: { code: 'CUSTOMER_CLOSED' } });
      }

      const organisation = await tx.masterOrg.findUnique({
        where: { id: input.orgId },
        include: { accounts: { select: { group: { select: { name: true } } }, take: 1 } },
      });
      if (!organisation) throw new NotFoundException('Organisation not found.');

      const blocked = this.attachBlockedReason(organisation, organisation.accounts[0]?.group.name ?? null);
      if (blocked) {
        throw new ConflictException({ message: blocked, details: { code: 'NOT_ELIGIBLE' } });
      }

      if (input.servicingBranchId) {
        await this.requireUsableBranch(tx, input.servicingBranchId);
      }

      const link = await tx.customerAccount
        .create({
          data: {
            customerGroupId: customerId,
            orgId: organisation.id,
            name: organisation.name,
            cw1OrgCode: organisation.sourceCode,
            countryCode: organisation.countryCode,
            servicingBranchId: input.servicingBranchId,
            justification: input.reason,
            linkedByUserId: actor.userId,
            linkedAt: new Date(),
          },
        })
        .catch((error: unknown) => {
          // The unique index is the real guard; this races cleanly against it.
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({
              message: 'That organisation code already belongs to another customer.',
              details: { code: 'CODE_TAKEN' },
            });
          }
          throw error;
        });

      await this.audit(tx, actor, 'customer.organisation.linked', customerId, {
        accountId: link.id,
        orgCode: organisation.sourceCode,
        sourceInstance: organisation.sourceInstance,
        servicingBranchId: input.servicingBranchId,
        reason: input.reason,
      });
      this.track('customer.organisation.linked', customerId);
      return this.detailInternal(tx, customerId);
    });
  }

  async detach(customerId: string, accountId: string, input: OrganisationLinkRemove): Promise<CustomerDetailDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_ORGANISATIONS_LINK, true);

    return this.repository.runInternal(async (tx) => {
      await this.requireCustomer(tx, customerId);
      const link = await tx.customerAccount.findFirst({ where: { id: accountId, customerGroupId: customerId } });
      if (!link) throw new NotFoundException('Link not found.');

      await tx.customerAccount.delete({ where: { id: accountId } });
      await this.audit(tx, actor, 'customer.organisation.unlinked', customerId, {
        accountId,
        orgCode: link.cw1OrgCode,
        reason: input.reason,
      });
      this.track('customer.organisation.unlinked', customerId);
      return this.detailInternal(tx, customerId);
    });
  }

  /** Moves one link to another Noatum office, or back to the customer default. */
  async setLinkServicing(
    customerId: string,
    accountId: string,
    input: OrganisationLinkServicing,
  ): Promise<CustomerDetailDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_ORGANISATIONS_LINK, true);

    return this.repository.runInternal(async (tx) => {
      await this.requireCustomer(tx, customerId);
      const link = await tx.customerAccount.findFirst({
        where: { id: accountId, customerGroupId: customerId },
        include: { servicingBranch: { select: { code: true } } },
      });
      if (!link) throw new NotFoundException('Link not found.');

      await this.requireUsableBranch(tx, input.servicingBranchId);

      const after = await tx.customerAccount.update({
        where: { id: accountId },
        data: { servicingBranchId: input.servicingBranchId },
        include: { servicingBranch: { select: { code: true } } },
      });

      await this.audit(tx, actor, 'customer.organisation.servicing.changed', customerId, {
        accountId,
        orgCode: link.cw1OrgCode,
        before: link.servicingBranch?.code ?? null,
        after: after.servicingBranch?.code ?? null,
        reason: input.reason,
      });
      this.track('customer.organisation.servicing.changed', customerId);
      return this.detailInternal(tx, customerId);
    });
  }

  /** A servicing office must exist and still be open before anything points at it. */
  private async requireUsableBranch(tx: TenantClient, branchId: string | null): Promise<void> {
    if (!branchId) return;
    const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { isActive: true } });
    if (!branch) throw new NotFoundException('Servicing office not found.');
    if (!branch.isActive) {
      throw new ConflictException({
        message: 'That servicing office is no longer active.',
        details: { code: 'BRANCH_INACTIVE' },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Users and what they may see
  // -------------------------------------------------------------------------

  /**
   * The people inside one customer, with the organisations each may see.
   *
   * `user_account_access` is a RESTRICTION table: no rows means the user sees
   * every linked organisation. That inversion is easy to misread, so it is
   * translated here into an explicit `seesAllOrganisations` flag rather than
   * left for each caller to remember.
   */
  async users(customerId: string, query: CustomerUserQuery): Promise<CustomerUserListDto> {
    this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_READ);

    return this.repository.runInternal(async (tx) => {
      await this.requireCustomer(tx, customerId);
      return this.usersInternal(tx, customerId, query);
    });
  }

  private async usersInternal(tx: TenantClient, customerId: string, query: CustomerUserQuery): Promise<CustomerUserListDto> {
    const where: Prisma.UserWhereInput = {
      customerGroupId: customerId,
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      tx.user.findMany({
        where,
        include: { accounts: { select: { accountId: true } } },
        orderBy: [{ displayName: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      tx.user.count({ where }),
    ]);

    const security = this.localAuth
      ? await this.localAuth.accountSecurity(records.map((record) => record.id))
      : null;

    return {
      items: records.map((record) => ({
        id: record.id,
        displayName: record.displayName,
        email: record.email,
        status: record.status,
        lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
        seesAllOrganisations: record.accounts.length === 0,
        accountIds: record.accounts.map((entry) => entry.accountId),
        security: security?.get(record.id) ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async updateUserAccess(customerId: string, userId: string, input: UserAccessUpdate): Promise<CustomerUserListDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    return this.repository.runInternal(async (tx) => {
      await this.requireCustomer(tx, customerId);

      const user = await tx.user.findFirst({
        where: { id: userId, customerGroupId: customerId },
        include: { accounts: { select: { accountId: true } } },
      });
      if (!user) throw new NotFoundException('User not found for this customer.');

      if (input.scope === 'selected') {
        // Every account must belong to this customer, or the restriction would
        // quietly point at another tenant's link.
        const owned = await tx.customerAccount.count({
          where: { customerGroupId: customerId, id: { in: input.accountIds } },
        });
        if (owned !== new Set(input.accountIds).size) {
          throw new ConflictException({
            message: 'One of those organisations does not belong to this customer.',
            details: { code: 'ACCOUNT_NOT_IN_CUSTOMER' },
          });
        }
      }

      await tx.userAccountAccess.deleteMany({ where: { userId } });
      if (input.scope === 'selected') {
        await tx.userAccountAccess.createMany({
          data: [...new Set(input.accountIds)].map((accountId) => ({ userId, accountId })),
        });
      }

      await this.audit(tx, actor, 'customer.user.access.changed', customerId, {
        userId,
        before: user.accounts.length === 0 ? 'all' : user.accounts.map((entry) => entry.accountId),
        after: input.scope === 'all' ? 'all' : input.accountIds,
        reason: input.reason,
      });
      this.track('customer.user.access.changed', customerId);

      return this.usersInternal(tx, customerId, { page: 1, pageSize: 25 });
    });
  }

  // -------------------------------------------------------------------------

  /** The rules the attach screen shows and the attach endpoint enforces. */
  private attachBlockedReason(
    organisation: { isSourceConfirmed: boolean; isActive: boolean },
    linkedCustomerName: string | null,
  ): string | null {
    if (linkedCustomerName) return `Already linked to ${linkedCustomerName}.`;
    if (!organisation.isSourceConfirmed) return 'Not yet confirmed by a source run.';
    if (!organisation.isActive) return 'Inactive in CargoWise.';
    return null;
  }

  private async goLiveFacts(tx: TenantClient, id: string) {
    // Both counts are restricted to people holding the customer administrator role.
    // Counting any user meant an ordinary colleague satisfied the go-live check, so a
    // customer could be set live with nobody able to manage it.
    const administrator = { roles: { some: { role: { key: ROLES.CUSTOMER_ADMIN } } } };
    const [linkedOrganisations, invitedAdministrators, acceptedAdministrators, group] = await Promise.all([
      tx.customerAccount.count({ where: { customerGroupId: id, isActive: true } }),
      tx.user.count({
        where: { customerGroupId: id, status: { in: ['invited', 'registered', 'active'] }, ...administrator },
      }),
      tx.user.count({ where: { customerGroupId: id, status: 'active', ...administrator } }),
      tx.customerGroup.findUnique({ where: { id }, select: { defaultServicingBranchId: true } }),
    ]);
    return {
      linkedOrganisations,
      invitedAdministrators,
      acceptedAdministrators,
      hasServicingBranch: group?.defaultServicingBranchId != null,
    };
  }

  private tasks(
    record: CustomerRecord,
    facts: { linkedOrganisations: number; invitedAdministrators: number; acceptedAdministrators: number },
    missing: string[],
  ): CustomerTaskDto[] {
    const identity = record.name.trim().length > 0 && record.countryCode !== null && record.emailDomains.length > 0;
    return [
      { key: 'identity', done: identity, blockedReason: identity ? null : 'Country and at least one email domain are needed.' },
      { key: 'entitlements', done: true, blockedReason: null },
      {
        key: 'organisations',
        done: facts.linkedOrganisations > 0,
        blockedReason: facts.linkedOrganisations > 0 ? null : 'No organisation is linked yet.',
      },
      {
        key: 'servicing',
        done: record.defaultServicingBranchId !== null,
        blockedReason: record.defaultServicingBranchId ? null : 'No default servicing office chosen.',
      },
      {
        key: 'administrator',
        done: facts.acceptedAdministrators > 0,
        blockedReason:
          facts.acceptedAdministrators > 0
            ? null
            : facts.invitedAdministrators > 0
              ? 'Invited, not yet accepted.'
              : 'Nobody has been invited yet.',
      },
      {
        key: 'go_live',
        done: record.status === 'active',
        blockedReason: record.status === 'active' ? null : missing.length ? `Still needs ${missing.join(' and ')}.` : 'Ready to go live.',
      },
    ];
  }

  private async summary(tx: TenantClient, record: CustomerRecord) {
    const facts = await this.goLiveFacts(tx, record.id);
    const readiness = goLiveReadiness(facts);
    return {
      id: record.id,
      name: record.name,
      legalName: record.legalName,
      slug: record.slug,
      status: record.status,
      tier: record.tier,
      countryCode: record.countryCode,
      parentName: record.parent?.name ?? null,
      linkedOrganisations: facts.linkedOrganisations,
      users: record._count.users,
      blocked: record.status !== 'active' && !readiness.ready,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private async detailInternal(tx: TenantClient, id: string): Promise<CustomerDetailDto> {
    const record = await tx.customerGroup.findUnique({ where: { id }, include: customerInclude });
    if (!record) throw new NotFoundException('Customer not found.');

    const facts = await this.goLiveFacts(tx, id);
    const readiness = goLiveReadiness(facts);
    const accounts = await tx.customerAccount.findMany({
      where: { customerGroupId: id },
      include: {
        org: { select: { isActive: true, city: true, _count: { select: { addresses: true } } } },
        servicingBranch: { select: { code: true } },
      },
      orderBy: [{ cw1OrgCode: 'asc' }],
    });

    const defaultBranchCode = record.defaultServicingBranch?.code ?? null;

    const links: CustomerLinkDto[] = accounts.map((account) => {
      const own = account.servicingBranch?.code ?? null;
      return {
        id: account.id,
        orgId: account.orgId ?? '',
        sourceCode: account.cw1OrgCode,
        name: account.name,
        countryCode: account.countryCode,
        city: account.org?.city ?? null,
        sourceActive: account.org?.isActive ?? true,
        isActive: account.isActive,
        justification: account.justification,
        linkedAt: account.linkedAt?.toISOString() ?? null,
        servicingBranchCode: own,
        effectiveServicingBranchCode: own ?? defaultBranchCode,
        servicingInherited: own === null && defaultBranchCode !== null,
        addresses: account.org?._count.addresses ?? 0,
      };
    });

    return {
      ...(await this.summary(tx, record)),
      emailDomains: record.emailDomains,
      parentId: record.parentId,
      defaultServicingBranchId: record.defaultServicingBranchId,
      defaultServicingBranchCode: defaultBranchCode,
      tasks: this.tasks(record, facts, readiness.missing),
      links,
      goLiveMissing: readiness.missing,
      allowedTransitions: [...CUSTOMER_TRANSITIONS[record.status]],
    };
  }

  private async requireCustomer(tx: TenantClient, id: string, message = 'Customer not found.') {
    const record = await tx.customerGroup.findUnique({ where: { id }, include: customerInclude });
    if (!record) throw new NotFoundException(message);
    return record;
  }

  private requireFresh(current: Date, supplied: string) {
    if (current.toISOString() !== supplied) {
      throw new ConflictException({
        message: 'Someone else changed this customer. Reload and try again.',
        details: { code: 'STALE_CUSTOMER' },
      });
    }
  }

  /** A hierarchy that loops would make descendant queries run forever. */
  private async refuseHierarchyCycle(tx: TenantClient, id: string, parentId: string) {
    let cursor: string | null = parentId;
    for (let depth = 0; cursor && depth < 100; depth += 1) {
      if (cursor === id) {
        throw new BadRequestException({
          message: 'That parent is already below this customer.',
          details: { code: 'HIERARCHY_CYCLE' },
        });
      }
      const next: { parentId: string | null } | null = await tx.customerGroup.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = next?.parentId ?? null;
    }
  }

  // -------------------------------------------------------------------------
  // The first administrator
  // -------------------------------------------------------------------------

  async invitations(customerId: string): Promise<InvitationDto[]> {
    this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_READ);

    return this.repository.runInternal(async (tx) => {
      await this.requireCustomer(tx, customerId);
      const records = await tx.invitation.findMany({
        where: { customerGroupId: customerId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return records.map((record) => ({
        id: record.id,
        email: record.email,
        status: record.status,
        expiresAt: record.expiresAt.toISOString(),
        acceptedAt: record.acceptedAt?.toISOString() ?? null,
        invitedByName: null,
        createdAt: record.createdAt.toISOString(),
        emailStatus: 'not-configured',
        // Never re-issued: the raw token was shown once and only its hash is kept.
        inviteLink: null,
      }));
    });
  }

  /**
   * Invites one person as the customer's first administrator.
   *
   * The invitation record and the user row are created together; sending the email is
   * a separate, best-effort step that must never roll back the invitation. While no
   * transport is configured the link is returned once so staff can pass it on — which
   * is honest, and keeps go-live unblocked.
   */
  async inviteAdministrator(customerId: string, input: InviteAdministrator): Promise<InvitationDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    const { invitation, token, customerName, inviteeId } = await this.repository.runInternal(async (tx) => {
      const customer = await this.requireCustomer(tx, customerId);

      if (customer.status === 'closed') {
        throw new ConflictException({
          message: 'This customer is closed, so nobody can be invited to it.',
          details: { code: 'CUSTOMER_CLOSED' },
        });
      }

      const domain = input.email.split('@')[1] ?? '';
      const allowed = customer.emailDomains.length === 0 || customer.emailDomains.includes(domain);
      if (!allowed && !input.domainOverrideReason) {
        throw new ConflictException({
          message: `${domain} is not one of this customer's email domains. Give a reason to invite anyway.`,
          details: { code: 'DOMAIN_NOT_ALLOWED', domain },
        });
      }

      const existingUser = await tx.user.findFirst({ where: { email: input.email } });
      if (existingUser && existingUser.customerGroupId !== customerId) {
        throw new ConflictException({
          message: 'That email address already belongs to someone on another customer.',
          details: { code: 'EMAIL_TAKEN' },
        });
      }

      const pending = await tx.invitation.findFirst({
        where: { customerGroupId: customerId, email: input.email, status: 'pending' },
      });
      if (pending) {
        throw new ConflictException({
          message: 'That person already has an invitation waiting. Revoke it before sending another.',
          details: { code: 'INVITATION_PENDING' },
        });
      }

      const { token: raw, tokenHash } = createInvitationToken();
      const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

      const created = await tx.invitation.create({
        data: {
          customerGroupId: customerId,
          email: input.email,
          tokenHash,
          expiresAt,
          invitedById: actor.userId,
        },
      });

      // The user exists as 'invited' from this moment, which is what the go-live
      // check counts. Acceptance binds an identity to it; it does not create it.
      const invitee =
        existingUser ??
        (await tx.user.create({
          data: {
            customerGroupId: customerId,
            email: input.email,
            displayName: input.displayName,
            status: 'invited',
          },
        }));

      await this.audit(tx, actor, 'customer.administrator.invited', customerId, {
        email: input.email,
        displayName: input.displayName,
        expiresAt: expiresAt.toISOString(),
        domainOverrideReason: input.domainOverrideReason,
        reason: input.reason,
      });

      return { invitation: created, token: raw, customerName: customer.name, inviteeId: invitee.id };
    });

    // Same token, so one link both accepts the invitation and sets the password.
    await this.localAuth?.issueActivationChallenge({
      userId: inviteeId,
      invitationId: invitation.id,
      tokenHash: invitation.tokenHash,
      expiresAt: invitation.expiresAt,
    });

    this.track('customer.administrator.invited', customerId);

    const delivery = await this.sendInvitationEmail(input, token, customerName, actor.correlationId);

    return {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: null,
      invitedByName: null,
      createdAt: invitation.createdAt.toISOString(),
      emailStatus: delivery.status,
      inviteLink: delivery.status === 'sent' ? null : this.invitationLink(token),
    };
  }

  // ------------------------------------------------- administrative account control

  /** Sends someone a link to set a new password. Never reveals or resets it for them. */
  async sendPasswordReset(
    customerId: string,
    userId: string,
    input: AccountAction,
  ): Promise<AccountActionResultDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);
    const localAuth = this.requireLocalAuth();

    const user = await this.repository.runInternal(async (tx) => {
      const found = await this.requireCustomerUser(tx, customerId, userId);
      await this.audit(tx, actor, 'customer.user.password_reset_sent', customerId, {
        userId,
        email: found.email,
        reason: input.reason,
      });
      return found;
    });

    const issued = await localAuth.issuePasswordResetFor({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    });

    this.track('customer.user.password_reset_sent', customerId);
    return { changed: true, emailStatus: issued.emailStatus, link: issued.link };
  }

  /**
   * Blocks or restores one person's password. Blocking also ends their sessions and
   * cancels any unspent link, so it takes effect at once rather than at next sign-in.
   */
  async setCredentialDisabled(
    customerId: string,
    userId: string,
    disabled: boolean,
    input: AccountAction,
  ): Promise<AccountActionResultDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);
    const localAuth = this.requireLocalAuth();

    const user = await this.repository.runInternal(async (tx) => {
      const found = await this.requireCustomerUser(tx, customerId, userId);
      await this.audit(
        tx,
        actor,
        disabled ? 'customer.user.sign_in_blocked' : 'customer.user.sign_in_restored',
        customerId,
        { userId, email: found.email, reason: input.reason },
      );
      return found;
    });

    const changed = disabled
      ? await localAuth.disableCredential(user.id)
      : await localAuth.enableCredential(user.id);

    this.track(disabled ? 'customer.user.sign_in_blocked' : 'customer.user.sign_in_restored', customerId);
    return { changed, emailStatus: null, link: null };
  }

  /** For a lost phone: clears the factor and its recovery codes, and ends every session. */
  async resetUserMfa(
    customerId: string,
    userId: string,
    input: AccountAction,
  ): Promise<AccountActionResultDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);
    const localAuth = this.requireLocalAuth();

    const user = await this.repository.runInternal(async (tx) => {
      const found = await this.requireCustomerUser(tx, customerId, userId);
      await this.audit(tx, actor, 'customer.user.mfa_reset', customerId, {
        userId,
        email: found.email,
        reason: input.reason,
      });
      return found;
    });

    const changed = await localAuth.resetMfaFor(user.id);
    this.track('customer.user.mfa_reset', customerId);
    return { changed, emailStatus: null, link: null };
  }

  /** Withdraws an invitation that has not been accepted, and kills its link. */
  async revokeInvitation(
    customerId: string,
    invitationId: string,
    input: AccountAction,
  ): Promise<InvitationDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);

    const { invitation, userId } = await this.repository.runInternal(async (tx) => {
      await this.requireCustomer(tx, customerId);
      const found = await this.requirePendingInvitation(tx, customerId, invitationId);

      const updated = await tx.invitation.update({
        where: { id: found.id },
        data: { status: 'revoked' },
      });
      const user = await tx.user.findFirst({ where: { customerGroupId: customerId, email: found.email } });

      await this.audit(tx, actor, 'customer.invitation.revoked', customerId, {
        invitationId,
        email: found.email,
        reason: input.reason,
      });
      return { invitation: updated, userId: user?.id ?? null };
    });

    if (userId) await this.localAuth?.cancelActivation(userId);

    this.track('customer.invitation.revoked', customerId);
    return this.toInvitationDto(invitation, 'not-configured', null);
  }

  /**
   * Issues a fresh link for an invitation nobody has acted on. The previous link stops
   * working, which is the point: a link that has been sitting in a mailbox for a week
   * is the one you least want still valid.
   */
  async resendInvitation(
    customerId: string,
    invitationId: string,
    input: AccountAction,
  ): Promise<InvitationDto> {
    const actor = this.authorize(PERMISSIONS.ADMIN_CUSTOMERS_MANAGE, true);
    const localAuth = this.requireLocalAuth();

    const { invitation, token, customerName, user } = await this.repository.runInternal(async (tx) => {
      const customer = await this.requireCustomer(tx, customerId);
      const found = await this.requirePendingInvitation(tx, customerId, invitationId);

      const { token: raw, tokenHash } = createInvitationToken();
      const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

      const updated = await tx.invitation.update({
        where: { id: found.id },
        data: { tokenHash, expiresAt },
      });

      const invitee = await tx.user.findFirst({
        where: { customerGroupId: customerId, email: found.email },
      });
      if (!invitee) throw new NotFoundException('The invited user no longer exists.');

      await this.audit(tx, actor, 'customer.invitation.resent', customerId, {
        invitationId,
        email: found.email,
        expiresAt: expiresAt.toISOString(),
        reason: input.reason,
      });

      return { invitation: updated, token: raw, customerName: customer.name, user: invitee };
    });

    await localAuth.reissueActivation({
      userId: user.id,
      invitationId: invitation.id,
      tokenHash: invitation.tokenHash,
      expiresAt: invitation.expiresAt,
    });

    const link = localAuth.activationLink(token);
    const emailStatus = await localAuth.sendActivationEmail({
      email: user.email,
      displayName: user.displayName,
      customerName,
      link,
    });

    this.track('customer.invitation.resent', customerId);
    return this.toInvitationDto(invitation, emailStatus, emailStatus === 'sent' ? null : link);
  }

  private requireLocalAuth(): LocalAuthService {
    if (!this.localAuth) {
      throw new ConflictException({
        message: 'Portal sign-in is switched off, so there is no password to manage.',
        details: { code: 'LOCAL_AUTH_DISABLED' },
      });
    }
    return this.localAuth;
  }

  private async requireCustomerUser(tx: TenantClient, customerId: string, userId: string) {
    const user = await tx.user.findFirst({ where: { id: userId, customerGroupId: customerId } });
    if (!user) throw new NotFoundException('User not found for this customer.');
    return user;
  }

  private async requirePendingInvitation(tx: TenantClient, customerId: string, invitationId: string) {
    const invitation = await tx.invitation.findFirst({
      where: { id: invitationId, customerGroupId: customerId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found for this customer.');
    if (invitation.status !== 'pending') {
      throw new ConflictException({
        message: `That invitation is already ${invitation.status}.`,
        details: { code: 'INVITATION_NOT_PENDING', status: invitation.status },
      });
    }
    return invitation;
  }

  private toInvitationDto(
    invitation: { id: string; email: string; status: string; expiresAt: Date; acceptedAt: Date | null; createdAt: Date },
    emailStatus: string,
    link: string | null,
  ): InvitationDto {
    return {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      invitedByName: null,
      createdAt: invitation.createdAt.toISOString(),
      emailStatus,
      inviteLink: link,
    };
  }

  private invitationLink(token: string): string {
    const base = (this.config.get<string>('email.portalBaseUrl') ?? '').replace(/\/+$/, '');
    return `${base || ''}/invitation/${token}`;
  }

  /** Best effort by design: a transport problem must not undo the invitation. */
  private async sendInvitationEmail(
    input: InviteAdministrator,
    token: string,
    customerName: string,
    correlationId?: string,
  ) {
    try {
      return await this.email.send({
        to: [{ address: input.email, displayName: input.displayName }],
        subject: `Your access to the Noatum Logistics customer portal`,
        text: [
          `Hello ${input.displayName},`,
          '',
          `You have been invited to administer ${customerName} on the Noatum Logistics customer portal.`,
          '',
          `Accept the invitation here: ${this.invitationLink(token)}`,
          '',
          `The link can be used once and expires in ${INVITATION_TTL_DAYS} days.`,
          '',
          'Noatum Logistics',
        ].join('\n'),
        correlationId,
      });
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'unknown' }, 'Invitation email failed');
      return { status: 'failed' as const, providerMessageId: null };
    }
  }

  private async audit(
    tx: TenantClient,
    actor: { userId?: string; correlationId?: string; onBehalfOfUserId?: string | null },
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await tx.auditEvent.create({
      data: {
        // Every call here audits a customer_group, and entityId IS that customer. Without
        // this the row is written with a null customer and RLS hides it from the very
        // Customer Admin whose history it is.
        customerGroupId: entityId,
        actorUserId: actor.userId,
        onBehalfOfId: actor.onBehalfOfUserId ?? null,
        action,
        entityType: 'customer_group',
        entityId,
        metadata: { ...metadata, correlationId: actor.correlationId } as Prisma.InputJsonValue,
      },
    });
  }

  private track(action: string, entityId?: string) {
    const actor = this.context.require();
    this.logger.log({ event: 'AnalyticsEvent', action, actorUserId: actor.userId, entityId, correlationId: actor.correlationId });
    void this.analytics.record({ action, entityType: 'customer', entityId });
  }
}
