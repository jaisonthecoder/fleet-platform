import { analyticsFor } from '../fixtures/analytics.fixture';
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import type { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { TenantResolverService } from '../../src/integration/tenant-resolver/tenant-resolver.service';
import { CustomersRepository } from '../../src/modules/customers/customers.repository';
import { CustomersService } from '../../src/modules/customers/customers.service';

/**
 * CO-1 and CO-2 against a real database: the lifecycle guard, the attach rules,
 * and the gate that makes a customer which has not gone live grant nothing.
 */
describe('customer onboarding on the disposable database', () => {
  let database: PrismaClient;
  let owner: PrismaClient;
  let service: CustomersService;
  let resolver: TenantResolverService;
  let instance: string;
  const context = new TenantContext();

  const STAFF_ID = '7c9e1a44-0000-4000-8000-0000000000c0';

  const staff = (): TenantContextData => ({
    userId: STAFF_ID,
    customerGroupId: null,
    isInternal: true,
    accountIds: [],
    permissions: new Set([
      PERMISSIONS.ADMIN_CUSTOMERS_READ,
      PERMISSIONS.ADMIN_CUSTOMERS_MANAGE,
      PERMISSIONS.ADMIN_ORGANISATIONS_LINK,
    ]),
    correlationId: `co-${randomUUID()}`,
  });

  beforeAll(async () => {
    database = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }),
    });
    owner = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 }),
    });
    await database.$connect();
    await owner.$connect();

    // customer_account.linked_by_user_id is a real foreign key, so the person
    // doing the linking has to exist.
    await owner.user.upsert({
      where: { id: STAFF_ID },
      update: {},
      create: {
        id: STAFF_ID,
        email: 'co-test-staff@example.test',
        displayName: 'Onboarding test staff',
        isInternal: true,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    const repository = new CustomersRepository(database as PrismaService, context);
    // No transport is configured in test, which is exactly the production default
    // today: the invitation must still be created and the link returned.
    const email = {
      isConfigured: () => false,
      send: async () => ({ status: 'not-configured' as const, providerMessageId: null }),
    } as never;
    const config = { get: () => 'http://localhost:45173' } as never;
    service = new CustomersService(repository, context, analyticsFor(repository, context), email, config);
    resolver = new TenantResolverService(repository, context);
  });

  beforeEach(() => { instance = `CO-${randomUUID().slice(0, 8)}`; });

  afterEach(async () => {
    await owner.$executeRaw`DELETE FROM customer_group WHERE slug LIKE 'co-test-%'`;
    await owner.$executeRaw`DELETE FROM master_org WHERE source_instance LIKE 'CO-%'`;
    await owner.$executeRaw`DELETE FROM org_import_run WHERE source_instance LIKE 'CO-%'`;
  });

  afterAll(async () => {
    await owner?.user.deleteMany({ where: { id: STAFF_ID } });
    await database?.$disconnect();
    await owner?.$disconnect();
  });

  /** Puts an organisation in the directory through the validated write path. */
  async function seedOrganisation(code: string, options: { confirmed?: boolean; active?: boolean } = {}) {
    const kind = options.confirmed === false ? 'manual' : 'file';
    const [run] = await owner.$queryRaw<{ id: string }[]>`
      INSERT INTO org_import_run (source_kind, source_instance, mode)
      VALUES (${kind}::org_source_kind, ${instance}, 'delta') RETURNING id`;
    await owner.$queryRaw`
      SELECT app.apply_organisation_batch(${run!.id}::uuid, ${JSON.stringify([
        { sourceCode: code, name: `${code} Trading SA`, countryCode: 'ES', city: 'Madrid' },
      ])}::jsonb)`;
    if (options.active === false) {
      await owner.$executeRaw`UPDATE master_org SET is_active = false WHERE source_instance = ${instance} AND code_norm = lower(${code})`;
    }
    const [row] = await owner.$queryRaw<{ id: string }[]>`
      SELECT id FROM master_org WHERE source_instance = ${instance} AND code_norm = lower(${code})`;
    return row!.id;
  }

  function createCustomer(name = 'Test Customer') {
    return context.run(staff(), () =>
      service.create({
        name,
        legalName: null,
        slug: `co-test-${randomUUID().slice(0, 8)}`,
        countryCode: 'ES',
        tier: 'standard',
        emailDomains: ['test.example'],
        parentId: null,
        defaultServicingBranchId: null,
        reason: 'Isolation test',
      }),
    );
  }

  // Go-live counts holders of the customer administrator role, not any user, so the
  // fixture has to grant it. Before 18.09.2026 an ordinary colleague satisfied the
  // check and a customer could go live with nobody able to manage it.
  const inviteAdmin = async (customerId: string) => {
    const role = await owner.role.findFirst({ where: { key: 'customer_admin' } });
    if (!role) throw new Error('customer_admin role is not seeded');

    return owner.user.create({
      data: {
        customerGroupId: customerId,
        email: `co-${randomUUID()}@test.example`,
        displayName: 'Test administrator',
        status: 'invited',
        roles: { create: { roleId: role.id } },
      },
    });
  };

  /**
   * Going live needs one, because the pricing queue routes a request through it.
   * A customer without one can submit a quote that appears in nobody's queue.
   */
  const giveServicingOffice = async (customerId: string) => {
    const office = await owner.branch.create({
      data: {
        code: `SO-${randomUUID().slice(0, 6)}`,
        name: 'Servicing office',
        isActive: true,
        source: 'manual',
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    await owner.customerGroup.update({
      where: { id: customerId },
      data: { defaultServicingBranchId: office.id },
    });
  };

  describe('the go-live guard', () => {
    it('starts a new customer in draft, granting nothing', async () => {
      const customer = await createCustomer();
      expect(customer.status).toBe('draft');
      expect(customer.linkedOrganisations).toBe(0);
      expect(customer.goLiveMissing).toEqual([
        'at least one linked organisation',
        'an invited administrator',
        'a default servicing office',
      ]);
    });

    it('refuses to go live and names what is missing', async () => {
      const customer = await createCustomer();
      await expect(
        context.run(staff(), () => service.changeStatus(customer.id, 'active', { updatedAt: customer.updatedAt, reason: 'Too early' })),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ details: expect.objectContaining({ code: 'NOT_READY_TO_GO_LIVE' }) }),
      });
    });

    /**
     * The servicing office is part of the gate, not just the checklist. Without
     * one the pricing queue resolves a request to no branch, so the customer can
     * submit a quote that appears in nobody's queue.
     */
    it('refuses to go live without a servicing office, even with the rest in place', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('GOLIVE02');
      await context.run(staff(), () =>
        service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Primary entity' }),
      );
      await inviteAdmin(customer.id);

      const fresh = await context.run(staff(), () => service.detail(customer.id));
      expect(fresh.goLiveMissing).toEqual(['a default servicing office']);

      await expect(
        context.run(staff(), () =>
          service.changeStatus(customer.id, 'active', { updatedAt: fresh.updatedAt, reason: 'Too early' }),
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ details: expect.objectContaining({ code: 'NOT_READY_TO_GO_LIVE' }) }),
      });
    });

    it('goes live once an organisation, an administrator and an office are in place', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('GOLIVE01');
      const attached = await context.run(staff(), () =>
        service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Primary entity' }),
      );
      await inviteAdmin(customer.id);
      await giveServicingOffice(customer.id);

      const fresh = await context.run(staff(), () => service.detail(customer.id));
      expect(fresh.goLiveMissing).toEqual([]);

      const live = await context.run(staff(), () =>
        service.changeStatus(customer.id, 'active', { updatedAt: fresh.updatedAt, reason: 'Onboarding complete' }),
      );
      expect(live.status).toBe('active');
      expect(attached.links).toHaveLength(1);
    });

    it('refuses a transition the lifecycle does not allow', async () => {
      const customer = await createCustomer();
      await expect(
        context.run(staff(), () => service.changeStatus(customer.id, 'suspended', { updatedAt: customer.updatedAt, reason: 'Not allowed' })),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ details: expect.objectContaining({ code: 'TRANSITION_NOT_ALLOWED' }) }),
      });
    });
  });

  describe('attaching organisations', () => {
    it('refuses a provisional organisation', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('PROV0001', { confirmed: false });
      await expect(
        context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Should fail' })),
      ).rejects.toMatchObject({ response: expect.objectContaining({ message: 'Not yet confirmed by a source run.' }) });
    });

    it('refuses an organisation that is inactive in CargoWise', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('DEAD0001', { active: false });
      await expect(
        context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Should fail' })),
      ).rejects.toMatchObject({ response: expect.objectContaining({ message: 'Inactive in CargoWise.' }) });
    });

    it('refuses an organisation another customer already holds', async () => {
      const first = await createCustomer('First Customer');
      const second = await createCustomer('Second Customer');
      const orgId = await seedOrganisation('SHARED01');

      await context.run(staff(), () => service.attach(first.id, { orgId, servicingBranchId: null, reason: 'Mine' }));
      await expect(
        context.run(staff(), () => service.attach(second.id, { orgId, servicingBranchId: null, reason: 'Also mine' })),
      ).rejects.toMatchObject({ response: expect.objectContaining({ details: expect.objectContaining({ code: 'NOT_ELIGIBLE' }) }) });
    });

    it('records who linked it and why', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('AUDIT001');
      const detail = await context.run(staff(), () =>
        service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Spanish trading entity' }),
      );
      expect(detail.links[0]).toMatchObject({ sourceCode: 'AUDIT001', justification: 'Spanish trading entity' });
      expect(detail.links[0]!.linkedAt).not.toBeNull();
    });

    it('detaches and leaves the organisation free for another customer', async () => {
      const first = await createCustomer('First Customer');
      const second = await createCustomer('Second Customer');
      const orgId = await seedOrganisation('MOVED001');

      const linked = await context.run(staff(), () => service.attach(first.id, { orgId, servicingBranchId: null, reason: 'Initially here' }));
      await context.run(staff(), () => service.detach(first.id, linked.links[0]!.id, { reason: 'Wrong customer' }));

      const moved = await context.run(staff(), () => service.attach(second.id, { orgId, servicingBranchId: null, reason: 'Correct customer' }));
      expect(moved.links).toHaveLength(1);
    });
  });

  describe('which office services a link', () => {
    const seedBranch = (code: string, isActive = true) =>
      owner.branch.create({
        data: { code, name: `${code} office`, isActive, source: 'manual', updatedAt: new Date() },
      });

    it('falls back to the customer default when the link names no office', async () => {
      const branch = await seedBranch(`SV-${randomUUID().slice(0, 6)}`);
      const customer = await context.run(staff(), () =>
        service.create({
          name: 'Default Serviced', legalName: null, slug: `co-test-${randomUUID().slice(0, 8)}`,
          countryCode: 'ES', tier: 'standard', emailDomains: ['test.example'], parentId: null,
          defaultServicingBranchId: branch.id, reason: 'Isolation test',
        }),
      );
      const orgId = await seedOrganisation('SERV001');

      const detail = await context.run(staff(), () =>
        service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Uses the default' }),
      );

      expect(detail.links[0]).toMatchObject({
        servicingBranchCode: null,
        effectiveServicingBranchCode: branch.code,
        servicingInherited: true,
      });
    });

    it('keeps the link office when one is named, and does not call it inherited', async () => {
      const fallback = await seedBranch(`SV-${randomUUID().slice(0, 6)}`);
      const own = await seedBranch(`SV-${randomUUID().slice(0, 6)}`);
      const customer = await context.run(staff(), () =>
        service.create({
          name: 'Explicit Serviced', legalName: null, slug: `co-test-${randomUUID().slice(0, 8)}`,
          countryCode: 'ES', tier: 'standard', emailDomains: ['test.example'], parentId: null,
          defaultServicingBranchId: fallback.id, reason: 'Isolation test',
        }),
      );
      const orgId = await seedOrganisation('SERV002');

      const detail = await context.run(staff(), () =>
        service.attach(customer.id, { orgId, servicingBranchId: own.id, reason: 'Serviced locally' }),
      );

      expect(detail.links[0]).toMatchObject({
        servicingBranchCode: own.code,
        effectiveServicingBranchCode: own.code,
        servicingInherited: false,
      });
    });

    it('reports no office when neither the link nor the customer names one', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('SERV003');

      const detail = await context.run(staff(), () =>
        service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'No office anywhere' }),
      );

      expect(detail.links[0]).toMatchObject({
        effectiveServicingBranchCode: null,
        servicingInherited: false,
      });
    });

    it('refuses an office that is no longer active', async () => {
      const retired = await seedBranch(`SV-${randomUUID().slice(0, 6)}`, false);
      const customer = await createCustomer();
      const orgId = await seedOrganisation('SERV004');

      await expect(
        context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: retired.id, reason: 'Closed office' })),
      ).rejects.toThrow(/no longer active/i);
    });

    it('refuses an office that does not exist', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('SERV005');

      await expect(
        context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: randomUUID(), reason: 'Invented office' })),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('the customer lifecycle is the access gate', () => {
    async function liveCustomerWithCode(code: string) {
      const customer = await createCustomer();
      const orgId = await seedOrganisation(code);
      await context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Linked' }));
      await inviteAdmin(customer.id);
      await giveServicingOffice(customer.id);
      const fresh = await context.run(staff(), () => service.detail(customer.id));
      await context.run(staff(), () => service.changeStatus(customer.id, 'active', { updatedAt: fresh.updatedAt, reason: 'Live' }));
      return customer.id;
    }

    const asCustomer = (customerGroupId: string): TenantContextData => ({
      userId: STAFF_ID,
      customerGroupId,
      isInternal: false,
      accountIds: [],
      permissions: new Set(),
      correlationId: `co-caller-${randomUUID()}`,
    });

    it('resolves org codes for a live customer', async () => {
      const customerId = await liveCustomerWithCode('LIVE0001');
      const codes = await context.run(asCustomer(customerId), () => resolver.orgCodesForCaller());
      expect(codes).toEqual(['LIVE0001']);
    });

    it('resolves nothing for a customer that has not gone live, even with a link', async () => {
      const customer = await createCustomer();
      const orgId = await seedOrganisation('DRAFT001');
      await context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Linked early' }));

      const codes = await context.run(asCustomer(customer.id), () => resolver.orgCodesForCaller());
      expect(codes).toEqual([]);
    });

    it('resolves nothing once the customer is suspended', async () => {
      const customerId = await liveCustomerWithCode('SUSP0001');
      const live = await context.run(staff(), () => service.detail(customerId));
      await context.run(staff(), () => service.changeStatus(customerId, 'suspended', { updatedAt: live.updatedAt, reason: 'Non-payment' }));

      const codes = await context.run(asCustomer(customerId), () => resolver.orgCodesForCaller());
      expect(codes).toEqual([]);
    });
  });

  describe('closing a customer', () => {
    it('releases the organisation codes so they can be linked elsewhere', async () => {
      const customer = await createCustomer('Departing Customer');
      const orgId = await seedOrganisation('RELEASE1');
      await context.run(staff(), () => service.attach(customer.id, { orgId, servicingBranchId: null, reason: 'Linked' }));
      await inviteAdmin(customer.id);
      await giveServicingOffice(customer.id);

      const ready = await context.run(staff(), () => service.detail(customer.id));
      await context.run(staff(), () => service.changeStatus(customer.id, 'active', { updatedAt: ready.updatedAt, reason: 'Live' }));
      const live = await context.run(staff(), () => service.detail(customer.id));
      const closed = await context.run(staff(), () =>
        service.changeStatus(customer.id, 'closed', { updatedAt: live.updatedAt, reason: 'Contract ended' }),
      );

      expect(closed.status).toBe('closed');
      expect(closed.links).toEqual([]);

      const replacement = await createCustomer('New Customer');
      const moved = await context.run(staff(), () =>
        service.attach(replacement.id, { orgId, servicingBranchId: null, reason: 'Took over the account' }),
      );
      expect(moved.links[0]!.sourceCode).toBe('RELEASE1');
    });
  });

  describe('concurrency', () => {
    it('refuses a stale edit rather than overwriting another editor', async () => {
      const customer = await createCustomer();
      await context.run(staff(), () =>
        service.update(customer.id, {
          name: 'Renamed once', legalName: null, countryCode: 'ES', tier: 'standard',
          emailDomains: ['test.example'], parentId: null, defaultServicingBranchId: null,
          updatedAt: customer.updatedAt, reason: 'First edit',
        }),
      );

      await expect(
        context.run(staff(), () =>
          service.update(customer.id, {
            name: 'Renamed twice', legalName: null, countryCode: 'ES', tier: 'standard',
            emailDomains: ['test.example'], parentId: null, defaultServicingBranchId: null,
            updatedAt: customer.updatedAt, reason: 'Stale edit',
          }),
        ),
      ).rejects.toMatchObject({ response: expect.objectContaining({ details: { code: 'STALE_CUSTOMER' } }) });
    });

    it('refuses a hierarchy that loops back on itself', async () => {
      const parent = await createCustomer('Parent');
      const child = await createCustomer('Child');

      await context.run(staff(), () =>
        service.update(child.id, {
          name: 'Child', legalName: null, countryCode: 'ES', tier: 'standard', emailDomains: ['test.example'],
          parentId: parent.id, defaultServicingBranchId: null, updatedAt: child.updatedAt, reason: 'Set parent',
        }),
      );
      const freshParent = await context.run(staff(), () => service.detail(parent.id));

      await expect(
        context.run(staff(), () =>
          service.update(parent.id, {
            name: 'Parent', legalName: null, countryCode: 'ES', tier: 'standard', emailDomains: ['test.example'],
            parentId: child.id, defaultServicingBranchId: null, updatedAt: freshParent.updatedAt, reason: 'Cycle',
          }),
        ),
      ).rejects.toMatchObject({ response: expect.objectContaining({ details: { code: 'HIERARCHY_CYCLE' } }) });
    });
  });

  describe('what each person sees', () => {
    /** A customer with two linked organisations and one invited person. */
    async function customerWithTwoOrgs() {
      const customer = await createCustomer();
      const first = await seedOrganisation('ACCESS01');
      const second = await seedOrganisation('ACCESS02');
      await context.run(staff(), () => service.attach(customer.id, { orgId: first, servicingBranchId: null, reason: 'First entity' }));
      const detail = await context.run(staff(), () =>
        service.attach(customer.id, { orgId: second, servicingBranchId: null, reason: 'Second entity' }),
      );
      const user = await inviteAdmin(customer.id);
      return { customerId: customer.id, userId: user.id, accountIds: detail.links.map((link) => link.id) };
    }

    it('starts a person seeing every linked organisation', async () => {
      const { customerId, userId } = await customerWithTwoOrgs();
      const listed = await context.run(staff(), () => service.users(customerId, { page: 1, pageSize: 25 }));
      const person = listed.items.find((item) => item.id === userId);
      expect(person?.seesAllOrganisations).toBe(true);
      expect(person?.accountIds).toEqual([]);
    });

    it('narrows a person to the organisations chosen, and widens again', async () => {
      const { customerId, userId, accountIds } = await customerWithTwoOrgs();

      const narrowed = await context.run(staff(), () =>
        service.updateUserAccess(customerId, userId, { scope: 'selected', accountIds: [accountIds[0]!], reason: 'Madrid only' }),
      );
      const restricted = narrowed.items.find((item) => item.id === userId);
      expect(restricted?.seesAllOrganisations).toBe(false);
      expect(restricted?.accountIds).toEqual([accountIds[0]]);

      const widened = await context.run(staff(), () =>
        service.updateUserAccess(customerId, userId, { scope: 'all', accountIds: [], reason: 'Promoted' }),
      );
      expect(widened.items.find((item) => item.id === userId)?.seesAllOrganisations).toBe(true);
    });

    it('refuses an account belonging to another customer', async () => {
      const { customerId, userId } = await customerWithTwoOrgs();
      const other = await createCustomer('Other customer');
      const otherOrg = await seedOrganisation('ACCESS03');
      const otherDetail = await context.run(staff(), () =>
        service.attach(other.id, { orgId: otherOrg, servicingBranchId: null, reason: 'Elsewhere' }),
      );

      await expect(
        context.run(staff(), () =>
          service.updateUserAccess(customerId, userId, {
            scope: 'selected', accountIds: [otherDetail.links[0]!.id], reason: 'Should fail',
          }),
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ details: { code: 'ACCOUNT_NOT_IN_CUSTOMER' } }),
      });
    });

    it('refuses a person who belongs to another customer', async () => {
      const { customerId } = await customerWithTwoOrgs();
      const other = await createCustomer('Other customer');
      const stranger = await inviteAdmin(other.id);

      await expect(
        context.run(staff(), () => service.updateUserAccess(customerId, stranger.id, { scope: 'all', accountIds: [], reason: 'Should fail' })),
      ).rejects.toThrow('User not found for this customer.');
    });
  });

  describe('authorisation', () => {
    it('refuses a customer context outright', async () => {
      const caller: TenantContextData = {
        userId: STAFF_ID, customerGroupId: randomUUID(), isInternal: false, accountIds: [],
        permissions: new Set([PERMISSIONS.ADMIN_CUSTOMERS_MANAGE]), correlationId: 'co-denied',
      };
      await expect(context.run(caller, () => service.list({ status: 'all', page: 1, pageSize: 25 }))).rejects.toThrow(
        'Internal staff permission required.',
      );
    });

    it('refuses an impersonating session any write', async () => {
      const caller: TenantContextData = { ...staff(), onBehalfOfUserId: randomUUID() };
      await expect(
        context.run(caller, () =>
          service.create({
            name: 'Impersonated', legalName: null, slug: `co-test-${randomUUID().slice(0, 8)}`, countryCode: 'ES',
            tier: 'standard', emailDomains: [], parentId: null, defaultServicingBranchId: null, reason: 'Should fail',
          }),
        ),
      ).rejects.toThrow('Impersonated sessions are read-only.');
    });
  });
});
