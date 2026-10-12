import { ReferenceService } from '../../src/modules/reference/reference.service';
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { SettingsService } from '../../src/common/settings/settings.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { JOB_NAMES } from '../../src/integration/jobs/job.registry';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { analyticsFor } from '../fixtures/analytics.fixture';
import { integrationMessages, recordingJobs } from '../fixtures/jobs.fixture';

/**
 * C5 and C8: approving, sending back, and releasing to the customer.
 *
 * Publishing is the only act in the whole module a customer can see the result of,
 * so its guards are the ones worth proving: nothing empty, nothing expired, nothing
 * above the threshold without a second person, and nothing sent from inside the
 * transaction.
 */
describe('approving and publishing', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let settings: SettingsService;
  let pricing: PricingService;
  let jobs: ReturnType<typeof recordingJobs>;

  let groupId: string;
  let branchId: string;
  const branchCode = `C5-${randomUUID().slice(0, 6)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];

  const staff = (userId: string, permissions: string[]) => ({
    customerGroupId: null,
    userId,
    isInternal: true,
    branchCode,
    accountIds: [],
    permissions: new Set<string>(permissions),
    correlationId: `c5-${randomUUID()}`,
  });

  const customer = () => ({
    customerGroupId: groupId,
    userId: randomUUID(),
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>([PERMISSIONS.PRICING_PUBLISH, PERMISSIONS.PRICING_APPROVE]),
    correlationId: `c5-${randomUUID()}`,
  });

  const PRICER = [PERMISSIONS.PRICING_PRICE, PERMISSIONS.PRICING_CLAIM, PERMISSIONS.PRICING_PUBLISH];
  const APPROVER = [PERMISSIONS.PRICING_APPROVE, PERMISSIONS.PRICING_PUBLISH];

  const makeStaffUser = async (name: string): Promise<string> => {
    const user = await owner.user.create({
      data: {
        email: `c5-${randomUUID()}@example.test`,
        displayName: name,
        isInternal: true,
        status: 'active',
        branchId,
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
      },
    });
    userIds.push(user.id);
    return user.id;
  };

  const makeQuote = async (): Promise<string> => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupId,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
      },
    });
    quoteIds.push(quote.id);
    return quote.id;
  };

  /** A priced quote at a chosen sell total, so threshold behaviour can be steered. */
  const priceAt = async (quoteId: string, pricer: string, rateMinorUnits: number, validUntil?: Date) =>
    context.run(staff(pricer, PRICER), () =>
      pricing.price(quoteId, {
        options: [
          {
            name: 'Weekly direct',
            isRecommended: true,
            validUntil: (validUntil ?? new Date(Date.now() + 14 * 86_400_000)).toISOString(),
            chargeLines: [
              { description: 'Ocean freight', quantity: 1, rateMinorUnits, currency: 'EUR' },
            ],
          },
        ],
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
    settings = new SettingsService(prisma, new FeatureSwitchService(prisma));
    jobs = recordingJobs();
    pricing = new PricingService(
      repository,
      context,
      settings,
      analyticsFor(repository, context),
      jobs,
      integrationMessages(),
      new ReferenceService(repository, context),
      new FeatureSwitchService(prisma),
    );

    const branch = await owner.branch.create({ data: { code: branchCode, name: 'C5 branch' } });
    branchId = branch.id;

    const group = await owner.customerGroup.create({
      data: {
        name: `C5 ${randomUUID().slice(0, 8)}`,
        slug: `c5-${randomUUID().slice(0, 8)}`,
        defaultServicingBranchId: branchId,
      },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    await owner.auditEvent.deleteMany({ where: { entityId: { in: quoteIds } } });
    await owner.analyticsEvent.deleteMany({ where: { entityId: { in: quoteIds } } });
    await owner.integrationMessage.deleteMany({ where: { customerGroupId: groupId } });
    await owner.quote.deleteMany({ where: { customerGroupId: groupId } });
    await owner.settingValue.deleteMany({ where: { key: { startsWith: 'quotations.' } } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await owner.user.deleteMany({ where: { id: { in: userIds } } });
    await owner.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  beforeEach(async () => {
    await owner.settingValue.deleteMany({ where: { key: { startsWith: 'quotations.' } } });
    jobs.recorded.length = 0;
  });

  const setThreshold = (eur: number) =>
    owner.settingValue.create({
      data: {
        key: 'quotations.threshold',
        scope: 'branch',
        scopeId: branchCode,
        value: eur,
        reason: 'test threshold',
      },
    });

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------

  it('publishes a priced quote below the threshold without an approver', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricer');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000);
    const result = await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));

    expect(result.status).toBe('published');

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.status).toBe('published');
    expect(row.publishedById).toBe(pricer);
    expect(row.publishedAt).not.toBeNull();
    // The work is done, so the claim is released rather than holding a row nobody
    // is working on.
    expect(row.claimedById).toBeNull();
  });

  it('queues the customer notification instead of sending it', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Notifying pricer');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000);
    await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));

    expect(jobs.recorded).toHaveLength(1);
    expect(jobs.recorded[0]!.name).toBe(JOB_NAMES.QUOTE_PUBLISHED_NOTIFY);
    expect(jobs.recorded[0]!.payload).toMatchObject({ quoteId, customerGroupId: groupId });
    // Keyed on the version, so re-publishing the same version cannot notify twice.
    expect(jobs.recorded[0]!.identity.sourceMessageId).toContain(':v1');
  });

  it('records the CargoWise copy as pending, and does not wait for it', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Publishing pricer');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000);
    await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));

    const message = await owner.integrationMessage.findFirstOrThrow({
      where: { customerGroupId: groupId, operation: 'quote.priced.submit' },
    });

    expect(message.status).toBe('pending');
    expect(message.sentAt).toBeNull();
    expect(message.attempts).toBe(0);
  });

  it('refuses an option with no charge lines, at pricing rather than at publishing', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Empty pricer');

    // An empty option is refused where it is typed. It used to be accepted and caught
    // at publish, which meant a pricer could believe the work was saved.
    await expect(
      context.run(staff(pricer, PRICER), () =>
        pricing.price(quoteId, { options: [{ isRecommended: true, chargeLines: [] }] }),
      ),
    ).rejects.toThrow();
  });

  it('refuses to publish a quote whose only answer is zero', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Zero pricer');

    // A charge line exists, so a count-the-lines check would have passed it - and the
    // customer would have been offered, and could have accepted, nothing.
    await priceAt(quoteId, pricer, 0);

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.publish(quoteId)),
    ).rejects.toThrow(/nothing to publish/i);
  });

  it('refuses to publish a quote that has already expired', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Late pricer');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000, new Date(Date.now() - 86_400_000));

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.publish(quoteId)),
    ).rejects.toThrow(/validity/i);
  });

  it('refuses to publish a quote nobody has priced', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Hasty pricer');

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.publish(quoteId)),
    ).rejects.toThrow(/cannot be published/i);
  });

  it('refuses to publish twice', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Double publisher');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000);
    await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.publish(quoteId)),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // The threshold, and four eyes
  // -------------------------------------------------------------------------

  it('refuses to publish above the threshold until somebody approves', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Big-ticket pricer');
    await setThreshold(10_000);

    // EUR 15,000 against a EUR 10,000 threshold.
    await priceAt(quoteId, pricer, 1_500_000);

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.publish(quoteId)),
    ).rejects.toThrow(/approval threshold/i);
  });

  it('publishes above the threshold once a different person has approved', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricer needing sign-off');
    const approver = await makeStaffUser('Approver');
    await setThreshold(10_000);

    await priceAt(quoteId, pricer, 1_500_000);
    await context.run(staff(approver, APPROVER), () => pricing.approve(quoteId));

    const result = await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));
    expect(result.status).toBe('published');
  });

  /** The control the Approvals screen promises on its face. */
  it('never lets the pricer approve their own quote', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Self approver');
    await setThreshold(10_000);

    await priceAt(quoteId, pricer, 1_500_000);

    await expect(
      context.run(staff(pricer, [...PRICER, PERMISSIONS.PRICING_APPROVE]), () =>
        pricing.approve(quoteId),
      ),
    ).rejects.toThrow(/your own pricing/i);
  });

  it('ignores the threshold entirely when approval is switched off', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Unapproved pricer');
    await setThreshold(10_000);
    await owner.settingValue.create({
      data: {
        key: 'quotations.approval',
        scope: 'branch',
        scopeId: branchCode,
        value: false,
        reason: 'this branch does not double-check',
      },
    });

    await priceAt(quoteId, pricer, 1_500_000);

    const result = await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));
    expect(result.status).toBe('published');
  });

  // -------------------------------------------------------------------------
  // Sending back
  // -------------------------------------------------------------------------

  it('sends a quote back to the pricer with a reason, clearing any approval', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Reworking pricer');
    const approver = await makeStaffUser('Unconvinced approver');
    await setThreshold(10_000);

    await priceAt(quoteId, pricer, 1_500_000);
    await context.run(staff(approver, APPROVER), () => pricing.approve(quoteId));
    await context.run(staff(approver, APPROVER), () =>
      pricing.sendBack(quoteId, 'Margin too thin on the origin charges'),
    );

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.status).toBe('priced');
    expect(row.approvedById).toBeNull();
    expect(row.approvedAt).toBeNull();
    // Back to whoever priced it, not into the open queue where anybody might pick
    // up a job somebody has already argued about.
    expect(row.claimedById).toBe(pricer);

    const entry = await owner.auditEvent.findFirstOrThrow({
      where: { entityId: quoteId, action: 'quote.sent_back' },
    });
    expect(entry.metadata).toMatchObject({ reason: 'Margin too thin on the origin charges' });
  });

  it('refuses a send-back with no reason', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricer');
    const approver = await makeStaffUser('Terse approver');

    await priceAt(quoteId, pricer, 50_000);

    await expect(
      context.run(staff(approver, APPROVER), () => pricing.sendBack(quoteId, '  ')),
    ).rejects.toThrow();
  });

  it('never lets the pricer send their own quote back', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Self sender');

    await priceAt(quoteId, pricer, 50_000);

    await expect(
      context.run(staff(pricer, [...PRICER, PERMISSIONS.PRICING_APPROVE]), () =>
        pricing.sendBack(quoteId, 'Changed my mind'),
      ),
    ).rejects.toThrow(/your own pricing/i);
  });

  // -------------------------------------------------------------------------
  // Re-pricing after publication
  // -------------------------------------------------------------------------

  it('lets a published quote be re-priced, bumping the version the customer sees', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Re-pricing pricer');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000);
    await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));
    await priceAt(quoteId, pricer, 60_000);

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.version).toBe(2);
    // Back out of the customer's sight until it is published again.
    expect(row.status).toBe('priced');

    jobs.recorded.length = 0;
    await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));
    // A genuine re-price notifies again, because the customer is looking at an
    // offer that has changed.
    expect(jobs.recorded[0]!.identity.sourceMessageId).toContain(':v2');
  });

  // -------------------------------------------------------------------------
  // Tenancy
  // -------------------------------------------------------------------------

  it('refuses publish, approve and send-back to a customer session', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricer');
    await priceAt(quoteId, pricer, 50_000);

    await expect(context.run(customer(), () => pricing.publish(quoteId))).rejects.toThrow();
    await expect(context.run(customer(), () => pricing.approve(quoteId))).rejects.toThrow();
    await expect(context.run(customer(), () => pricing.sendBack(quoteId, 'nope'))).rejects.toThrow();
  });

  it('writes an analytics event for a publication', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Measured pricer');
    await setThreshold(100_000);

    await priceAt(quoteId, pricer, 50_000);
    await context.run(staff(pricer, PRICER), () => pricing.publish(quoteId));

    const event = await owner.analyticsEvent.findFirstOrThrow({
      where: { entityId: quoteId, action: 'quote.published' },
    });
    expect(event.customerGroupId).toBe(groupId);
  });
});
