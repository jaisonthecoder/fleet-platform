import { Injectable } from '@nestjs/common';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/database/schema';
import {
  PolicyEvaluationRequest,
  PolicyEvaluationResponse,
} from '../../../contracts/policy-evaluation.contract';
import { type DecisionTable, evaluateTableWithTrace, failSafe } from '../internal/decision-table';
import { PolicyRegistryService } from '../internal/policy-registry';
import { PolicyRepository } from '../repositories/policy.repository';
import { PolicyCacheService } from './policy-cache.service';

@Injectable()
export class PolicyEvaluatorService {
  constructor(
    private readonly registry: PolicyRegistryService,
    private readonly repo: PolicyRepository,
    private readonly cache: PolicyCacheService,
  ) {}

  /**
   * Evaluates a decision table top-down (first match wins) with a mandatory
   * default; fails safe (DENY + escalate) when no active rule can be resolved.
   */
  async evaluate(
    request: PolicyEvaluationRequest,
  ): Promise<PolicyEvaluationResponse> {
    const organizationId = request.organizationId ?? DEFAULT_ORGANIZATION_ID;
    const resolved = await this.resolve(
      request.ruleType,
      organizationId,
      request.scopeNodeId,
      request.effectiveAtUtc ? new Date(request.effectiveAtUtc) : new Date(),
    );
    if (!resolved) {
      return failSafe(request.ruleType);
    }
    const evaluated = evaluateTableWithTrace(resolved.table, request.context);
    return {
      ...evaluated.response,
      matchedRowId: evaluated.matchedRowId,
      policyRuleId: resolved.policyRuleId,
      policyVersionId: resolved.policyVersionId,
      requestedScopeNodeId: request.scopeNodeId ?? null,
      resolvedScopeNodeId: resolved.resolvedScopeNodeId,
    };
  }

  /**
   * Resolves a compiled decision table for a rule type. Resolution order is
   * Redis cache → Postgres read-through (`policy_version`) → in-memory Phase-0
   * seed. A read-through hit is written back to Redis so subsequent evaluations
   * in the PDP's latency budget serve from cache; the cache is authoritative
   * only until the next activation invalidates it (P0-R2-3). Redis is
   * best-effort throughout — an outage degrades to the DB/seed path.
   */
  private async resolve(
    ruleType: string,
    organizationId: string,
    scopeNodeId?: string | null,
    effectiveAt = new Date(),
  ): Promise<{ table: DecisionTable; resolvedScopeNodeId: string | null; policyRuleId: string | null; policyVersionId: string | null } | null> {
    const cached = await this.cache.get(ruleType, organizationId, scopeNodeId);
    if (cached) {
      return cached;
    }

    const fromDb = await this.repo.loadActiveTable(
      ruleType,
      organizationId,
      scopeNodeId,
      effectiveAt,
    );
    if (fromDb) {
      await this.cache.set(
        ruleType,
        fromDb.table,
        organizationId,
        scopeNodeId,
        fromDb.resolvedScopeNodeId,
        fromDb.policyRuleId,
        fromDb.policyVersionId,
      );
      return fromDb;
    }

    const seeded = this.registry.getActive(ruleType);
    if (seeded) {
      await this.cache.set(ruleType, seeded, organizationId, scopeNodeId, null);
      return { table: seeded, resolvedScopeNodeId: null, policyRuleId: null, policyVersionId: null };
    }

    return null;
  }
}
