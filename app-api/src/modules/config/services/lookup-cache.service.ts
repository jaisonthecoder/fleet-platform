import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../../common/redis/redis.constants';
import type { LookupValueDto } from '../../../contracts/lookup.contract';

/** TTL for a cached lookup value list (safety net; admin changes invalidate). */
const LOOKUP_CACHE_TTL_SECONDS = 600;

/**
 * Redis cache of active lookup value lists, keyed by type code. Best-effort:
 * lookups are read on nearly every form load, so a cache miss / Redis outage
 * must degrade to a DB read, never fail. Invalidated on any admin change to the
 * type's values (guardrail: cache with invalidation, ADR-009).
 */
@Injectable()
export class LookupCacheService {
  private readonly logger = new Logger(LookupCacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(typeCode: string): string {
    return `lookup:type:${typeCode}`;
  }

  /** Returns the cached value list, or null on miss / any Redis error. */
  async get(typeCode: string): Promise<LookupValueDto[] | null> {
    try {
      const raw = await this.redis.get(this.key(typeCode));
      return raw ? (JSON.parse(raw) as LookupValueDto[]) : null;
    } catch (error) {
      this.logger.warn(
        `lookup cache get miss (degraded) for ${typeCode}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  /** Caches a value list with a bounded TTL; swallows Redis errors. */
  async set(typeCode: string, values: LookupValueDto[]): Promise<void> {
    try {
      await this.redis.set(
        this.key(typeCode),
        JSON.stringify(values),
        'EX',
        LOOKUP_CACHE_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `lookup cache set skipped (degraded) for ${typeCode}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  /** Invalidates a type's cached values (called on any admin change). */
  async invalidate(typeCode: string): Promise<void> {
    try {
      await this.redis.del(this.key(typeCode));
    } catch (error) {
      this.logger.warn(
        `lookup cache invalidate skipped (degraded) for ${typeCode}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
