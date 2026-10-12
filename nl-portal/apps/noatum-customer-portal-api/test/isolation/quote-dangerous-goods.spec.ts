import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';

/**
 * Dangerous goods rows inherit tenancy from their quote.
 *
 * This needs a real database. The rule is a Postgres policy with an EXISTS on the
 * parent quote, and an EXISTS policy is exactly the kind of thing that compiles,
 * reads correctly and still returns another customer's rows. A hazard leaking
 * across a tenant boundary would disclose what a competitor is shipping.
 */
describe('quote dangerous goods isolation', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;

  let groupA: string;
  let groupB: string;
  let quoteA: string;
  let dgA: string;

  const customer = (groupId: string) => ({
    customerGroupId: groupId,
    userId: randomUUID(),
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `dg-${randomUUID()}`,
  });

  const staff = () => ({
    customerGroupId: null,
    userId: randomUUID(),
    isInternal: true,
    branchCode: null,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `dg-${randomUUID()}`,
  });

  const makeGroup = async (): Promise<string> => {
    const group = await owner.customerGroup.create({
      data: {
        name: `DG ${randomUUID().slice(0, 8)}`,
        slug: `dg-${randomUUID().slice(0, 8)}`,
        status: 'active',
      },
    });
    return group.id;
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

    groupA = await makeGroup();
    groupB = await makeGroup();

    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupA,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        payload: { packages: [{ lineId: 'a', quantity: 6, packageType: 'drum', weightKg: 120 }] },
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
      },
      select: { id: true },
    });
    quoteA = quote.id;

    const entry = await owner.quoteDangerousGoods.create({
      data: {
        quoteId: quoteA,
        position: 1,
        unNumber: '1263',
        hazardClass: '3',
        properShippingName: 'Paint',
        packingGroup: 'III',
        appliesToLines: ['a'],
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
      },
      select: { id: true },
    });
    dgA = entry.id;
  });

  afterAll(async () => {
    await owner.quoteDangerousGoods.deleteMany({ where: { quoteId: quoteA } });
    await owner.quote.deleteMany({ where: { customerGroupId: { in: [groupA, groupB] } } });
    await owner.customerGroup.deleteMany({ where: { id: { in: [groupA, groupB] } } });
    await owner.$disconnect();
    await prisma.$disconnect();
  });

  it('shows an entry to the customer whose quote it is', async () => {
    const rows = await context.run(customer(groupA), () =>
      repository.run((tx) => tx.quoteDangerousGoods.findMany({ where: { quoteId: quoteA } })),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.unNumber).toBe('1263');
  });

  it('hides it from another customer', async () => {
    const rows = await context.run(customer(groupB), () =>
      repository.run((tx) => tx.quoteDangerousGoods.findMany({ where: { quoteId: quoteA } })),
    );

    expect(rows).toHaveLength(0);
  });

  it('refuses another customer an update, even naming the row directly', async () => {
    const changed = await context.run(customer(groupB), () =>
      repository.run((tx) =>
        tx.quoteDangerousGoods.updateMany({
          where: { id: dgA },
          data: { hazardClass: '9' },
        }),
      ),
    );

    expect(changed.count).toBe(0);

    const after = await owner.quoteDangerousGoods.findUnique({ where: { id: dgA } });
    expect(after?.hazardClass).toBe('3');
  });

  it('refuses another customer an insert against a quote they do not own', async () => {
    await expect(
      context.run(customer(groupB), () =>
        repository.run((tx) =>
          tx.quoteDangerousGoods.create({
            data: {
              quoteId: quoteA,
              position: 2,
              unNumber: '1993',
              hazardClass: '3',
              appliesToLines: ['a'],
              updatedAt: new Date(),
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it('lets staff read it, because pricing has to', async () => {
    const rows = await context.run(staff(), () =>
      repository.runInternal((tx) => tx.quoteDangerousGoods.findMany({ where: { quoteId: quoteA } })),
    );

    expect(rows).toHaveLength(1);
  });

  it('refuses a UN number that is not four digits, at the database', async () => {
    // The zod schema refuses it first. This proves the column would refuse it too,
    // so no future write path can store a malformed hazard identifier.
    await expect(
      owner.quoteDangerousGoods.create({
        data: {
          quoteId: quoteA,
          position: 3,
          unNumber: '63',
          hazardClass: '3',
          appliesToLines: ['a'],
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('allows an entry with no packing group', async () => {
    // Class 2 gases and class 7 never carry one.
    const entry = await owner.quoteDangerousGoods.create({
      data: {
        quoteId: quoteA,
        position: 4,
        unNumber: '1950',
        hazardClass: '2.1',
        appliesToLines: ['a'],
        updatedAt: new Date(),
      },
      select: { id: true, packingGroup: true },
    });

    expect(entry.packingGroup).toBeNull();
    await owner.quoteDangerousGoods.delete({ where: { id: entry.id } });
  });

  it('removes the entries when the quote goes', async () => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupA,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        updatedAt: new Date(),
        dangerousGoods: {
          create: {
            position: 1,
            unNumber: '1830',
            hazardClass: '8',
            appliesToLines: ['a'],
            updatedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    await owner.quote.delete({ where: { id: quote.id } });

    const orphans = await owner.quoteDangerousGoods.count({ where: { quoteId: quote.id } });
    expect(orphans).toBe(0);
  });
});
