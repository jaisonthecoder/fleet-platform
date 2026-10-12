import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';

/**
 * Equipment inherits tenancy from its quote, and its ids stay unambiguous.
 *
 * Needs a real database on both counts: the policy is an `EXISTS` on the parent
 * quote, and the unit-id uniqueness is an index. A collision there would let a
 * dangerous goods entry point at two different containers, which is the failure
 * the shared namespace was built to prevent.
 */
describe('quote equipment isolation', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;

  let groupA: string;
  let groupB: string;
  let quoteA: string;

  const customer = (groupId: string) => ({
    customerGroupId: groupId,
    userId: randomUUID(),
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `eq-${randomUUID()}`,
  });

  const staff = () => ({
    customerGroupId: null,
    userId: randomUUID(),
    isInternal: true,
    branchCode: null,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `eq-${randomUUID()}`,
  });

  const makeGroup = async (): Promise<string> => {
    const group = await owner.customerGroup.create({
      data: {
        name: `Equipment ${randomUUID().slice(0, 8)}`,
        slug: `equipment-${randomUUID().slice(0, 8)}`,
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
        loadType: 'FCL',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
        equipment: {
          create: {
            position: 1,
            unitId: 'c1',
            containerType: '40HC',
            quantity: 2,
            grossWeightPerUnitKg: 17_100,
            updatedAt: new Date('2026-09-20T10:00:00.000Z'),
          },
        },
      },
      select: { id: true },
    });
    quoteA = quote.id;
  });

  afterAll(async () => {
    await owner.quote.deleteMany({ where: { customerGroupId: { in: [groupA, groupB] } } });
    await owner.customerGroup.deleteMany({ where: { id: { in: [groupA, groupB] } } });
    await owner.$disconnect();
    await prisma.$disconnect();
  });

  it('shows the containers to the customer whose quote it is', async () => {
    const rows = await context.run(customer(groupA), () =>
      repository.run((tx) => tx.quoteEquipment.findMany({ where: { quoteId: quoteA } })),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.containerType).toBe('40HC');
    expect(Number(rows[0]?.grossWeightPerUnitKg)).toBe(17_100);
  });

  it('hides them from another customer', async () => {
    const rows = await context.run(customer(groupB), () =>
      repository.run((tx) => tx.quoteEquipment.findMany({ where: { quoteId: quoteA } })),
    );

    expect(rows).toHaveLength(0);
  });

  it('refuses another customer an insert against a quote they do not own', async () => {
    await expect(
      context.run(customer(groupB), () =>
        repository.run((tx) =>
          tx.quoteEquipment.create({
            data: {
              quoteId: quoteA, position: 2, unitId: 'c2',
              containerType: '20GP', quantity: 1, updatedAt: new Date(),
            },
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it('lets staff read them, because pricing per container needs the count', async () => {
    const rows = await context.run(staff(), () =>
      repository.runInternal((tx) => tx.quoteEquipment.findMany({ where: { quoteId: quoteA } })),
    );

    expect(rows).toHaveLength(1);
  });

  it('refuses two units sharing an id on one quote', async () => {
    await expect(
      owner.quoteEquipment.create({
        data: {
          quoteId: quoteA, position: 9, unitId: 'c1',
          containerType: '20GP', quantity: 1, updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses a quantity of zero at the database', async () => {
    await expect(
      owner.quoteEquipment.create({
        data: {
          quoteId: quoteA, position: 10, unitId: 'c9',
          containerType: '20GP', quantity: 0, updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('accepts a container with no stated weight', async () => {
    // A customer who does not yet know the load still gets a price.
    const row = await owner.quoteEquipment.create({
      data: {
        quoteId: quoteA, position: 11, unitId: 'c10',
        containerType: '20GP', quantity: 1, updatedAt: new Date(),
      },
      select: { id: true, grossWeightPerUnitKg: true },
    });

    expect(row.grossWeightPerUnitKg).toBeNull();
    await owner.quoteEquipment.delete({ where: { id: row.id } });
  });

  it('removes the containers when the quote goes', async () => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupA,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested',
        mode: 'sea',
        originCode: 'CNTAO',
        destinationCode: 'ESVLC',
        updatedAt: new Date(),
        equipment: {
          create: {
            position: 1, unitId: 'c1', containerType: '20GP',
            quantity: 1, updatedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    await owner.quote.delete({ where: { id: quote.id } });

    expect(await owner.quoteEquipment.count({ where: { quoteId: quote.id } })).toBe(0);
  });

  it('carries dimensions and an indicative payload on every container type', async () => {
    // The picker needs them to show what fits and to warn on an overload. A type
    // with no figures renders as a bare code, which is worse than not offering it.
    const rows = await owner.lookupItem.findMany({
      where: { category: { code: 'container_type' }, isActive: true },
      select: { code: true, metadata: true },
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const meta = row.metadata as { group?: string; maxPayloadKg?: number; lengthM?: number } | null;
      expect(meta?.group).toBeDefined();
      expect(meta?.maxPayloadKg).toBeGreaterThan(0);
    }
  });
});
