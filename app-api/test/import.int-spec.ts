import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { lookupType, lookupValue } from '../src/common/database/schema';
import { REDIS } from '../src/common/redis/redis.constants';
import type { Redis } from 'ioredis';
import { ImportService } from '../src/modules/migration/services/import.service';

/**
 * Integration proof of the bulk migration pipeline (M3). Requires a live DB +
 * Redis. Proves validation + dedup + reconciliation counts, the completeness
 * sign-off gate, commit-to-vehicle-master on sign-off, and steward resolve.
 */
describe('migration import (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let imports: ImportService;
  let db: DrizzleDatabase;
  let redis: Redis;

  const suffix = randomUUID().slice(0, 8);
  const platePrefix = `IMP-${suffix}`;
  const batchIds: string[] = [];

  const row = (n: number, over: Record<string, unknown> = {}) => ({
    plate: `${platePrefix}-${n}`,
    chassisVin: `IMPVIN-${suffix}-${n}`,
    bodyTypeCode: 'SEDAN',
    fuelTypeCode: 'PETROL',
    ...over,
  });

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    imports = ctx.get(ImportService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    redis = ctx.get<Redis>(REDIS);

    await db.insert(lookupType).values([
      { code: 'vehicle-body-type', labelEn: 'Body', labelAr: 'نوع', isSystem: true },
      { code: 'fuel-type', labelEn: 'Fuel', labelAr: 'وقود', isSystem: true },
    ]).onConflictDoNothing();
    const [bt] = await db.select().from(lookupType).where(eq(lookupType.code, 'vehicle-body-type'));
    const [ft] = await db.select().from(lookupType).where(eq(lookupType.code, 'fuel-type'));
    await db.insert(lookupValue).values([
      { lookupTypeId: bt.id, code: 'SEDAN', labelEn: 'Sedan', labelAr: 'سيدان' },
      { lookupTypeId: ft.id, code: 'PETROL', labelEn: 'Petrol', labelAr: 'بنزين' },
    ]).onConflictDoNothing();
    await redis.del('lookup:type:vehicle-body-type', 'lookup:type:fuel-type', 'lookup:type:use-category');
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.vehicle_lifecycle_history WHERE vehicle_id IN (SELECT id FROM fleet.vehicle WHERE plate LIKE ${`${platePrefix}%`})`);
    await db.execute(sql`DELETE FROM fleet.vehicle_hierarchy_assignment WHERE vehicle_id IN (SELECT id FROM fleet.vehicle WHERE plate LIKE ${`${platePrefix}%`})`);
    await db.execute(sql`DELETE FROM fleet.outbox_event WHERE aggregate_id IN (SELECT id::text FROM fleet.vehicle WHERE plate LIKE ${`${platePrefix}%`})`);
    await db.execute(sql`DELETE FROM fleet.vehicle WHERE plate LIKE ${`${platePrefix}%`}`);
    for (const id of batchIds) {
      await db.execute(sql`DELETE FROM fleet.dedup_candidate WHERE batch_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.import_row WHERE batch_id = ${id}`);
      await db.execute(sql`DELETE FROM fleet.import_batch WHERE id = ${id}`);
    }
    await ctx?.close();
  });

  it('validates + reconciles a mixed batch (valid / invalid / duplicate)', async () => {
    const batch = await imports.createBatch(
      {
        source: `mixed-${suffix}`,
        rows: [
          row(1),
          row(2),
          { chassisVin: 'no-plate', bodyTypeCode: 'SEDAN' }, // invalid: missing plate
          row(4, { plate: `${platePrefix}-1` }), // duplicate plate within batch
        ],
      },
      'steward',
    );
    batchIds.push(batch.id);
    expect(batch.totalRows).toBe(4);
    expect(batch.validRows).toBe(2);
    expect(batch.invalidRows).toBe(1);
    expect(batch.duplicateRows).toBe(1);
    expect(batch.completenessScore).toBe(50);
    expect(batch.status).toBe('Validated');
  });

  it('refuses sign-off below the completeness threshold', async () => {
    const batch = await imports.createBatch(
      { source: `low-${suffix}`, rows: [row(10), { bodyTypeCode: 'SEDAN' }] }, // one valid, one invalid = 50%
      'steward',
    );
    batchIds.push(batch.id);
    await expect(imports.signOff(batch.id, 'steward')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('commits valid rows to the vehicle master on sign-off (≥98%)', async () => {
    const batch = await imports.createBatch(
      { source: `clean-${suffix}`, rows: [row(20), row(21)] },
      'steward',
    );
    batchIds.push(batch.id);
    expect(batch.completenessScore).toBe(100);

    const signed = await imports.signOff(batch.id, 'steward');
    expect(signed.status).toBe('Committed');

    const created = await db.execute(
      sql`SELECT count(*)::int AS c FROM fleet.vehicle WHERE plate IN (${`${platePrefix}-20`}, ${`${platePrefix}-21`})`,
    );
    expect((created as unknown as Array<{ c: number }>)[0].c).toBe(2);

    const rows = await imports.listRows(batch.id);
    expect(rows.every((r) => r.status === 'Committed' && r.committedVehicleId)).toBe(true);
  });

  it('records a dedup candidate and lets a steward resolve a row', async () => {
    const batch = await imports.createBatch(
      { source: `dedup-${suffix}`, rows: [row(30), row(31, { plate: `${platePrefix}-30` })] },
      'steward',
    );
    batchIds.push(batch.id);
    expect(batch.duplicateRows).toBe(1);

    const candidates = await db.execute(sql`SELECT count(*)::int AS c FROM fleet.dedup_candidate WHERE batch_id = ${batch.id}`);
    expect((candidates as unknown as Array<{ c: number }>)[0].c).toBe(1);

    const rows = await imports.listRows(batch.id);
    const dup = rows.find((r) => r.status === 'Duplicate')!;
    const after = await imports.resolve(batch.id, { rowId: dup.id, action: 'reject' }, 'steward');
    expect(after.duplicateRows).toBe(0);
    expect(after.invalidRows).toBe(1);
  });
});
