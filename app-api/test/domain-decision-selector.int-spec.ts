import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { domainDecisionSelector } from '../src/common/database/schema';
import { DomainDecisionSelectorService } from '../src/modules/policy/services/domain-decision.service';

const organizationId = '00000000-0000-4000-8000-000000000001';
const clusterId = 'a0000000-0000-4000-8000-000000000002';
const poolId = 'a0000000-0000-4000-8000-000000000003';
const locationId = 'a0000000-0000-4000-8000-000000000004';

describe('domain decision selector (integration — requires DB)', () => {
  let ctx: INestApplicationContext;
  let db: DrizzleDatabase;
  let selector: DomainDecisionSelectorService;
  const decisionKey = `selector-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    selector = ctx.get(DomainDecisionSelectorService);
  });

  afterAll(async () => {
    await db.delete(domainDecisionSelector).where(
      and(
        eq(domainDecisionSelector.organizationId, organizationId),
        eq(domainDecisionSelector.decisionKey, decisionKey),
      ),
    );
    await ctx.close();
  });

  it('resolves environment-isolated organization default and nearest ancestor overrides', async () => {
    await selector.setMode(
      organizationId,
      decisionKey,
      null,
      'uat',
      'shadow',
      0,
      25,
      'integration-test',
    );
    await selector.setMode(
      organizationId,
      decisionKey,
      clusterId,
      'uat',
      'new-canary',
      30,
      50,
      'integration-test',
    );

    await expect(selector.config(organizationId, decisionKey, locationId, 'uat')).resolves.toMatchObject({
      id: expect.any(String),
      revision: 1,
      mode: 'new-canary',
      canaryPercentage: 30,
      comparisonSamplePercentage: 50,
    });
    await expect(selector.config(organizationId, decisionKey, poolId, 'prod')).resolves.toEqual({
      id: null,
      revision: null,
      mode: 'legacy-only',
      canaryPercentage: 0,
      comparisonSamplePercentage: 0,
    });
  });

  it('rolls back one selector to legacy-only without changing policy artifacts', async () => {
    await selector.setMode(
      organizationId,
      decisionKey,
      clusterId,
      'uat',
      'legacy-only',
      0,
      0,
      'integration-test',
    );
    await expect(selector.config(organizationId, decisionKey, locationId, 'uat')).resolves.toMatchObject({
      id: expect.any(String),
      revision: 2,
      mode: 'legacy-only',
      canaryPercentage: 0,
      comparisonSamplePercentage: 0,
    });
  });
});
