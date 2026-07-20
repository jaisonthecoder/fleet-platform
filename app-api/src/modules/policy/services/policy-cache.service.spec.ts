import type { Redis } from 'ioredis';
import type { DecisionTable } from '../internal/decision-table';
import { PolicyCacheService } from './policy-cache.service';

const TABLE: DecisionTable = {
  ruleType: 'booking-buffer',
  version: 'v1',
  scope: 'group',
  rows: [],
  default: { decision: 'VALUE', reasons: ['default'], value: 15 },
};

/** Minimal in-memory Redis double (get/set/del). */
class FakeRedis {
  readonly store = new Map<string, string>();
  get = async (key: string): Promise<string | null> => this.store.get(key) ?? null;
  set = async (key: string, value: string): Promise<'OK'> => {
    this.store.set(key, value);
    return 'OK';
  };
  del = async (key: string): Promise<number> => (this.store.delete(key) ? 1 : 0);
}

/** Redis double whose every command rejects (simulates an outage). */
class BrokenRedis {
  get = async (): Promise<string | null> => {
    throw new Error('redis down');
  };
  set = async (): Promise<'OK'> => {
    throw new Error('redis down');
  };
  del = async (): Promise<number> => {
    throw new Error('redis down');
  };
}

describe('PolicyCacheService', () => {
  it('round-trips a compiled table (set then get)', async () => {
    const redis = new FakeRedis();
    const cache = new PolicyCacheService(redis as unknown as Redis);

    await cache.set('booking-buffer', TABLE);
    const loaded = await cache.get('booking-buffer');

    expect(loaded).toEqual({
      table: TABLE,
      resolvedScopeNodeId: null,
      policyRuleId: null,
      policyVersionId: null,
    });
    expect(
      redis.store.has(
        'pdp:rule:00000000-0000-4000-8000-000000000001:booking-buffer:default',
      ),
    ).toBe(true);
  });

  it('invalidate removes the cached table', async () => {
    const redis = new FakeRedis();
    const cache = new PolicyCacheService(redis as unknown as Redis);

    await cache.set('booking-buffer', TABLE);
    await cache.invalidate('booking-buffer');

    expect(await cache.get('booking-buffer')).toBeNull();
  });

  it('isolates cache entries by organization and requested scope', async () => {
    const redis = new FakeRedis();
    const cache = new PolicyCacheService(redis as unknown as Redis);
    await cache.set('booking-buffer', TABLE, '00000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002');
    expect(redis.store.has('pdp:rule:00000000-0000-4000-8000-000000000001:booking-buffer:a0000000-0000-4000-8000-000000000003')).toBe(true);
    await expect(
      cache.get('booking-buffer', '00000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003'),
    ).resolves.toBeNull();
  });

  it('degrades to a cache miss when Redis is down (get never throws)', async () => {
    const cache = new PolicyCacheService(new BrokenRedis() as unknown as Redis);
    await expect(cache.get('booking-buffer')).resolves.toBeNull();
  });

  it('swallows Redis errors on set and invalidate (best-effort)', async () => {
    const cache = new PolicyCacheService(new BrokenRedis() as unknown as Redis);
    await expect(cache.set('booking-buffer', TABLE)).resolves.toBeUndefined();
    await expect(cache.invalidate('booking-buffer')).resolves.toBeUndefined();
  });
});
