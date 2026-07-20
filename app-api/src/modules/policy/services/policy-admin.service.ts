import { Injectable } from '@nestjs/common';
import type { DecisionTable } from '../internal/decision-table';
import { PolicyRepository } from '../repositories/policy.repository';
import { PolicyCacheService } from './policy-cache.service';

/**
 * PAP write side. Activating a policy version persists the new immutable table
 * and then invalidates the compiled-rule cache for that rule type, so the PDP's
 * next evaluation reads the new version through from Postgres and re-caches it
 * (cache-invalidation-on-activation, P0-R2-3). Persist-then-invalidate ordering
 * means a crash between the two only leaves a stale-but-safe cache entry that
 * expires via TTL — never a cache advertising a version that isn't committed.
 */
@Injectable()
export class PolicyAdminService {
  constructor(
    private readonly repo: PolicyRepository,
    private readonly cache: PolicyCacheService,
  ) {}

  /** Persists and activates a compiled decision table, then invalidates its cache. */
  async activate(
    compiled: DecisionTable,
    organizationId?: string,
    scopeNodeId?: string | null,
  ): Promise<void> {
    await this.repo.activate(compiled, organizationId, scopeNodeId);
    await this.cache.invalidateRule(compiled.ruleType, organizationId);
  }
}
