import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../../common/redis/redis.constants';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';
import type { DecisionTable } from '../internal/decision-table';

/** TTL for a compiled decision table in Redis (safety net; activation invalidates). */
const RULE_CACHE_TTL_SECONDS = 300;

export interface CachedPolicy {
  table: DecisionTable;
  resolvedScopeNodeId: string | null;
  policyRuleId: string | null;
  policyVersionId: string | null;
}

/**
 * Redis cache of compiled decision tables, keyed by rule type. Best-effort by
 * design: the PDP must answer within its latency budget and must never fail
 * because Redis is briefly unavailable — every operation degrades to a cache
 * miss / no-op on error, and the evaluator falls through to the Postgres
 * read-through. Cache is invalidated on policy version activation (P0-R2-3).
 */
@Injectable()
export class PolicyCacheService {
  private readonly logger = new Logger(PolicyCacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(
    ruleType: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
    scopeNodeId?: string | null,
  ): string {
    return `pdp:rule:${organizationId}:${ruleType}:${scopeNodeId ?? 'default'}`;
  }

  /** Returns the cached compiled table, or null on miss / any Redis error. */
  async get(
    ruleType: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
    scopeNodeId?: string | null,
  ): Promise<CachedPolicy | null> {
    try {
      const raw = await this.redis.get(this.key(ruleType, organizationId, scopeNodeId));
      return raw ? (JSON.parse(raw) as CachedPolicy) : null;
    } catch (error) {
      this.logger.warn(
        `cache get miss (degraded) for ${ruleType}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  /** Caches a compiled table with a bounded TTL; swallows Redis errors. */
  async set(
    ruleType: string,
    table: DecisionTable,
    organizationId = DEFAULT_ORGANIZATION_ID,
    scopeNodeId?: string | null,
    resolvedScopeNodeId: string | null = scopeNodeId ?? null,
    policyRuleId: string | null = null,
    policyVersionId: string | null = null,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.key(ruleType, organizationId, scopeNodeId),
        JSON.stringify({ table, resolvedScopeNodeId, policyRuleId, policyVersionId } satisfies CachedPolicy),
        'EX',
        RULE_CACHE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `cache set skipped (degraded) for ${ruleType}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  /** Invalidates a rule's cached table (called on version activation). */
  async invalidate(
    ruleType: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
    scopeNodeId?: string | null,
  ): Promise<void> {
    try {
      await this.redis.del(this.key(ruleType, organizationId, scopeNodeId));
    } catch (error) {
      this.logger.warn(
        `cache invalidate skipped (degraded) for ${ruleType}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  /** Invalidates every requested-scope cache entry for one organization/rule. */
  async invalidateRule(
    ruleType: string,
    organizationId = DEFAULT_ORGANIZATION_ID,
  ): Promise<void> {
    try {
      let cursor = '0';
      const pattern = `pdp:rule:${organizationId}:${ruleType}:*`;
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(
        `cache rule invalidation skipped (degraded) for ${ruleType}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
