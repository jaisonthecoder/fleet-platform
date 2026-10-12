import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import type { AnalyticsService } from '../../src/common/analytics/analytics.service';
import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { SettingsService } from '../../src/common/settings/settings.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { QuotesService } from '../../src/modules/quotes/quotes.service';
import { ReferenceService } from '../../src/modules/reference/reference.service';
import { analyticsFor } from '../fixtures/analytics.fixture';
import { integrationMessages, recordingJobs } from '../fixtures/jobs.fixture';

/**
 * What the customer may read, and when.
 *
 * This suite exists because the customer read path had no test at all, and a real
 * leak hid behind that gap: `forCustomer` removed a list of internal fields and
 * spread the rest, so the quote's own headline figures and the pricer's covering
 * message - written at `priced`, before anybody published - reached the customer.
 *
 * The rule being protected is a single sentence: a price that has been typed is not
 * an offer until somebody publishes it. Everything below is that sentence, checked.
 */
describe('what the customer may read', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let quotes: QuotesService;
  let pricing: PricingService;

  let groupId: string;
  let otherGroupId: string;
  let branchId: string;
  const branchCode = `CV-${randomUUID().slice(0, 6)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];

  const staff = (userId: string) => ({
    customerGroupId: null,
    userId,
    isInternal: true,
    branchCode,
    accountIds: [],
    permissions: new Set<string>([
      PERMISSIONS.PRICING_PRICE,
      PERMISSIONS.PRICING_CLAIM,
      PERMISSIONS.PRICING_PUBLISH,
      PERMISSIONS.QUOTES_READ,
    ]),
    correlationId: `cv-${randomUUID()}`,
  });

  const customer = (group: string) => ({
    customerGroupId: group,
    userId: randomUUID(),
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>([PERMISSIONS.QUOTES_READ, PERMISSIONS.QUOTES_ACCEPT]),
    correlationId: `cv-${randomUUID()}`,
  });

  const makeQuote = async (): Promise<string> => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupId,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        updatedAt: new Date('2026-09-21T10:00:00.000Z'),
      },
    });
    quoteIds.push(quote.id);
    return quote.id;
  };

  const priceIt = (quoteId: string, pricer: string) =>
    context.run(staff(pricer), () =>
      pricing.price(quoteId, {
        options: [
          {
            name: 'Weekly direct',
            carrierName: 'A carrier the customer may not see yet',
            isRecommended: true,
            validUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(),
            chargeLines: [
              { description: 'Ocean freight', quantity: 1, rateMinorUnits: 898_000, currency: 'EUR' },
            ],
          },
        ],
        messageToCustomer: 'Here is our offer, valid for fourteen days.',
      }),
    );

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
    const analytics: AnalyticsService = analyticsFor(repository, context);

    pricing = new PricingService(
      repository,
      context,
      settings,
      analytics,
      recordingJobs(),
      integrationMessages(),
      new ReferenceService(repository, context),
      switches,
    );

    quotes = new QuotesService(
      repository,
      context,
      // Instant rating is switched off and never reached by this suite.
      { rate: async () => { throw new Error('not used'); } } as never,
      analytics,
      settings,
      switches,
      integrationMessages(),
    );

    const branch = await owner.branch.create({ data: { code: branchCode, name: 'CV branch' } });
    branchId = branch.id;

    const group = await owner.customerGroup.create({
      data: {
        name: `CV ${randomUUID().slice(0, 8)}`,
        slug: `cv-${randomUUID().slice(0, 8)}`,
        defaultServicingBranchId: branchId,
      },
    });
    groupId = group.id;

    const other = await owner.customerGroup.create({
      data: { name: `CV other ${randomUUID().slice(0, 8)}`, slug: `cv-other-${randomUUID().slice(0, 8)}` },
    });
    otherGroupId = other.id;

    const user = await owner.user.create({
      data: {
        email: `cv-${randomUUID()}@example.test`,
        displayName: 'CV pricer',
        isInternal: true,
        status: 'active',
        branchId,
        updatedAt: new Date('2026-09-21T10:00:00.000Z'),
      },
    });
    userIds.push(user.id);
  });

  afterAll(async () => {
    await owner.auditEvent.deleteMany({ where: { entityId: { in: quoteIds } } });
    await owner.analyticsEvent.deleteMany({ where: { entityId: { in: quoteIds } } });
    await owner.quote.deleteMany({ where: { customerGroupId: { in: [groupId, otherGroupId] } } });
    await owner.settingValue.deleteMany({ where: { key: { startsWith: 'quotations.' } } });
    await owner.customerGroup.deleteMany({ where: { id: { in: [groupId, otherGroupId] } } });
    await owner.user.deleteMany({ where: { id: { in: userIds } } });
    await owner.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  it('shows a priced but unpublished quote no figure, no validity and no message', async () => {
    const quoteId = await makeQuote();
    await priceIt(quoteId, userIds[0]!);

    const seen = await context.run(customer(groupId), () => quotes.getById(quoteId));

    // The four fields that leaked. All are written at `priced`; none is an offer yet.
    expect(seen.totalMinorUnits).toBeNull();
    expect(seen.currency).toBeNull();
    expect(seen.validUntil).toBeNull();
    expect(seen.messageToCustomer).toBeNull();
    expect(seen.options).toHaveLength(0);
    expect(seen.optionCount).toBe(0);
    expect(seen.awaitingDecision).toBe(false);

    // And the status must not give the game away either.
    expect(seen.statusBadge).toBe('in_progress');
  });

  it('releases all four the moment it is published', async () => {
    const quoteId = await makeQuote();
    await priceIt(quoteId, userIds[0]!);
    await context.run(staff(userIds[0]!), () => pricing.publish(quoteId));

    const seen = await context.run(customer(groupId), () => quotes.getById(quoteId));

    expect(seen.totalMinorUnits).toBe(898_000);
    expect(seen.currency).toBe('EUR');
    expect(seen.validUntil).not.toBeNull();
    expect(seen.messageToCustomer).toBe('Here is our offer, valid for fourteen days.');
    expect(seen.options).toHaveLength(1);
    expect(seen.statusBadge).toBe('quoted');
  });

  it('never carries an internal field, at any status', async () => {
    const quoteId = await makeQuote();
    await priceIt(quoteId, userIds[0]!);
    await context.run(staff(userIds[0]!), () => pricing.publish(quoteId));

    const seen = (await context.run(customer(groupId), () =>
      quotes.getById(quoteId),
    )) as unknown as Record<string, unknown>;

    // An allow-list projection, so this is a regression guard rather than a deny-list:
    // a new column on `quote` cannot appear here without somebody adding it on purpose.
    for (const forbidden of [
      'claimedById',
      'claimedAt',
      'pricedById',
      'pricedAt',
      'approvedById',
      'approvedAt',
      'publishedById',
      'decidedById',
      'rateResponse',
      'customerGroupId',
      'accountId',
      'createdById',
    ]) {
      expect(seen).not.toHaveProperty(forbidden);
    }
  });

  it('serialises figures as numbers, not BigInt or Decimal strings', async () => {
    const quoteId = await makeQuote();
    await priceIt(quoteId, userIds[0]!);
    await context.run(staff(userIds[0]!), () => pricing.publish(quoteId));

    const seen = await context.run(customer(groupId), () => quotes.getById(quoteId));

    // A BigInt on the response throws inside res.json, so this is the difference
    // between a working detail screen and a 500 from the moment a price is saved.
    expect(() => JSON.stringify(seen)).not.toThrow();
    expect(typeof seen.totalMinorUnits).toBe('number');
    expect(seen.options[0] && typeof seen.options[0].totalMinorUnits).toBe('number');
  });

  it('hides another company\u2019s quote entirely', async () => {
    const quoteId = await makeQuote();

    await expect(
      context.run(customer(otherGroupId), () => quotes.getById(quoteId)),
    ).rejects.toThrow(/not found/i);
  });

  it('refuses an internal caller the customer read paths', async () => {
    const quoteId = await makeQuote();

    // Staff hold quotes.read, and the tenancy policy reads through for internal
    // sessions - so without this refusal these two routes were a cross-tenant,
    // cross-branch view of every customer's quotes.
    await expect(context.run(staff(userIds[0]!), () => quotes.getById(quoteId))).rejects.toThrow(
      /not found/i,
    );
    await expect(context.run(staff(userIds[0]!), () => quotes.list({}))).rejects.toThrow(
      /not found/i,
    );
  });
});
