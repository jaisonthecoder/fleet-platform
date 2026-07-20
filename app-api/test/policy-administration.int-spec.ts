import type { INestApplicationContext } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { policyDraft } from '../src/common/database/schema';
import type { AuthoredDecisionTable } from '../src/contracts/policy-authoring.contract';
import { PolicyAdministrationService } from '../src/modules/policy-administration/services/policy-administration.service';

const table = (version: string, value: number): AuthoredDecisionTable => ({
  schemaVersion: 1,
  ruleType: 'booking-buffer',
  version,
  scope: 'group',
  rows: [{
    id: 'executive',
    conditions: [{ id: 'vehicle-class', fact: 'vehicleClass', operator: 'eq', value: 'executive' }],
    decision: 'VALUE',
    reasons: ['buffer-executive'],
    value: 30,
  }],
  default: { decision: 'VALUE', reasons: ['buffer-default'], value },
});

describe('policy administration (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let service: PolicyAdministrationService;
  let db: DrizzleDatabase;
  let preExistingDraft: typeof policyDraft.$inferSelect | null = null;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    service = ctx.get(PolicyAdministrationService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    const existing = await db
      .select()
      .from(policyDraft)
      .where(eq(policyDraft.ruleType, 'booking-buffer'))
      .limit(1);
    preExistingDraft = existing[0] ?? null;
    await db.delete(policyDraft).where(eq(policyDraft.ruleType, 'booking-buffer'));
  });

  afterAll(async () => {
    await db.delete(policyDraft).where(eq(policyDraft.ruleType, 'booking-buffer'));
    if (preExistingDraft) {
      await db.insert(policyDraft).values(preExistingDraft);
    }
    await ctx?.close();
  });

  it('creates and updates a draft with optimistic revisions', async () => {
    const created = await service.saveDraft('00000000-0000-4000-8000-000000000001', 'booking-buffer', null, table('draft-v1', 15), 0, 'integration');
    expect(created.revision).toBe(1);

    const updated = await service.saveDraft('00000000-0000-4000-8000-000000000001', 'booking-buffer', null, table('draft-v2', 20), 1, 'integration');
    expect(updated.revision).toBe(2);
    expect(updated.table.default.value).toBe(20);

    await expect(
      service.saveDraft('00000000-0000-4000-8000-000000000001', 'booking-buffer', null, table('stale', 10), 1, 'integration'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('simulates the draft and returns the matched row without side effects', () => {
    expect(service.simulate(table('draft-v2', 20), { vehicleClass: 'executive' })).toMatchObject({
      decision: 'VALUE',
      value: 30,
      matchedRowId: 'executive',
    });
    expect(service.simulate(table('draft-v2', 20), { vehicleClass: 'pool' })).toMatchObject({
      decision: 'VALUE',
      value: 20,
      matchedRowId: null,
    });
  });

  it('projects active and draft status in the catalog', async () => {
    const catalog = await service.list('00000000-0000-4000-8000-000000000001');
    expect(catalog.find((item) => item.ruleType === 'booking-buffer')).toMatchObject({
      draftRevision: 2,
      status: 'Draft',
    });
  });
});
