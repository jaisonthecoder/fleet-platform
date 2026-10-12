import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';

/**
 * Temperature control and out-of-gauge pieces: tenancy, and the constraints.
 *
 * Both need a real database. The policies are `EXISTS` on the parent quote, and
 * the range checks are CHECK constraints - neither compiles into anything a unit
 * test can observe.
 */
describe('quote special handling isolation', () => {
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
    correlationId: `sh-${randomUUID()}`,
  });

  const staff = () => ({
    customerGroupId: null,
    userId: randomUUID(),
    isInternal: true,
    branchCode: null,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `sh-${randomUUID()}`,
  });

  const makeGroup = async (): Promise<string> => {
    const group = await owner.customerGroup.create({
      data: {
        name: `Handling ${randomUUID().slice(0, 8)}`,
        slug: `handling-${randomUUID().slice(0, 8)}`,
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
        originCode: 'ESVLC',
        destinationCode: 'NLRTM',
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
        temperatureControl: {
          create: {
            setPointCelsius: -25,
            toleranceCelsius: 1,
            ventilation: 'CLOSED',
            preCoolingRequired: true,
            updatedAt: new Date('2026-09-20T10:00:00.000Z'),
          },
        },
        oversizeItems: {
          create: {
            position: 1,
            description: 'Press frame',
            lengthCm: 1240, widthCm: 220, heightCm: 260, weightKg: 8400,
            liftingMethod: 'MOBILE_CRANE',
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

  it('shows both to the customer whose quote it is', async () => {
    const [temperature, pieces] = await context.run(customer(groupA), () =>
      repository.run(async (tx) => [
        await tx.quoteTemperatureControl.findUnique({ where: { quoteId: quoteA } }),
        await tx.quoteOversizeItem.findMany({ where: { quoteId: quoteA } }),
      ]),
    );

    expect(Number(temperature?.setPointCelsius)).toBe(-25);
    expect(pieces).toHaveLength(1);
  });

  it('hides both from another customer', async () => {
    const [temperature, pieces] = await context.run(customer(groupB), () =>
      repository.run(async (tx) => [
        await tx.quoteTemperatureControl.findUnique({ where: { quoteId: quoteA } }),
        await tx.quoteOversizeItem.findMany({ where: { quoteId: quoteA } }),
      ]),
    );

    expect(temperature).toBeNull();
    expect(pieces).toHaveLength(0);
  });

  it('lets staff read both, because pricing a reefer needs them', async () => {
    const [temperature, pieces] = await context.run(staff(), () =>
      repository.runInternal(async (tx) => [
        await tx.quoteTemperatureControl.findUnique({ where: { quoteId: quoteA } }),
        await tx.quoteOversizeItem.findMany({ where: { quoteId: quoteA } }),
      ]),
    );

    expect(temperature).not.toBeNull();
    expect(pieces).toHaveLength(1);
  });

  it('allows one temperature setting per quote and no more', async () => {
    await expect(
      owner.quoteTemperatureControl.create({
        data: { quoteId: quoteA, setPointCelsius: 4, updatedAt: new Date() },
      }),
    ).rejects.toThrow();
  });

  it.each([-100, 60])('refuses a set point of %s at the database', async (value) => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupA,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested', mode: 'sea',
        originCode: 'ESVLC', destinationCode: 'NLRTM', updatedAt: new Date(),
      },
      select: { id: true },
    });

    await expect(
      owner.quoteTemperatureControl.create({
        data: { quoteId: quote.id, setPointCelsius: value, updatedAt: new Date() },
      }),
    ).rejects.toThrow();

    await owner.quote.delete({ where: { id: quote.id } });
  });

  it('accepts a tolerance of zero', async () => {
    // Zero tolerance is a requirement, not a missing value.
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupA,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested', mode: 'sea',
        originCode: 'ESVLC', destinationCode: 'NLRTM', updatedAt: new Date(),
        temperatureControl: {
          create: { setPointCelsius: 4, toleranceCelsius: 0, updatedAt: new Date() },
        },
      },
      include: { temperatureControl: true },
    });

    expect(Number(quote.temperatureControl?.toleranceCelsius)).toBe(0);
    await owner.quote.delete({ where: { id: quote.id } });
  });

  it('refuses an oversize piece with a zero dimension', async () => {
    await expect(
      owner.quoteOversizeItem.create({
        data: {
          quoteId: quoteA, position: 9, description: 'Flat',
          lengthCm: 0, widthCm: 100, heightCm: 100, weightKg: 500,
          updatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('removes both when the quote goes', async () => {
    const quote = await owner.quote.create({
      data: {
        customerGroupId: groupA,
        reference: `Q-${randomUUID().slice(0, 8)}`,
        status: 'requested', mode: 'sea',
        originCode: 'ESVLC', destinationCode: 'NLRTM', updatedAt: new Date(),
        temperatureControl: { create: { setPointCelsius: 2, updatedAt: new Date() } },
        oversizeItems: {
          create: {
            position: 1, description: 'Beam',
            lengthCm: 900, widthCm: 60, heightCm: 60, weightKg: 1200,
            updatedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });

    await owner.quote.delete({ where: { id: quote.id } });

    expect(await owner.quoteTemperatureControl.count({ where: { quoteId: quote.id } })).toBe(0);
    expect(await owner.quoteOversizeItem.count({ where: { quoteId: quote.id } })).toBe(0);
  });

  it('seeds the three option lists the forms read', async () => {
    // Seeded by the migration, not by the catalogue script: a freshly migrated
    // database must render these forms with real choices.
    for (const code of ['reefer_ventilation', 'reefer_data_logger', 'lifting_method']) {
      const count = await owner.lookupItem.count({
        where: { category: { code }, isActive: true },
      });
      expect(count).toBeGreaterThan(0);
    }
  });
});
