import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';

import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { ReferenceService } from '../../src/modules/reference/reference.service';

/**
 * Reference data: what each audience is allowed to see.
 *
 * This needs a real database. The rules being proved are a Prisma relation
 * filter, a JSON `metadata` comparison and an RLS read path - three things that
 * compile happily while returning the wrong rows, which is exactly the class of
 * bug that put a hard-coded array in three screens in the first place.
 */
describe('reference data', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let reference: ReferenceService;

  let groupId: string;
  let categoryId: string;
  const categoryCode = `test_ref_${randomUUID().slice(0, 8)}`;

  const staff = () => ({
    customerGroupId: null,
    userId: randomUUID(),
    isInternal: true,
    branchCode: null,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `ref-${randomUUID()}`,
  });

  const customer = () => ({
    customerGroupId: groupId,
    userId: randomUUID(),
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `ref-${randomUUID()}`,
  });

  const codes = async (
    actor: ReturnType<typeof staff> | ReturnType<typeof customer>,
    options: { locale?: string; mode?: string } = {},
  ): Promise<string[]> => {
    const items = await context.run(actor, () => reference.items(categoryCode, options));
    return items.map((item) => item.code);
  };

  const labels = async (
    actor: ReturnType<typeof staff> | ReturnType<typeof customer>,
    options: { locale?: string; mode?: string } = {},
  ): Promise<Record<string, string>> => {
    const items = await context.run(actor, () => reference.items(categoryCode, options));
    return Object.fromEntries(items.map((item) => [item.code, item.label]));
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
    reference = new ReferenceService(repository, context);

    const group = await owner.customerGroup.create({
      data: {
        name: `Reference ${randomUUID().slice(0, 8)}`,
        slug: `reference-${randomUUID().slice(0, 8)}`,
      },
    });
    groupId = group.id;

    const category = await owner.lookupCategory.create({
      data: {
        code: categoryCode,
        name: 'Reference test category',
        ownership: 'portal',
        defaultLocale: 'en-US',
      },
    });
    categoryId = category.id;

    const item = async (
      code: string,
      opts: {
        visible?: boolean;
        active?: boolean;
        sortOrder?: number;
        metadata?: Prisma.InputJsonValue;
        translations?: { locale: string; label: string }[];
      } = {},
    ) => {
      await owner.lookupItem.create({
        data: {
          categoryId,
          code,
          isActive: opts.active ?? true,
          isCustomerVisible: opts.visible ?? true,
          sortOrder: opts.sortOrder ?? 0,
          metadata: opts.metadata ?? {},
          updatedAt: new Date('2026-09-19T10:00:00.000Z'),
          translations: {
            create: opts.translations ?? [{ locale: 'en-US', label: `${code} label` }],
          },
        },
      });
    };

    await item('SEA_ONLY', { sortOrder: 1, metadata: { modes: ['sea'] } });
    await item('AIR_ONLY', { sortOrder: 2, metadata: { modes: ['air'] } });
    await item('ANY_MODE', { sortOrder: 3 });
    await item('EMPTY_MODES', { sortOrder: 4, metadata: { modes: [] } });
    await item('INTERNAL', { sortOrder: 5, visible: false });
    await item('RETIRED', { sortOrder: 6, active: false });
    await item('BILINGUAL', {
      sortOrder: 7,
      translations: [
        { locale: 'en-US', label: 'Bilingual' },
        { locale: 'es-ES', label: 'Bilingue' },
      ],
    });
    await item('SPANISH_ONLY', {
      sortOrder: 8,
      translations: [{ locale: 'es-ES', label: 'Solo espanol' }],
    });
  });

  afterAll(async () => {
    await owner.lookupItemTranslation.deleteMany({ where: { item: { categoryId } } });
    await owner.lookupItem.deleteMany({ where: { categoryId } });
    await owner.lookupCategory.deleteMany({ where: { id: categoryId } });
    await owner.customerGroup.deleteMany({ where: { id: groupId } });
    await owner.$disconnect();
    await prisma.$disconnect();
  });

  it('gives a customer only the items marked customer-visible', async () => {
    const seen = await codes(customer());

    expect(seen).not.toContain('INTERNAL');
    expect(seen).toContain('ANY_MODE');
  });

  it('gives staff the internal items too', async () => {
    const seen = await codes(staff());

    expect(seen).toContain('INTERNAL');
  });

  it('hides retired items from everyone', async () => {
    expect(await codes(staff())).not.toContain('RETIRED');
    expect(await codes(customer())).not.toContain('RETIRED');
  });

  it('narrows by mode, and keeps items that claim no mode', async () => {
    const sea = await codes(staff(), { mode: 'sea' });

    expect(sea).toContain('SEA_ONLY');
    expect(sea).not.toContain('AIR_ONLY');
    // An item with no modes recorded, or an empty list, is not a statement that
    // it applies to nothing. Both must survive the filter.
    expect(sea).toContain('ANY_MODE');
    expect(sea).toContain('EMPTY_MODES');
  });

  it('returns everything when no mode is asked for', async () => {
    const all = await codes(staff());

    expect(all).toEqual(expect.arrayContaining(['SEA_ONLY', 'AIR_ONLY', 'ANY_MODE']));
  });

  it('labels in the requested locale', async () => {
    expect((await labels(customer(), { locale: 'es-ES' })).BILINGUAL).toBe('Bilingue');
    expect((await labels(customer(), { locale: 'en-US' })).BILINGUAL).toBe('Bilingual');
  });

  it('falls back to another translation rather than showing a bare code', async () => {
    // Only Spanish exists. An English reader should still read a word.
    expect((await labels(customer(), { locale: 'en-US' })).SPANISH_ONLY).toBe('Solo espanol');
  });

  it('keeps the administrator ordering', async () => {
    const seen = await codes(staff());
    const ordered = ['SEA_ONLY', 'AIR_ONLY', 'ANY_MODE', 'EMPTY_MODES', 'INTERNAL', 'BILINGUAL'];

    expect(seen.filter((code) => ordered.includes(code))).toEqual(ordered);
  });
});
