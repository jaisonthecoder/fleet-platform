import { ConflictException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { SettingsService } from '../../src/common/settings/settings.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext, type TenantContextData } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { IntegrationMessageService } from '../../src/integration/messages/integration-message.service';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { QuotesService } from '../../src/modules/quotes/quotes.service';
import { ReferenceService } from '../../src/modules/reference/reference.service';
import { analyticsFor } from '../fixtures/analytics.fixture';
import { recordingJobs } from '../fixtures/jobs.fixture';

/**
 * The quotation module end to end: a customer asks, a person prices, a person
 * publishes, the customer decides.
 *
 * Every step of this was covered somewhere before this file; the *journey* was
 * not. The gaps that only appear when the whole chain runs are the ones worth a
 * test: that the customer cannot see a price until it is published, that the
 * version they accept is the version they were shown, and that the commercial
 * outcome leaves the building.
 */
describe('quotation lifecycle', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let context: TenantContext;
  let repository: TenantRepository;
  let quotes: QuotesService;
  let pricing: PricingService;

  let groupId: string;
  let branchId: string;
  let customerUserId: string;
  let pricerId: string;

  const branchCode = `LC${randomUUID().slice(0, 4).toUpperCase()}`;

  const customer = (): TenantContextData => ({
    customerGroupId: groupId,
    userId: customerUserId,
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>([
      PERMISSIONS.QUOTES_CREATE,
      PERMISSIONS.QUOTES_SUBMIT,
      PERMISSIONS.QUOTES_READ,
      PERMISSIONS.QUOTES_ACCEPT,
      PERMISSIONS.QUOTES_CANCEL,
    ]),
    correlationId: 'lifecycle-customer',
  });

  const staff = (): TenantContextData => ({
    customerGroupId: null,
    userId: pricerId,
    isInternal: true,
    // The branch is resolved from the quote's account, falling back to the
    // customer's default; a pricer whose code does not match simply cannot see it.
    branchCode,
    accountIds: [],
    permissions: new Set<string>([
      PERMISSIONS.PRICING_QUEUE_READ,
      PERMISSIONS.PRICING_CLAIM,
      PERMISSIONS.PRICING_PRICE,
      PERMISSIONS.PRICING_PUBLISH,
    ]),
    correlationId: 'lifecycle-staff',
  });

  const requestBody = () => ({
    mode: 'sea' as const,
    originCode: 'CNTAO',
    destinationCode: 'ESVLC',
    commodity: 'Ceramic tiles',
    grossWeightKg: 18_000,
    currency: 'EUR',
    packages: [{ lineId: 'line-1', quantity: 20, packageType: 'pallet', weightKg: 900 }],
    payload: { commodity: 'Ceramic tiles' },
  });

  const priceBody = () => ({
    messageToCustomer: 'Two sailings this week.',
    options: [
      {
        name: 'Weekly direct',
        carrierName: 'MSC',
        currency: 'EUR',
        isRecommended: true,
        chargeLines: [
          {
            description: 'Ocean freight',
            basis: 'Per container',
            quantity: 1,
            rateMinorUnits: 180_000,
            currency: 'EUR',
          },
        ],
      },
    ],
  });

  beforeAll(async () => {
    owner = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_MIGRATION_URL,
        connectionTimeoutMillis: 5000,
      }),
    });
    await owner.$connect();

    context = new TenantContext();
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new TenantRepository(prisma, context);

    const switches = new FeatureSwitchService(prisma);
    const settings = new SettingsService(prisma, switches);
    const messages = new IntegrationMessageService();

    quotes = new QuotesService(
      repository,
      context,
      { rate: async () => null } as never,
      analyticsFor(repository, context),
      settings,
      switches,
      messages,
    );

    pricing = new PricingService(
      repository,
      context,
      settings,
      analyticsFor(repository, context),
      recordingJobs(),
      messages,
      new ReferenceService(repository, context),
      switches,
    );

    const branch = await owner.branch.create({
      data: { code: branchCode, name: 'Lifecycle branch' },
    });
    branchId = branch.id;

    const group = await owner.customerGroup.create({
      data: {
        name: `Lifecycle ${randomUUID().slice(0, 8)}`,
        slug: `lifecycle-${randomUUID().slice(0, 8)}`,
        status: 'active',
        defaultServicingBranchId: branchId,
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    groupId = group.id;

    const buyer = await owner.user.create({
      data: {
        email: `buyer-${randomUUID()}@example.test`,
        displayName: 'Buyer',
        customerGroupId: groupId,
        status: 'active',
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    customerUserId = buyer.id;

    const pricer = await owner.user.create({
      data: {
        email: `pricer-${randomUUID()}@example.test`,
        displayName: 'Pricer',
        status: 'active',
        branchId,
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    pricerId = pricer.id;
  });

  afterAll(async () => {
    await owner.integrationMessage.deleteMany({ where: { customerGroupId: groupId } });
    await owner.quote.deleteMany({ where: { customerGroupId: groupId } });
    await owner.user.deleteMany({ where: { id: { in: [customerUserId, pricerId] } } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await owner.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  /** Request, submit, claim, price, publish - the happy path, as one journey. */
  async function runToPublished() {
    const created = await context.run(customer(), () => quotes.create(requestBody()));
    const id = (created as { id: string }).id;

    await context.run(customer(), () => quotes.submit(id));
    await context.run(staff(), () => pricing.claim(id));
    await context.run(staff(), () => pricing.price(id, priceBody()));
    await context.run(staff(), () => pricing.publish(id));

    return id;
  }

  it('carries a request through to a price the customer can see', async () => {
    const id = await runToPublished();

    const detail = await context.run(customer(), () => quotes.getById(id));

    expect(detail.status).toBe('published');
    expect(detail.options).toHaveLength(1);
    expect(Number(detail.options[0]?.totalMinorUnits)).toBe(180_000);
    expect(detail.awaitingDecision).toBe(true);
  });

  it('hides the price from the customer until it is published', async () => {
    const created = await context.run(customer(), () => quotes.create(requestBody()));
    const id = (created as { id: string }).id;

    await context.run(customer(), () => quotes.submit(id));
    await context.run(staff(), () => pricing.claim(id));
    await context.run(staff(), () => pricing.price(id, priceBody()));

    const detail = await context.run(customer(), () => quotes.getById(id));

    // Priced but unpublished. The collapse to one badge IS the confidentiality
    // control: a half-finished answer must be invisible, not merely unstyled.
    expect(detail.statusBadge).toBe('in_progress');
    expect(detail.options).toHaveLength(0);
    expect(detail.awaitingDecision).toBe(false);
  });

  it('records the acceptance against the option the customer chose', async () => {
    const id = await runToPublished();
    const before = await context.run(customer(), () => quotes.getById(id));
    const optionId = before.options[0]!.id;

    const result = await context.run(customer(), () =>
      quotes.accept(id, { optionId, version: before.version }),
    );

    expect(result.status).toBe('accepted');

    const row = await owner.quote.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('accepted');
    expect(row.acceptedOptionId).toBe(optionId);
    expect(row.decidedById).toBe(customerUserId);
  });

  it('refuses an acceptance of a version that has been superseded', async () => {
    const id = await runToPublished();
    const before = await context.run(customer(), () => quotes.getById(id));
    const staleVersion = before.version;

    // Re-priced while the customer was reading: a published quote is priced
    // again directly, which takes it back out of their sight until it is
    // republished. There is nothing to claim - it is already owned.
    await context.run(staff(), () => pricing.price(id, priceBody()));
    await context.run(staff(), () => pricing.publish(id));

    const after = await context.run(customer(), () => quotes.getById(id));
    expect(after.version).toBe(staleVersion + 1);

    await expect(
      context.run(customer(), () =>
        quotes.accept(id, { optionId: after.options[0]!.id, version: staleVersion }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    const row = await owner.quote.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('published');
  });

  it('refuses an option that belongs to a different quote', async () => {
    const mine = await runToPublished();
    const theirs = await runToPublished();

    const other = await context.run(customer(), () => quotes.getById(theirs));
    const target = await context.run(customer(), () => quotes.getById(mine));

    await expect(
      context.run(customer(), () =>
        quotes.accept(mine, { optionId: other.options[0]!.id, version: target.version }),
      ),
    ).rejects.toBeDefined();
  });

  it('hands the commercial outcome to the adapter, held like the request', async () => {
    const id = await runToPublished();
    const detail = await context.run(customer(), () => quotes.getById(id));

    await context.run(customer(), () =>
      quotes.accept(id, { optionId: detail.options[0]!.id, version: detail.version }),
    );

    const messages = await owner.integrationMessage.findMany({
      where: { portalRef: detail.reference },
      select: { operation: true, status: true, direction: true },
    });

    const operations = messages.map((message) => message.operation);
    // The whole journey leaves a trail: the request, the price, and the answer.
    expect(operations).toContain('quote.request.create');
    expect(operations).toContain('quote.priced.submit');
    expect(operations).toContain('quote.decision.record');

    const decision = messages.find((m) => m.operation === 'quote.decision.record');
    expect(decision?.direction).toBe('outbound');
    // Held, not delivered - no transport is configured.
    expect(decision?.status).toBe('pending');
  });

  it('tells CargoWise when a customer withdraws a request nobody answered', async () => {
    const created = await context.run(customer(), () => quotes.create(requestBody()));
    const id = (created as { id: string }).id;
    const reference = (created as { reference: string }).reference;

    await context.run(customer(), () => quotes.submit(id));
    await context.run(customer(), () => quotes.cancel(id));

    const cancel = await owner.integrationMessage.findFirst({
      where: { portalRef: reference, operation: 'quote.request.cancel' },
    });

    expect(cancel).not.toBeNull();
  });

  /**
   * The account carries the CargoWise organisation code the copy is filed against,
   * and the servicing branch that decides which queue the request lands in. The
   * request screen never asks for it, so it has to be inferred or the copy goes
   * out unfilable.
   */
  describe('organisation on the request', () => {
    let accountId: string;

    beforeAll(async () => {
      const account = await owner.customerAccount.create({
        data: {
          customerGroupId: groupId,
          name: 'Lifecycle Iberia SL',
          cw1OrgCode: `LC${randomUUID().slice(0, 8).toUpperCase()}`,
          servicingBranchId: branchId,
          updatedAt: new Date(),
        },
        select: { id: true },
      });
      accountId = account.id;
    });

    afterAll(async () => {
      await owner.customerAccount.deleteMany({ where: { id: accountId } });
    });

    it('files the request against the company\'s only organisation', async () => {
      const created = await context.run(customer(), () => quotes.create(requestBody()));
      const id = (created as { id: string }).id;

      const row = await owner.quote.findUniqueOrThrow({ where: { id } });
      expect(row.accountId).toBe(accountId);
    });

    it('carries the organisation code in the copy, so the far end can file it', async () => {
      const created = await context.run(customer(), () => quotes.create(requestBody()));
      const id = (created as { id: string }).id;
      const reference = (created as { reference: string }).reference;

      await context.run(customer(), () => quotes.submit(id));

      const message = await owner.integrationMessage.findFirstOrThrow({
        where: { portalRef: reference, operation: 'quote.request.create' },
      });

      const payload = message.payload as { orgCode: string | null };
      // An empty string here was the defect: it looks like a value and files nowhere.
      expect(payload.orgCode).not.toBe('');
      expect(payload.orgCode).toMatch(/^LC/);
    });
  });
});
