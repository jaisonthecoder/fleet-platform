import { ReferenceService } from '../../src/modules/reference/reference.service';
import { integrationMessages, recordingJobs } from '../fixtures/jobs.fixture';
import { analyticsFor } from '../fixtures/analytics.fixture';
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { SettingsService } from '../../src/common/settings/settings.service';
import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { PricingService } from '../../src/modules/pricing/pricing.service';

/**
 * C3: who is working on what, and the settings that govern it.
 *
 * Two properties are worth a database to prove. First, that two specialists
 * cannot claim the same request - which no unit test can show, because the bug
 * only exists between two concurrent transactions. Second, that the scoped
 * settings resolver returns the layer the screen will print, because a value
 * with the wrong provenance is a value nobody can explain.
 */
describe('pricing claims and scoped settings', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let settings: SettingsService;
  let pricing: PricingService;
  let jobs: ReturnType<typeof recordingJobs>;

  let groupId: string;
  let branchId: string;
  let regionId: string;
  const branchCode = `ISO-${randomUUID().slice(0, 6)}`;
  const regionCode = `RG-${randomUUID().slice(0, 6)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];

  const staff = (userId: string, permissions: string[] = [], branch: string | null = branchCode) => ({
    customerGroupId: null,
    userId,
    isInternal: true,
    branchCode: branch,
    accountIds: [],
    permissions: new Set<string>(permissions),
    correlationId: `c3-${randomUUID()}`,
  });

  const makeStaffUser = async (name: string): Promise<string> => {
    const user = await owner.user.create({
      data: {
        email: `c3-${randomUUID()}@example.test`,
        displayName: name,
        isInternal: true,
        status: 'active',
        branchId,
        updatedAt: new Date('2026-09-19T10:00:00.000Z'),
      },
    });
    userIds.push(user.id);
    return user.id;
  };

  const makeQuote = async (status: 'requested' | 'claimed' = 'requested'): Promise<string> => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupId,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status,
        mode: 'sea',
        originCode: 'CNSHA',
        destinationCode: 'ESVLC',
        updatedAt: new Date('2026-09-19T10:00:00.000Z'),
      },
    });
    quoteIds.push(quote.id);
    return quote.id;
  };

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

    const region = await owner.region.create({
      data: { code: regionCode, name: 'Isolation region' },
    });
    regionId = region.id;

    const branch = await owner.branch.create({
      data: { code: branchCode, name: 'Isolation branch', regionId },
    });
    branchId = branch.id;

    const group = await owner.customerGroup.create({
      data: {
        name: `Pricing ${randomUUID().slice(0, 8)}`,
        slug: `pricing-${randomUUID().slice(0, 8)}`,
        defaultServicingBranchId: branchId,
      },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    await owner.auditEvent.deleteMany({ where: { entityId: { in: quoteIds } } });
    await owner.quote.deleteMany({ where: { customerGroupId: groupId } });
    await owner.settingValue.deleteMany({
      where: { key: { startsWith: 'quotations.' } },
    });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await owner.user.deleteMany({ where: { id: { in: userIds } } });
    await owner.branch.deleteMany({ where: { id: branchId } });
    await owner.region.deleteMany({ where: { id: regionId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  beforeEach(async () => {
    await owner.settingValue.deleteMany({ where: { key: { startsWith: 'quotations.' } } });
  });

  // -------------------------------------------------------------------------
  // Settings resolution
  // -------------------------------------------------------------------------

  it('falls back to the catalogue default, and says so', async () => {
    const resolved = await settings.resolve('quotations.claimExpiry', { branchCode });

    expect(resolved.value).toBe(4);
    expect(resolved.source).toBe('default');
  });

  it('lets a branch override beat a region, which beats a global', async () => {
    await owner.settingValue.createMany({
      data: [
        { key: 'quotations.claimExpiry', scope: 'global', scopeId: null, value: 24, reason: 'global' },
        { key: 'quotations.claimExpiry', scope: 'region', scopeId: regionCode, value: 12, reason: 'region' },
        { key: 'quotations.claimExpiry', scope: 'branch', scopeId: branchCode, value: 2, reason: 'branch' },
      ],
    });

    const atBranch = await settings.resolve('quotations.claimExpiry', { branchCode, regionCode });
    expect(atBranch.value).toBe(2);
    expect(atBranch.source).toBe('branch');

    // The same key, one layer up: the region answer, not the branch's.
    const atRegion = await settings.resolve('quotations.claimExpiry', { regionCode });
    expect(atRegion.value).toBe(12);
    expect(atRegion.source).toBe('region');

    // And with no scope at all, the global.
    const global = await settings.resolve('quotations.claimExpiry', {});
    expect(global.value).toBe(24);
    expect(global.source).toBe('global');
  });

  it('ignores a stored value that no longer fits the catalogue', async () => {
    // 9000 hours is past the catalogue maximum. One bad row must not take down
    // every claim in the branch, so it is skipped and the default stands.
    await owner.settingValue.create({
      data: {
        key: 'quotations.claimExpiry',
        scope: 'branch',
        scopeId: branchCode,
        value: 9000,
        reason: 'out of range',
      },
    });

    const resolved = await settings.resolve('quotations.claimExpiry', { branchCode });
    expect(resolved.value).toBe(4);
    expect(resolved.source).toBe('default');
  });

  it('ignores a stored row whose key is not in the catalogue', async () => {
    await owner.settingValue.create({
      data: {
        key: 'quotations.retiredKey',
        scope: 'global',
        scopeId: null,
        value: true,
        reason: 'retired',
      },
    });

    // Nothing to assert on the retired key itself - the point is that reading a
    // real key still works rather than throwing on the unknown row.
    await expect(settings.resolve('quotations.approval', {})).resolves.toMatchObject({
      source: 'default',
    });

    await owner.settingValue.deleteMany({ where: { key: 'quotations.retiredKey' } });
  });

  it('refuses a customer session the right to write a setting', async () => {
    await expect(
      context.run(
        {
          customerGroupId: groupId,
          userId: randomUUID(),
          isInternal: false,
          accountIds: [],
          permissions: new Set<string>(),
          correlationId: `c3-${randomUUID()}`,
        },
        () =>
          repository.run((tx) =>
            tx.settingValue.create({
              data: {
                key: 'quotations.approval',
                scope: 'global',
                scopeId: null,
                value: false,
                reason: 'should never land',
              },
            }),
          ),
      ),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Claiming
  // -------------------------------------------------------------------------

  it('lets exactly one of two simultaneous claims win', async () => {
    const quoteId = await makeQuote();
    const first = await makeStaffUser('First specialist');
    const second = await makeStaffUser('Second specialist');

    const results = await Promise.allSettled([
      context.run(staff(first, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId)),
      context.run(staff(second, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId)),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.status).toBe('claimed');
    expect([first, second]).toContain(row.claimedById);
  });

  it('names the holder when the claim is refused', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Marta Holder');
    const other = await makeStaffUser('Other specialist');

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    await expect(
      context.run(staff(other, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId)),
    ).rejects.toThrow(/Marta Holder/);
  });

  it('lets a stale claim be taken by somebody else', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Forgetful specialist');
    const taker = await makeStaffUser('Later specialist');

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    // Five hours ago, against the four-hour default.
    await owner.quote.update({
      where: { id: quoteId },
      data: { claimedAt: new Date(Date.now() - 5 * 3_600_000) },
    });

    await context.run(staff(taker, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.claimedById).toBe(taker);
  });

  it('respects the branch expiry setting rather than a hard-coded four hours', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Holder under a long expiry');
    const taker = await makeStaffUser('Hopeful taker');

    await owner.settingValue.create({
      data: {
        key: 'quotations.claimExpiry',
        scope: 'branch',
        scopeId: branchCode,
        value: 24,
        reason: 'this branch runs a day',
      },
    });

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));
    await owner.quote.update({
      where: { id: quoteId },
      data: { claimedAt: new Date(Date.now() - 5 * 3_600_000) },
    });

    // Five hours is stale at four, fresh at twenty-four. If the service had the
    // number baked in, this take would succeed.
    await expect(
      context.run(staff(taker, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId)),
    ).rejects.toThrow();
  });

  it('lets the holder release, and refuses anybody else', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Releasing specialist');
    const stranger = await makeStaffUser('Uninvolved specialist');

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    await expect(
      context.run(staff(stranger, [PERMISSIONS.PRICING_CLAIM]), () => pricing.release(quoteId)),
    ).rejects.toThrow();

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.release(quoteId));

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.status).toBe('requested');
    expect(row.claimedById).toBeNull();
    expect(row.claimedAt).toBeNull();
  });

  it('refuses a force-release without a reason, and without the right role', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Busy specialist');
    const approver = await makeStaffUser('Pricing approver');

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    await expect(
      context.run(staff(approver, [PERMISSIONS.PRICING_APPROVE]), () =>
        pricing.forceRelease(quoteId, '   '),
      ),
    ).rejects.toThrow();

    // Holds the release permission but is not an approver, and the branch says
    // approvers only.
    await expect(
      context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM_RELEASE]), () =>
        pricing.forceRelease(quoteId, 'taking it back'),
      ),
    ).rejects.toThrow();
  });

  /**
   * A request that resolves to no servicing office at all.
   *
   * Go-live now demands a default office, but deleting a branch nulls it again
   * (ON DELETE SET NULL), and a customer waiting on a quote that appears in no
   * queue is the worst outcome available. It belongs in everyone's queue rather
   * than nobody's.
   */
  describe('a request no branch owns', () => {
    let strandedGroupId: string;
    let strandedQuoteId: string;

    beforeAll(async () => {
      const group = await owner.customerGroup.create({
        data: {
          name: `Stranded ${randomUUID().slice(0, 8)}`,
          slug: `stranded-${randomUUID().slice(0, 8)}`,
          defaultServicingBranchId: null,
        },
        select: { id: true },
      });
      strandedGroupId = group.id;

      const quote = await owner.quote.create({
        data: {
          customerGroupId: strandedGroupId,
          reference: `Q-${randomUUID().slice(0, 8)}`,
          status: 'requested',
          mode: 'sea',
          originCode: 'CNSHA',
          destinationCode: 'ESVLC',
          updatedAt: new Date('2026-09-19T10:00:00.000Z'),
        },
        select: { id: true },
      });
      strandedQuoteId = quote.id;
    });

    afterAll(async () => {
      await owner.quote.deleteMany({ where: { customerGroupId: strandedGroupId } });
      await owner.customerGroup.deleteMany({ where: { id: strandedGroupId } });
    });

    it('appears in a branch pricer queue rather than nobody s', async () => {
      const pricer = await makeStaffUser('Queue reader');

      const entries = await context.run(
        staff(pricer, [PERMISSIONS.PRICING_QUEUE_READ]),
        () => pricing.queue(),
      );

      expect(entries.some((entry) => entry.id === strandedQuoteId)).toBe(true);
    });

    it('can be claimed by whoever finds it', async () => {
      const pricer = await makeStaffUser('Queue claimer');

      // Seeing it and then being refused the claim would look like a bug rather
      // than a routing gap, so the queue and the claim check must agree.
      await expect(
        context.run(staff(pricer, [PERMISSIONS.PRICING_CLAIM]), () =>
          pricing.claim(strandedQuoteId),
        ),
      ).resolves.toBeDefined();
    });
  });

  it('records who forced a release, from whom, and why', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Absent specialist');
    const approver = await makeStaffUser('Approving manager');

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    await context.run(staff(approver, [PERMISSIONS.PRICING_APPROVE]), () =>
      pricing.forceRelease(quoteId, 'Customer chased, holder on leave'),
    );

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.status).toBe('requested');
    expect(row.claimedById).toBeNull();

    const audit = await owner.auditEvent.findFirstOrThrow({
      where: { entityId: quoteId, action: 'quote.claim.force_released' },
    });
    expect(audit.actorUserId).toBe(approver);
    expect(audit.metadata).toMatchObject({
      previousHolderId: holder,
      reason: 'Customer chased, holder on leave',
    });
  });

  it('follows the releaseBy setting when it names administrators', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Holder under admin-only release');
    const approver = await makeStaffUser('Approver who no longer qualifies');

    await owner.settingValue.create({
      data: {
        key: 'quotations.releaseBy',
        scope: 'branch',
        scopeId: branchCode,
        value: 'admin',
        reason: 'this branch reserves it',
      },
    });

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    await expect(
      context.run(staff(approver, [PERMISSIONS.PRICING_APPROVE]), () =>
        pricing.forceRelease(quoteId, 'approver tries'),
      ),
    ).rejects.toThrow();

    await context.run(staff(approver, [PERMISSIONS.ADMIN_SETTINGS_MANAGE]), () =>
      pricing.forceRelease(quoteId, 'administrator succeeds'),
    );

    const row = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.claimedById).toBeNull();
  });

  // -------------------------------------------------------------------------
  // The queue
  //
  // These exist because the branch filter is a nested Prisma relation clause, and
  // TypeScript accepted an EARLIER version of it that referenced a column which
  // does not exist. A compiling where-clause proves nothing about a where-clause.
  // -------------------------------------------------------------------------

  it('returns the branch queue through the customer default servicing branch', async () => {
    const quoteId = await makeQuote();
    const reader = await makeStaffUser('Queue reader');

    const rows = await context.run(
      staff(reader, [PERMISSIONS.PRICING_QUEUE_READ]),
      () => pricing.queue(),
    );

    expect(rows.map((r) => r.id)).toContain(quoteId);
  });

  it('hides another branch\u2019s work from a specialist without the cross-branch grant', async () => {
    const quoteId = await makeQuote();
    const reader = await makeStaffUser('Reader in another branch');

    const rows = await context.run(
      staff(reader, [PERMISSIONS.PRICING_QUEUE_READ], 'SOME-OTHER-BRANCH'),
      () => pricing.queue(),
    );

    expect(rows.map((r) => r.id)).not.toContain(quoteId);
  });

  it('shows every branch to a specialist holding the cross-branch grant', async () => {
    const quoteId = await makeQuote();
    const reader = await makeStaffUser('Cross-branch reader');

    const rows = await context.run(
      staff(
        reader,
        [PERMISSIONS.PRICING_QUEUE_READ, PERMISSIONS.PRICING_CROSS_BRANCH],
        'SOME-OTHER-BRANCH',
      ),
      () => pricing.queue(),
    );

    expect(rows.map((r) => r.id)).toContain(quoteId);
  });

  it('returns nothing to a branchless user rather than everything', async () => {
    await makeQuote();
    const reader = await makeStaffUser('Branchless administrator');

    const rows = await context.run(
      staff(reader, [PERMISSIONS.PRICING_QUEUE_READ], null),
      () => pricing.queue(),
    );

    expect(rows).toHaveLength(0);
  });

  it('reports when each claim expires, so the screen need not re-derive it', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Timed specialist');

    await context.run(staff(holder, [PERMISSIONS.PRICING_CLAIM]), () => pricing.claim(quoteId));

    const rows = await context.run(staff(holder, [PERMISSIONS.PRICING_QUEUE_READ]), () =>
      pricing.queue(),
    );
    const entry = rows.find((r) => r.id === quoteId);

    expect(entry?.claimedByName).toBe('Timed specialist');
    expect(entry?.claimExpiresAt).not.toBeNull();

    const expires = new Date(entry!.claimExpiresAt!).getTime();
    const claimed = new Date(entry!.claimedAt!).getTime();
    expect(Math.round((expires - claimed) / 3_600_000)).toBe(4);
  });

  // -------------------------------------------------------------------------
  // Branch scope on a single quote
  //
  // The queue tests above prove the LIST is filtered. These prove the same rule is
  // an access control and not just a filter: without them a specialist who cannot
  // see a quote in their queue still reaches it by putting its id in the URL.
  // -------------------------------------------------------------------------

  it('hides another branch\u2019s quote from every per-quote route', async () => {
    const quoteId = await makeQuote();
    const outsider = await makeStaffUser('Specialist elsewhere');
    const session = staff(
      outsider,
      [
        PERMISSIONS.PRICING_QUEUE_READ,
        PERMISSIONS.PRICING_CLAIM,
        PERMISSIONS.PRICING_CLAIM_RELEASE,
        PERMISSIONS.PRICING_PRICE,
        PERMISSIONS.PRICING_APPROVE,
        PERMISSIONS.PRICING_PUBLISH,
      ],
      'SOME-OTHER-BRANCH',
    );

    // 404 rather than 403 on purpose: a pricer in another branch must not learn
    // that this quote exists.
    await expect(context.run(session, () => pricing.detail(quoteId))).rejects.toThrow(
      /not found/i,
    );
    await expect(context.run(session, () => pricing.claim(quoteId))).rejects.toThrow(/not found/i);
    await expect(context.run(session, () => pricing.release(quoteId))).rejects.toThrow(
      /not found/i,
    );
    await expect(
      context.run(session, () => pricing.forceRelease(quoteId, 'taking over')),
    ).rejects.toThrow(/not found/i);
    await expect(
      context.run(session, () =>
        pricing.price(quoteId, {
          options: [
            {
              chargeLines: [
                { description: 'Ocean freight', quantity: 1, rateMinorUnits: 100_000, currency: 'EUR' },
              ],
            },
          ],
        }),
      ),
    ).rejects.toThrow(/not found/i);
    await expect(context.run(session, () => pricing.approve(quoteId))).rejects.toThrow(
      /not found/i,
    );
    await expect(context.run(session, () => pricing.sendBack(quoteId, 'wrong'))).rejects.toThrow(
      /not found/i,
    );
    await expect(context.run(session, () => pricing.publish(quoteId))).rejects.toThrow(
      /not found/i,
    );
  });

  it('lets the cross-branch grant reach another branch\u2019s quote', async () => {
    const quoteId = await makeQuote();
    const supervisor = await makeStaffUser('Cross-branch supervisor');

    const claimed = await context.run(
      staff(
        supervisor,
        [PERMISSIONS.PRICING_CLAIM, PERMISSIONS.PRICING_CROSS_BRANCH],
        'SOME-OTHER-BRANCH',
      ),
      () => pricing.claim(quoteId),
    );

    expect(claimed.claimedAt).toBeTruthy();
  });

  it('refuses a branchless specialist a single quote, as well as the queue', async () => {
    const quoteId = await makeQuote();
    const reader = await makeStaffUser('Branchless specialist');

    await expect(
      context.run(staff(reader, [PERMISSIONS.PRICING_QUEUE_READ], null), () =>
        pricing.detail(quoteId),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it('refuses every pricing entry point to a customer session', async () => {
    const quoteId = await makeQuote();
    const customer = {
      customerGroupId: groupId,
      userId: randomUUID(),
      isInternal: false,
      accountIds: [],
      // Deliberately generous: even holding the permission, the tenancy layer
      // must refuse, because a mis-seeded role must not become a data leak.
      permissions: new Set<string>([
        PERMISSIONS.PRICING_QUEUE_READ,
        PERMISSIONS.PRICING_CLAIM,
      ]),
      correlationId: `c3-${randomUUID()}`,
    };

    await expect(context.run(customer, () => pricing.queue())).rejects.toThrow();
    await expect(context.run(customer, () => pricing.claim(quoteId))).rejects.toThrow();
    await expect(context.run(customer, () => pricing.release(quoteId))).rejects.toThrow();
  });
});
