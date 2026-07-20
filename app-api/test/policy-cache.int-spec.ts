import { randomUUID } from 'node:crypto';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { and, eq, sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { DRIZZLE } from '../src/common/database/database.constants';
import type { DrizzleDatabase } from '../src/common/database/database.module';
import { policyRule } from '../src/common/database/schema';
import { REDIS } from '../src/common/redis/redis.constants';
import type { DecisionTable } from '../src/modules/policy/internal/decision-table';
import type { CachedPolicy } from '../src/modules/policy/services/policy-cache.service';
import { PolicyAdminService } from '../src/modules/policy/services/policy-admin.service';
import { PolicyEvaluatorService } from '../src/modules/policy/services/policy-evaluator.service';
import { PdpModule } from '../src/pdp.module';

/**
 * Integration proof of the PDP compiled-rule cache (P0-R2-3). Requires a live
 * migrated database (DATABASE_URL) and a live Redis (REDIS_URL). Run via
 * `pnpm test:integration`; not part of the unit job. Proves Redis is the real
 * read path — not merely a fallback: a read-through populates the cache,
 * activation invalidates it, and a warm cache is authoritative until then.
 */
describe('PDP rule cache (integration — requires DB + Redis)', () => {
  let ctx: INestApplicationContext;
  let admin: PolicyAdminService;
  let evaluator: PolicyEvaluatorService;
  let db: DrizzleDatabase;
  let redis: Redis;

  const ruleType = `it-buffer-${randomUUID().slice(0, 8)}`;
  const organizationId = '00000000-0000-4000-8000-000000000001';
  const clusterId = 'a0000000-0000-4000-8000-000000000002';
  const poolId = 'a0000000-0000-4000-8000-000000000003';
  const locationId = 'a0000000-0000-4000-8000-000000000004';
  const cacheKey = `pdp:rule:${organizationId}:${ruleType}:default`;

  const table = (value: number): DecisionTable => ({
    ruleType,
    version: `v-${value}`,
    scope: 'group',
    rows: [],
    default: { decision: 'VALUE', reasons: ['buffer'], value },
  });

  beforeAll(async () => {
    ctx = await NestFactory.createApplicationContext(PdpModule, {
      logger: false,
    });
    admin = ctx.get(PolicyAdminService);
    evaluator = ctx.get(PolicyEvaluatorService);
    db = ctx.get<DrizzleDatabase>(DRIZZLE);
    redis = ctx.get<Redis>(REDIS);
    await redis.del(cacheKey);
  });

  afterAll(async () => {
    await db.execute(sql`
      DELETE FROM fleet.policy_version pv USING fleet.policy_rule pr
      WHERE pv.policy_rule_id = pr.id AND pr.rule_type = ${ruleType}
    `);
    await db.execute(sql`DELETE FROM fleet.policy_rule WHERE rule_type = ${ruleType}`);
    await redis.del(cacheKey);
    await ctx?.close();
  });

  it('reads a new version through from the DB, caches it, and invalidates on re-activation (P0-R2-3)', async () => {
    await admin.activate(table(20));
    // Activation invalidated the cache — the key is absent until the next read.
    expect(await redis.get(cacheKey)).toBeNull();

    const first = await evaluator.evaluate({ ruleType, context: {} });
    expect(first.decision).toBe('VALUE');
    expect(first.value).toBe(20);
    expect(first.policyVersion).toBe('v-20');

    // The read-through populated Redis — proof the cache is really written.
    const cached = await redis.get(cacheKey);
    expect(cached).not.toBeNull();
    expect((JSON.parse(cached as string) as CachedPolicy).table.version).toBe('v-20');

    // Activating a new version invalidates the cache and is served next read.
    await admin.activate(table(25));
    expect(await redis.get(cacheKey)).toBeNull();

    const second = await evaluator.evaluate({ ruleType, context: {} });
    expect(second.value).toBe(25);
    expect(second.policyVersion).toBe('v-25');
    expect(
      (JSON.parse((await redis.get(cacheKey)) as string) as CachedPolicy).table.version,
    ).toBe('v-25');
  });

  it('resolves exact scope, nearest ancestor, then organization default with cache provenance', async () => {
    const scopedType = `${ruleType}-scope`;
    const scopedTable = (version: string, value: number): DecisionTable => ({
      ruleType: scopedType,
      version,
      scope: 'pool',
      rows: [],
      default: { decision: 'VALUE', reasons: [version], value },
    });
    try {
      await admin.activate(scopedTable('default-v1', 10), organizationId, null);
      await admin.activate(scopedTable('cluster-v1', 20), organizationId, clusterId);
      await admin.activate(scopedTable('pool-v1', 30), organizationId, poolId);

      const exact = await evaluator.evaluate({ organizationId, scopeNodeId: poolId, ruleType: scopedType, context: {} });
      expect(exact.value).toBe(30);
      expect(exact.resolvedScopeNodeId).toBe(poolId);

      const inherited = await evaluator.evaluate({ organizationId, scopeNodeId: locationId, ruleType: scopedType, context: {} });
      expect(inherited.value).toBe(30);
      expect(inherited.resolvedScopeNodeId).toBe(poolId);

      await db.update(policyRule).set({ status: 'Superseded' }).where(and(eq(policyRule.ruleType, scopedType), eq(policyRule.scopeNodeId, poolId), eq(policyRule.status, 'Active')));
      await redis.del(`pdp:rule:${organizationId}:${scopedType}:${locationId}`);
      const ancestor = await evaluator.evaluate({ organizationId, scopeNodeId: locationId, ruleType: scopedType, context: {} });
      expect(ancestor.value).toBe(20);
      expect(ancestor.resolvedScopeNodeId).toBe(clusterId);
      const cached = JSON.parse((await redis.get(`pdp:rule:${organizationId}:${scopedType}:${locationId}`)) as string) as CachedPolicy;
      expect(cached.resolvedScopeNodeId).toBe(clusterId);
    } finally {
      await db.execute(sql`DELETE FROM fleet.policy_version pv USING fleet.policy_rule pr WHERE pv.policy_rule_id = pr.id AND pr.rule_type = ${scopedType}`);
      await db.execute(sql`DELETE FROM fleet.policy_rule WHERE rule_type = ${scopedType}`);
      await redis.del(`pdp:rule:${organizationId}:${scopedType}:${poolId}`, `pdp:rule:${organizationId}:${scopedType}:${locationId}`);
    }
  });

  it('serves a warm cache without re-reading the DB (cache authoritative until invalidation)', async () => {
    await redis.del(cacheKey);
    await admin.activate(table(30));
    // Warm the cache.
    await evaluator.evaluate({ ruleType, context: {} });

    // Supersede the active DB row directly (bypassing admin → no invalidation).
    await db
      .update(policyRule)
      .set({ status: 'Superseded' })
      .where(and(eq(policyRule.ruleType, ruleType), eq(policyRule.status, 'Active')));

    // The DB now has no active rule, yet the warm cache still answers v-30.
    const result = await evaluator.evaluate({ ruleType, context: {} });
    expect(result.value).toBe(30);
    expect(result.policyVersion).toBe('v-30');
  });
});
