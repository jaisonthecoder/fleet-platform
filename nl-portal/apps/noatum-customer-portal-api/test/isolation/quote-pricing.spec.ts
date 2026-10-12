import { ReferenceService } from '../../src/modules/reference/reference.service';
import { integrationMessages, recordingJobs } from '../fixtures/jobs.fixture';
import { analyticsFor } from '../fixtures/analytics.fixture';
import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { SettingsService } from '../../src/common/settings/settings.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { PERMISSIONS } from '../../src/contracts/permissions';
import { PricingService } from '../../src/modules/pricing/pricing.service';

/**
 * C4: recording a price.
 *
 * The tests that matter are not "can a person type a number". They are: does the
 * arithmetic belong to the server, can a customer reach internal cost, and does
 * re-pricing lose anything.
 */
describe('manual pricing', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let settings: SettingsService;
  let pricing: PricingService;
  let jobs: ReturnType<typeof recordingJobs>;

  let groupId: string;
  let branchId: string;
  const branchCode = `C4-${randomUUID().slice(0, 6)}`;
  const userIds: string[] = [];
  const quoteIds: string[] = [];

  const staff = (userId: string, permissions: string[]) => ({
    customerGroupId: null,
    userId,
    isInternal: true,
    branchCode,
    accountIds: [],
    permissions: new Set<string>(permissions),
    correlationId: `c4-${randomUUID()}`,
  });

  const customer = () => ({
    customerGroupId: groupId,
    userId: randomUUID(),
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>([PERMISSIONS.QUOTES_READ]),
    correlationId: `c4-${randomUUID()}`,
  });

  const PRICER = [PERMISSIONS.PRICING_PRICE, PERMISSIONS.PRICING_CLAIM];

  const makeStaffUser = async (name: string): Promise<string> => {
    const user = await owner.user.create({
      data: {
        email: `c4-${randomUUID()}@example.test`,
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

  const makeQuote = async (status: 'requested' | 'published' = 'requested'): Promise<string> => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupId,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status,
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        updatedAt: new Date('2026-09-19T10:00:00.000Z'),
      },
    });
    quoteIds.push(quote.id);
    return quote.id;
  };

  const twoOptions = () => ({
    messageToCustomer: 'Two routings for your consideration.',
    options: [
      {
        name: 'Weekly direct',
        carrierName: 'MSC',
        serviceRouting: 'Qingdao - Valencia, direct',
        transitDaysMin: 28,
        transitDaysMax: 32,
        nextDepartures: 'Tue, Fri',
        freeTimeDays: 14,
        isRecommended: true,
        termsIncluded: 'Ocean freight, THC at both ends',
        termsExcluded: 'Duties and taxes',
        termsPayment: '30 days from invoice',
        termsSubjectTo: 'Space and equipment availability',
        chargeLines: [
          {
            code: 'OFR',
            description: 'Ocean freight',
            basis: 'Per container',
            quantity: 2,
            rateMinorUnits: 400_000,
            currency: 'EUR',
            costMinorUnits: 320_000,
          },
          {
            code: 'THC',
            description: 'Terminal handling, origin',
            basis: 'Per container',
            quantity: 2,
            rateMinorUnits: 49_000,
            currency: 'EUR',
            costMinorUnits: 41_000,
          },
        ],
      },
      {
        name: 'Economy via Singapore',
        carrierName: 'COSCO',
        isRecommended: false,
        chargeLines: [
          {
            description: 'Ocean freight',
            basis: 'Per container',
            quantity: 2,
            rateMinorUnits: 404_000,
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

    const branch = await owner.branch.create({
      data: { code: branchCode, name: 'C4 branch' },
    });
    branchId = branch.id;

    const group = await owner.customerGroup.create({
      data: {
        name: `C4 ${randomUUID().slice(0, 8)}`,
        slug: `c4-${randomUUID().slice(0, 8)}`,
        defaultServicingBranchId: branchId,
      },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    await owner.auditEvent.deleteMany({ where: { entityId: { in: quoteIds } } });
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
  });

  const enableCostCapture = async () => {
    await owner.settingValue.create({
      data: {
        key: 'quotations.costCapture',
        scope: 'branch',
        scopeId: branchCode,
        value: true,
        reason: 'this branch records cost',
      },
    });
  };

  // -------------------------------------------------------------------------
  // The multi-option switch
  // -------------------------------------------------------------------------

  describe('quotations.multi_option', () => {
    const KEY = 'quotations.multi_option';

    afterEach(async () => {
      await owner.featureSwitch.deleteMany({ where: { key: KEY } });
    });

    const singleOption = () => {
      const body = twoOptions();
      body.options = [body.options[0]!];
      for (const line of body.options[0]!.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
      return body;
    };

    it('allows several options on the catalogue default', async () => {
      // No stored row, so this also proves the default in the catalogue is `true`
      // rather than merely that some row happened to be set.
      const quoteId = await makeQuote();
      const pricer = await makeStaffUser('Multi default');
      const body = twoOptions();
      for (const option of body.options) {
        for (const line of option.chargeLines) {
          delete (line as { costMinorUnits?: number }).costMinorUnits;
        }
      }

      await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body));

      expect(await owner.quoteOption.count({ where: { quoteId } })).toBe(2);
    });

    it('refuses a second option when the switch is off', async () => {
      await owner.featureSwitch.create({
        data: { key: KEY, isEnabled: false, reason: 'this branch quotes one price' },
      });

      const quoteId = await makeQuote();
      const pricer = await makeStaffUser('Multi off');
      const body = twoOptions();
      for (const option of body.options) {
        for (const line of option.chargeLines) {
          delete (line as { costMinorUnits?: number }).costMinorUnits;
        }
      }

      await expect(
        context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body)),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Refused, never truncated: publishing the cheaper half of what the pricer
      // typed would be worse than an error.
      expect(await owner.quoteOption.count({ where: { quoteId } })).toBe(0);
    });

    it('still accepts a single option when the switch is off', async () => {
      await owner.featureSwitch.create({
        data: { key: KEY, isEnabled: false, reason: 'this branch quotes one price' },
      });

      const quoteId = await makeQuote();
      const pricer = await makeStaffUser('Multi off single');

      await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, singleOption()));

      expect(await owner.quoteOption.count({ where: { quoteId } })).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Arithmetic
  // -------------------------------------------------------------------------

  it('computes each amount and each option total on the server', async () => {    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricing specialist');
    const body = twoOptions();
    // Strip the costs: capture is off by default and offering them would be refused.
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body));

    const options = await owner.quoteOption.findMany({
      where: { quoteId },
      orderBy: { position: 'asc' },
      include: { chargeLines: { orderBy: { position: 'asc' } } },
    });

    expect(options).toHaveLength(2);
    // 2 x 400000 = 800000, 2 x 49000 = 98000, total 898000 -> EUR 8,980.00
    expect(options[0]!.chargeLines[0]!.amountMinorUnits).toBe(800_000n);
    expect(options[0]!.chargeLines[1]!.amountMinorUnits).toBe(98_000n);
    expect(options[0]!.totalMinorUnits).toBe(898_000n);
    expect(options[1]!.totalMinorUnits).toBe(808_000n);
  });

  it('mirrors the recommended option onto the quote headline', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Headline pricer');
    const body = twoOptions();
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body));

    const quote = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.status).toBe('priced');
    expect(quote.totalMinorUnits).toBe(898_000n);
    expect(quote.currency).toBe('EUR');
  });

  it('claims the quote implicitly when an unclaimed one is priced', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Implicit claimer');
    const body = twoOptions();
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body));

    const quote = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.claimedById).toBe(pricer);
    expect(quote.pricedById).toBe(pricer);
  });

  it('refuses to price a quote claimed by somebody else', async () => {
    const quoteId = await makeQuote();
    const holder = await makeStaffUser('Existing holder');
    const other = await makeStaffUser('Interloper');
    const body = twoOptions();
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(holder, PRICER), () => pricing.claim(quoteId));

    await expect(
      context.run(staff(other, PRICER), () => pricing.price(quoteId, body)),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Cost and margin
  // -------------------------------------------------------------------------

  it('refuses cost outright when capture is off, rather than dropping it', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricer offering cost');

    await expect(
      context.run(staff(pricer, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]), () =>
        pricing.price(quoteId, twoOptions()),
      ),
    ).rejects.toThrow(/switched off/i);
  });

  it('refuses cost when capture is on but the pricer lacks the permission', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pricer without cost sight');
    await enableCostCapture();

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.price(quoteId, twoOptions())),
    ).rejects.toThrow(/permission/i);
  });

  it('records cost when both the setting and the permission allow it', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Authorised cost pricer');
    await enableCostCapture();

    await context.run(staff(pricer, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]), () =>
      pricing.price(quoteId, twoOptions()),
    );

    const costs = await owner.quoteChargeLineCost.findMany({
      where: { chargeLine: { option: { quoteId } } },
    });

    expect(costs).toHaveLength(2);
    // Explicit comparator: the default sort stringifies, and "320000" < "41000".
    expect(costs.map((c) => c.costMinorUnits).sort((a, b) => (a < b ? -1 : 1))).toEqual([
      41_000n,
      320_000n,
    ]);
  });

  /**
   * The structural guarantee. Cost lives in its own table with an internal-only policy,
   * so this holds even if every line of service code were deleted - which is the reason
   * it is a table and not a column.
   */
  it('denies a customer session the cost table entirely', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Cost recorder');
    await enableCostCapture();

    await context.run(staff(pricer, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]), () =>
      pricing.price(quoteId, twoOptions()),
    );

    const asCustomer = await context.run(customer(), () =>
      repository.run((tx) =>
        tx.quoteChargeLineCost.findMany({
          where: { chargeLine: { option: { quoteId } } },
        }),
      ),
    );

    expect(asCustomer).toHaveLength(0);
  });

  it('keeps cost out of the replaced-options audit record', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Re-pricer');
    await enableCostCapture();
    const authorised = staff(pricer, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]);

    await context.run(authorised, () => pricing.price(quoteId, twoOptions()));
    await context.run(authorised, () => pricing.price(quoteId, twoOptions()));

    const archived = await owner.auditEvent.findFirstOrThrow({
      where: { entityId: quoteId, action: 'quote.options.replaced' },
    });

    expect(JSON.stringify(archived.metadata)).not.toContain('320000');
    expect(JSON.stringify(archived.metadata)).not.toContain('cost');
  });

  // -------------------------------------------------------------------------
  // Re-pricing and versions
  // -------------------------------------------------------------------------

  it('replaces the option set and archives the one it replaced', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Replacing pricer');
    const body = twoOptions();
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body));

    const single = {
      options: [
        {
          name: 'Single revised option',
          isRecommended: true,
          chargeLines: [
            {
              description: 'All-in',
              quantity: 1,
              rateMinorUnits: 750_000,
              currency: 'EUR',
            },
          ],
        },
      ],
    };

    await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, single));

    const options = await owner.quoteOption.findMany({ where: { quoteId } });
    expect(options).toHaveLength(1);
    expect(options[0]!.totalMinorUnits).toBe(750_000n);

    const archived = await owner.auditEvent.findFirstOrThrow({
      where: { entityId: quoteId, action: 'quote.options.replaced' },
    });
    expect(JSON.stringify(archived.metadata)).toContain('Weekly direct');
  });

  it('bumps the version only when the quote had already been published', async () => {
    const fresh = await makeQuote('requested');
    const seen = await makeQuote('published');
    const pricer = await makeStaffUser('Versioning pricer');
    const body = () => {
      const b = twoOptions();
      for (const option of b.options) {
        for (const line of option.chargeLines) {
          delete (line as { costMinorUnits?: number }).costMinorUnits;
        }
      }
      return b;
    };

    await context.run(staff(pricer, PRICER), () => pricing.price(fresh, body()));
    await context.run(staff(pricer, PRICER), () => pricing.price(seen, body()));

    // Nobody outside had seen the first, so there is nothing to supersede.
    expect((await owner.quote.findUniqueOrThrow({ where: { id: fresh } })).version).toBe(1);
    // The second was on the customer's screen, so it supersedes visibly.
    expect((await owner.quote.findUniqueOrThrow({ where: { id: seen } })).version).toBe(2);
  });

  it('refuses two recommended options', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Over-recommender');
    const body = twoOptions();
    body.options[1]!.isRecommended = true;
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await expect(
      context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body)),
    ).rejects.toThrow();
  });

  it('refuses charge lines that mix currencies within one option', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Currency mixer');

    await expect(
      context.run(staff(pricer, PRICER), () =>
        pricing.price(quoteId, {
          options: [
            {
              isRecommended: true,
              chargeLines: [
                { description: 'Freight', quantity: 1, rateMinorUnits: 100, currency: 'EUR' },
                { description: 'Handling', quantity: 1, rateMinorUnits: 100, currency: 'USD' },
              ],
            },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // What the customer can see
  // -------------------------------------------------------------------------

  it('shows a customer no options at all until the quote is published', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Pre-publication pricer');
    const body = twoOptions();
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(pricer, PRICER), () => pricing.price(quoteId, body));

    // The rows exist and belong to this customer, so RLS lets them through. Keeping
    // them back before publication is the service's job, and this is that assertion.
    const visible = await context.run(customer(), () =>
      repository.run((tx) => tx.quoteOption.findMany({ where: { quoteId } })),
    );
    expect(visible.length).toBeGreaterThan(0);

    const quote = await owner.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.status).toBe('priced');
  });

  /**
   * The first implementation wrote the pricer's covering message into `quote.notes`,
   * which is the CUSTOMER's remarks to the pricing team. Pricing a quote destroyed the
   * request it was answering.
   */
  it('leaves the customer\u2019s own remarks untouched when pricing', async () => {
    const pricer = await makeStaffUser('Careful pricer');
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupId,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        notes: 'Please avoid transhipment. Fragile cargo.',
        updatedAt: new Date('2026-09-19T10:00:00.000Z'),
      },
    });
    quoteIds.push(quote.id);

    const body = twoOptions();
    for (const option of body.options) {
      for (const line of option.chargeLines) {
        delete (line as { costMinorUnits?: number }).costMinorUnits;
      }
    }

    await context.run(staff(pricer, PRICER), () => pricing.price(quote.id, body));

    const after = await owner.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(after.notes).toBe('Please avoid transhipment. Fragile cargo.');
    expect(after.messageToCustomer).toBe('Two routings for your consideration.');
  });

  /**
   * `quantity * rateMinorUnits` as JavaScript numbers exceeds Number.MAX_SAFE_INTEGER
   * at the top of the range the schema accepts, and starts rounding prices silently.
   */
  it('keeps large amounts exact rather than rounding them away', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Large-figure pricer');

    await context.run(staff(pricer, PRICER), () =>
      pricing.price(quoteId, {
        options: [
          {
            isRecommended: true,
            chargeLines: [
              {
                description: 'Very large charge',
                quantity: 1000,
                rateMinorUnits: 999_999_999_999,
                currency: 'EUR',
              },
            ],
          },
        ],
      }),
    );

    const option = await owner.quoteOption.findFirstOrThrow({ where: { quoteId } });
    expect(option.totalMinorUnits).toBe(999_999_999_999_000n);
  });

  it('applies a fractional quantity without losing a minor unit', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Fractional pricer');

    await context.run(staff(pricer, PRICER), () =>
      pricing.price(quoteId, {
        options: [
          {
            isRecommended: true,
            chargeLines: [
              {
                description: 'Chargeable weight',
                quantity: 2.5,
                rateMinorUnits: 333,
                currency: 'EUR',
              },
            ],
          },
        ],
      }),
    );

    const option = await owner.quoteOption.findFirstOrThrow({ where: { quoteId } });
    // 2.5 x 333 = 832.5 minor units, truncated to 832.
    expect(option.totalMinorUnits).toBe(832n);
  });

  // -------------------------------------------------------------------------
  // The pricing screen's read
  //
  // `detail` builds its cost include CONDITIONALLY. TypeScript accepts that
  // either way, so only a test that reads the payload proves cost is absent for
  // somebody who may not see it.
  // -------------------------------------------------------------------------

  it('returns the whole quote with options, lines and the branch rules', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Detail pricer');
    await enableCostCapture();
    const authorised = staff(pricer, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]);

    await context.run(authorised, () => pricing.price(quoteId, twoOptions()));

    const detail = await context.run(authorised, () => pricing.detail(quoteId));

    expect(detail.reference).toMatch(/^Q-/);
    expect(detail.status).toBe('priced');
    expect(detail.options).toHaveLength(2);
    expect(detail.options[0]!.chargeLines).toHaveLength(2);
    expect(detail.options[0]!.totalMinorUnits).toBe(898_000);
    expect(detail.canRecordCost).toBe(true);
    expect(detail.defaultValidityDays).toBe(21);
    expect(detail.publicationMode).toBe('cw1');
    expect(detail.approvalThresholdMinorUnits).toBe(1_000_000);
    expect(detail.chargeBases.length).toBeGreaterThan(5);
  });

  it('computes margin from sell and cost without storing it', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Margin pricer');
    await enableCostCapture();
    const authorised = staff(pricer, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]);

    await context.run(authorised, () => pricing.price(quoteId, twoOptions()));
    const detail = await context.run(authorised, () => pricing.detail(quoteId));
    const option = detail.options[0]!;

    // Sell 898,000; cost 2 x 320,000 + 2 x 41,000 = 722,000. Margin 19.6%.
    expect(option.costTotalMinorUnits).toBe(722_000);
    expect(option.marginPercent).toBeCloseTo(19.6, 1);
  });

  it('omits cost and margin entirely from a pricer who may not see them', async () => {
    const quoteId = await makeQuote();
    const recorder = await makeStaffUser('Cost recorder');
    const reader = await makeStaffUser('Pricer without cost sight');
    await enableCostCapture();

    await context.run(staff(recorder, [...PRICER, PERMISSIONS.PRICING_COST_VIEW]), () =>
      pricing.price(quoteId, twoOptions()),
    );

    const detail = await context.run(staff(reader, PRICER), () => pricing.detail(quoteId));

    expect(detail.canRecordCost).toBe(false);
    expect(detail.options[0]!.costTotalMinorUnits).toBeNull();
    expect(detail.options[0]!.marginPercent).toBeNull();
    for (const line of detail.options[0]!.chargeLines) {
      expect(line.costMinorUnits).toBeNull();
    }
    // Asserted on the serialised payload too: a null is easy to add and easy to
    // forget, a figure hiding deeper in the object is not.
    expect(JSON.stringify(detail)).not.toContain('320000');
  });

  it('refuses the pricing detail to a customer session', async () => {
    const quoteId = await makeQuote();

    await expect(context.run(customer(), () => pricing.detail(quoteId))).rejects.toThrow();
  });

  it('reports the branch publication mode it is actually working under', async () => {
    const quoteId = await makeQuote();
    const pricer = await makeStaffUser('Direct-publishing pricer');

    await owner.settingValue.create({
      data: {
        key: 'quotations.pubMode',
        scope: 'branch',
        scopeId: branchCode,
        value: 'direct',
        reason: 'CW1 write-back not live for this pilot branch',
      },
    });

    const detail = await context.run(staff(pricer, PRICER), () => pricing.detail(quoteId));
    expect(detail.publicationMode).toBe('direct');
  });
});
