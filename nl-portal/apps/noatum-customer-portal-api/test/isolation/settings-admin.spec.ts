import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { FeatureSwitchService } from '../../src/common/features/feature-switch.service';
import { SettingsService } from '../../src/common/settings/settings.service';
import { PrismaService } from '../../src/common/tenancy/prisma.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { TenantRepository } from '../../src/common/tenancy/tenant.repository';
import { SettingsAdminService } from '../../src/modules/settings/settings-admin.service';

/**
 * ADR-010, the half that was missing.
 *
 * For one slice the catalogue, the table, the RLS and the resolver all existed
 * while no administrator could change anything - so every value sat at its code
 * default and the pilot-branch override the business had already drawn was
 * impossible. These tests exist so that cannot silently happen again.
 */
describe('settings administration', () => {
  let owner: PrismaClient;
  let prisma: PrismaService;
  let repository: TenantRepository;
  let context: TenantContext;
  let settings: SettingsService;
  let admin: SettingsAdminService;

  const branchCode = `SA-${randomUUID().slice(0, 6)}`;
  const regionCode = `SR-${randomUUID().slice(0, 6)}`;
  let userId: string;

  const staff = () => ({
    customerGroupId: null,
    userId,
    isInternal: true,
    branchCode,
    regionCode,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `sa-${randomUUID()}`,
  });

  const customer = () => ({
    customerGroupId: null,
    userId,
    isInternal: false,
    accountIds: [],
    permissions: new Set<string>(),
    correlationId: `sa-${randomUUID()}`,
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
    admin = new SettingsAdminService(repository, context, settings);

    const user = await owner.user.create({
      data: {
        email: `sa-${randomUUID()}@example.test`,
        displayName: 'Settings administrator',
        isInternal: true,
        status: 'active',
        updatedAt: new Date('2026-09-19T10:00:00.000Z'),
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await owner.auditEvent.deleteMany({ where: { entityType: 'setting' } });
    await owner.settingValue.deleteMany({ where: { key: { startsWith: 'quotations.' } } });
    await owner.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    await owner.$disconnect();
  });

  beforeEach(async () => {
    await owner.settingValue.deleteMany({ where: { key: { startsWith: 'quotations.' } } });
    await owner.auditEvent.deleteMany({ where: { entityType: 'setting' } });
  });

  it('writes a value and reads it back through the resolver', async () => {
    await context.run(staff(), () =>
      admin.set('quotations.claimExpiry', {
        scope: 'branch',
        scopeId: branchCode,
        value: 8,
        reason: 'This branch works a longer shift',
      }),
    );

    const resolved = await settings.resolve('quotations.claimExpiry', { branchCode });
    expect(resolved.value).toBe(8);
    expect(resolved.source).toBe('branch');
    expect(resolved.sourceId).toBe(branchCode);
  });

  it('records the change with its before, after and reason', async () => {
    await context.run(staff(), () =>
      admin.set('quotations.threshold', {
        scope: 'region',
        scopeId: regionCode,
        value: 15_000,
        reason: 'Iberia signs off higher',
      }),
    );

    const entry = await owner.auditEvent.findFirstOrThrow({
      where: { entityType: 'setting', entityId: 'quotations.threshold' },
    });

    expect(entry.action).toBe('setting.changed');
    expect(entry.actorUserId).toBe(userId);
    expect(entry.metadata).toMatchObject({
      scope: 'region',
      scopeId: regionCode,
      before: null,
      after: 15_000,
      reason: 'Iberia signs off higher',
    });
  });

  it('updates rather than duplicating when the same layer is set twice', async () => {
    const write = (value: number) =>
      context.run(staff(), () =>
        admin.set('quotations.validity', {
          scope: 'branch',
          scopeId: branchCode,
          value,
          reason: 'Adjusting validity',
        }),
      );

    await write(30);
    await write(14);

    const rows = await owner.settingValue.findMany({
      where: { key: 'quotations.validity', scope: 'branch', scopeId: branchCode },
    });

    // One row, not two. A second row would make the resolver pick arbitrarily.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(14);
  });

  it('refuses a value the catalogue does not allow', async () => {
    await expect(
      context.run(staff(), () =>
        admin.set('quotations.claimExpiry', {
          scope: 'global',
          scopeId: null,
          value: 9000,
          reason: 'Out of range',
        }),
      ),
    ).rejects.toThrow();

    await expect(
      context.run(staff(), () =>
        admin.set('quotations.pubMode', {
          scope: 'global',
          scopeId: null,
          value: 'whenever',
          reason: 'Not an option',
        }),
      ),
    ).rejects.toThrow();
  });

  it('refuses a change with no reason', async () => {
    await expect(
      context.run(staff(), () =>
        admin.set('quotations.approval', { scope: 'global', scopeId: null, value: false, reason: '  ' }),
      ),
    ).rejects.toThrow();
  });

  it('refuses a scoped change that names no scope, and a global one that does', async () => {
    await expect(
      context.run(staff(), () =>
        admin.set('quotations.approval', { scope: 'branch', scopeId: null, value: false, reason: 'No branch given' }),
      ),
    ).rejects.toThrow();

    await expect(
      context.run(staff(), () =>
        admin.set('quotations.approval', { scope: 'global', scopeId: branchCode, value: false, reason: 'Global with a branch' }),
      ),
    ).rejects.toThrow();
  });

  it('refuses a key that is not in the catalogue', async () => {
    await expect(
      context.run(staff(), () =>
        admin.set('quotations.inventedKey', { scope: 'global', scopeId: null, value: true, reason: 'Made up' }),
      ),
    ).rejects.toThrow();
  });

  it('clears an override so the layer below applies again', async () => {
    await context.run(staff(), () =>
      admin.set('quotations.validity', { scope: 'global', scopeId: null, value: 45, reason: 'Global' }),
    );
    await context.run(staff(), () =>
      admin.set('quotations.validity', { scope: 'branch', scopeId: branchCode, value: 7, reason: 'Branch' }),
    );

    expect((await settings.resolve('quotations.validity', { branchCode })).value).toBe(7);

    await context.run(staff(), () =>
      admin.clear('quotations.validity', 'branch', branchCode, 'Back to the global figure'),
    );

    const after = await settings.resolve('quotations.validity', { branchCode });
    expect(after.value).toBe(45);
    expect(after.source).toBe('global');

    await owner.auditEvent.findFirstOrThrow({
      where: { entityType: 'setting', action: 'setting.cleared' },
    });
  });

  it('lists the catalogue with the effective value and every override', async () => {
    await context.run(staff(), () =>
      admin.set('quotations.costCapture', { scope: 'branch', scopeId: branchCode, value: true, reason: 'This branch records cost' }),
    );

    const rows = await context.run(staff(), () => admin.list({ branchCode }));
    const entry = rows.find((row) => row.key === 'quotations.costCapture')!;

    expect(entry.effective.value).toBe(true);
    expect(entry.effective.source).toBe('branch');
    expect(entry.defaultValue).toBe(false);
    expect(entry.overrides).toHaveLength(1);
    expect(entry.overrides[0]!.valid).toBe(true);

    // Every catalogue key is present, not only the overridden one.
    expect(rows.length).toBeGreaterThanOrEqual(12);
  });

  it('shows a stored value that no longer fits the catalogue as invalid', async () => {
    await owner.settingValue.create({
      data: {
        key: 'quotations.claimExpiry',
        scope: 'branch',
        scopeId: branchCode,
        value: 9000,
        reason: 'Written before the bounds tightened',
      },
    });

    const rows = await context.run(staff(), () => admin.list({ branchCode }));
    const entry = rows.find((row) => row.key === 'quotations.claimExpiry')!;

    expect(entry.overrides[0]!.valid).toBe(false);
    // And the resolver ignores it rather than failing the branch.
    expect(entry.effective.source).toBe('default');
    expect(entry.effective.value).toBe(4);
  });

  it('refuses every entry point to a customer session', async () => {
    await expect(context.run(customer(), () => admin.list({}))).rejects.toThrow();
    await expect(context.run(customer(), () => admin.history())).rejects.toThrow();
    await expect(
      context.run(customer(), () =>
        admin.set('quotations.approval', { scope: 'global', scopeId: null, value: false, reason: 'Should never land' }),
      ),
    ).rejects.toThrow();
    await expect(
      context.run(customer(), () => admin.clear('quotations.approval', 'global', null, 'Should never land')),
    ).rejects.toThrow();
  });

  it('walks all four layers in order, most specific winning', async () => {
    const set = (scope: 'global' | 'region' | 'branch', scopeId: string | null, value: number) =>
      context.run(staff(), () =>
        admin.set('quotations.threshold', { scope, scopeId, value, reason: `${scope} figure` }),
      );

    await set('global', null, 10_000);
    expect((await settings.resolve('quotations.threshold', { regionCode, branchCode })).source).toBe('global');

    await set('region', regionCode, 15_000);
    expect((await settings.resolve('quotations.threshold', { regionCode, branchCode })).value).toBe(15_000);

    await set('branch', branchCode, 25_000);
    const final = await settings.resolve('quotations.threshold', { regionCode, branchCode });
    expect(final.value).toBe(25_000);
    expect(final.source).toBe('branch');

    // A different branch in the same region still gets the region figure.
    expect((await settings.resolve('quotations.threshold', { regionCode, branchCode: 'OTHER' })).value).toBe(15_000);
  });
});
