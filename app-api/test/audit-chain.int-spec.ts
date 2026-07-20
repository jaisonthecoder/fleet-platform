import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { AuditService } from '../src/modules/platform/services/audit.service';

/**
 * Integration proof of the tamper-evident audit log (P0-R2-1 / B-10). Requires
 * a live migrated database (DATABASE_URL). Run via `pnpm test:integration`; not
 * part of the unit job. Each test isolates itself with a unique organization_id
 * (the chain partitions by org), so it never depends on truncation.
 */
describe('audit_log hash chain (integration — requires DB)', () => {
  let ctx: INestApplicationContext;
  let audit: AuditService;
  let db: DrizzleDatabase;
  const organizationId = randomUUID();

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    audit = ctx.get(AuditService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('keeps the chain intact under concurrent appends (advisory lock, P0-R2-1)', async () => {
    const appends = 50;
    await Promise.all(
      Array.from({ length: appends }, (_, i) =>
        audit.record({
          organizationId,
          actorRef: `actor-${i}`,
          action: 'CONCURRENT_APPEND',
          entityRef: `entity-${i}`,
          after: { i },
        }),
      ),
    );

    const intact = await audit.verifyChain(organizationId);
    expect(intact).toBe(true);

    const rows = (await db.execute(
      sql`SELECT count(*)::int AS c FROM fleet.audit_log WHERE organization_id = ${organizationId}::uuid`,
    )) as unknown as Array<{ c: number }>;
    expect(rows[0]?.c).toBe(appends);
  });

  it('rejects UPDATE and DELETE — the log is append-only', async () => {
    await audit.record({
      organizationId,
      actorRef: 'actor-x',
      action: 'APPEND',
      entityRef: 'entity-x',
    });

    await expect(
      db.execute(
        sql`UPDATE fleet.audit_log SET reason = 'tamper' WHERE organization_id = ${organizationId}::uuid`,
      ),
    ).rejects.toBeDefined();

    await expect(
      db.execute(
        sql`DELETE FROM fleet.audit_log WHERE organization_id = ${organizationId}::uuid`,
      ),
    ).rejects.toBeDefined();
  });
});
