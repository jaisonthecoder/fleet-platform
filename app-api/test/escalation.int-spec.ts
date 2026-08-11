import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { DEFAULT_ORGANIZATION_ID } from '../src/common/database/schema';
import { ESCALATION_WORK_TYPE, EscalationService } from '../src/common/escalation/escalation.service';

describe('escalation idempotency (integration)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;
  let escalation: EscalationService;
  const subjectRef = `eligibility:${randomUUID()}`;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    escalation = ctx.get(EscalationService);
  });

  afterAll(async () => {
    await db.execute(sql`DELETE FROM fleet.scheduled_work WHERE organization_id = ${DEFAULT_ORGANIZATION_ID}::uuid AND subject_ref = ${subjectRef}`);
    await ctx?.close();
  });

  it('creates one pending work row for repeated identical fail-safe requests', async () => {
    const request = {
      organizationId: DEFAULT_ORGANIZATION_ID,
      workType: ESCALATION_WORK_TYPE.pdpFailSafe,
      subjectRef,
      reason: 'eligibility-policy-unavailable',
      correlationId: subjectRef,
    };
    const first = await escalation.escalate(request);
    const replay = await escalation.escalate(request);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(replay).toBeNull();
    const rows = await db.execute(sql`
      SELECT count(*)::int AS count FROM fleet.scheduled_work
      WHERE organization_id = ${DEFAULT_ORGANIZATION_ID}::uuid
        AND work_type = ${ESCALATION_WORK_TYPE.pdpFailSafe}
        AND subject_ref = ${subjectRef}
        AND status = 'Pending'
    `) as unknown as Array<{ count: number }>;
    expect(rows[0]?.count).toBe(1);
  });
});