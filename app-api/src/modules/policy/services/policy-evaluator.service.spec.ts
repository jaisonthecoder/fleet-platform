import type { DecisionTable } from '../internal/decision-table';
import { PolicyRegistryService } from '../internal/policy-registry';
import type { PolicyRepository } from '../repositories/policy.repository';
import type { PolicyCacheService } from './policy-cache.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';

/** In-memory stand-in for the Redis-backed cache (records set/invalidate). */
class FakeCache {
  readonly store = new Map<string, { table: DecisionTable; resolvedScopeNodeId: string | null }>();
  get = async (ruleType: string) =>
    this.store.get(ruleType) ?? null;
  set = async (ruleType: string, table: DecisionTable): Promise<void> => {
    this.store.set(ruleType, { table, resolvedScopeNodeId: null });
  };
  invalidate = async (ruleType: string): Promise<void> => {
    this.store.delete(ruleType);
  };
}

/** Repository stand-in whose active table (if any) wins over the seed. */
class FakeRepo {
  active: { table: DecisionTable; resolvedScopeNodeId: string | null } | null = null;
  loadCalls = 0;
  loadActiveTable = async () => {
    this.loadCalls += 1;
    return this.active;
  };
  activate = async (): Promise<void> => {};
}

describe('PolicyEvaluatorService', () => {
  let cache: FakeCache;
  let repo: FakeRepo;
  let service: PolicyEvaluatorService;

  beforeEach(() => {
    cache = new FakeCache();
    repo = new FakeRepo();
    service = new PolicyEvaluatorService(
      new PolicyRegistryService(),
      repo as unknown as PolicyRepository,
      cache as unknown as PolicyCacheService,
    );
  });

  it('returns the configured booking buffer (VALUE via seed default row)', async () => {
    const result = await service.evaluate({
      ruleType: 'booking-buffer',
      context: {},
    });

    expect(result.decision).toBe('VALUE');
    expect(result.value).toBe(15);
    expect(result.policyVersion).toBe('phase1-booking-buffer-v1');
  });

  it('allows an eligible driver (first-match row)', async () => {
    const result = await service.evaluate({
      ruleType: 'driver-eligibility',
      context: { eligible: true },
    });

    expect(result.decision).toBe('ALLOW');
    expect(result.reasons).toContain('driver-eligible');
  });

  it('denies via the mandatory default when eligibility is not proven', async () => {
    const result = await service.evaluate({
      ruleType: 'driver-eligibility',
      context: {},
    });

    expect(result.decision).toBe('DENY');
    expect(result.reasons).toContain('driver-eligibility-not-proven');
  });

  it('FAILS SAFE (DENY + escalate) when no active rule is resolvable', async () => {
    const result = await service.evaluate({
      ruleType: 'unregistered-rule-type',
      context: {},
    });

    expect(result.decision).toBe('DENY');
    expect(result.reasons).toContain('fail-safe-escalate');
    expect(result.policyVersion).toBe('none');
  });

  it('writes a resolved table back to the cache (read-through populate)', async () => {
    await service.evaluate({ ruleType: 'booking-buffer', context: {} });
    expect(cache.store.has('booking-buffer')).toBe(true);
  });

  it('prefers the DB active table over the in-memory seed', async () => {
    repo.active = {
      resolvedScopeNodeId: null,
      table: {
        ruleType: 'booking-buffer',
        version: 'db-booking-buffer-v7',
        scope: 'group',
        rows: [],
        default: { decision: 'VALUE', reasons: ['db-buffer'], value: 25 },
      },
    };

    const result = await service.evaluate({
      ruleType: 'booking-buffer',
      context: {},
    });

    expect(result.value).toBe(25);
    expect(result.policyVersion).toBe('db-booking-buffer-v7');
  });

  it('serves a cache hit without touching the DB read-through', async () => {
    cache.store.set('booking-buffer', {
      resolvedScopeNodeId: null,
      table: {
        ruleType: 'booking-buffer',
        version: 'cached-v1',
        scope: 'group',
        rows: [],
        default: { decision: 'VALUE', reasons: ['cached'], value: 99 },
      },
    });

    const result = await service.evaluate({
      ruleType: 'booking-buffer',
      context: {},
    });

    expect(result.value).toBe(99);
    expect(result.policyVersion).toBe('cached-v1');
    expect(repo.loadCalls).toBe(0);
  });
});
