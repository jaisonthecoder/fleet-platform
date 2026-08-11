import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { domainDecisionComparison, domainDecisionSelector } from '../../../common/database/schema';
import type {
  DecisionComparisonSummaryDto,
  DecisionComparisonSummaryQuery,
  DecisionSelectorStateDto,
  UpdateDecisionSelector,
} from '../../../contracts/domain-decision.contract';
import { DomainDecisionSelectorService } from '../../policy/services/domain-decision.service';

/** Operational administration for decision selectors and aggregate parity evidence. */
@Injectable()
export class DomainDecisionAdministrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly selectors: DomainDecisionSelectorService,
  ) {}

  /** Returns the exact configured selector and the effective inherited selector. */
  async selectorState(
    organizationId: string,
    decisionKey: string,
    environment: string,
    scopeNodeId: string | null,
  ): Promise<DecisionSelectorStateDto> {
    const exact = await this.db.select().from(domainDecisionSelector).where(and(
      eq(domainDecisionSelector.organizationId, organizationId),
      eq(domainDecisionSelector.decisionKey, decisionKey),
      eq(domainDecisionSelector.environment, environment),
      scopeNodeId ? eq(domainDecisionSelector.scopeNodeId, scopeNodeId) : isNull(domainDecisionSelector.scopeNodeId),
    )).limit(1);
    const effective = scopeNodeId
      ? await this.selectors.config(organizationId, decisionKey, scopeNodeId, environment)
      : exact[0]
        ? this.toEffective(exact[0])
        : { id: null, revision: null, mode: 'legacy-only' as const, canaryPercentage: 0, comparisonSamplePercentage: 0 };
    return {
      configured: exact[0] ? {
        id: exact[0].id,
        revision: exact[0].revision,
        scopeNodeId: exact[0].scopeNodeId,
        environment: exact[0].environment,
        mode: exact[0].mode as DecisionSelectorStateDto['effective']['mode'],
        canaryPercentage: exact[0].canaryPercentage,
        comparisonSamplePercentage: exact[0].comparisonSamplePercentage,
      } : null,
      effective,
    };
  }

  /** Updates one exact selector with optimistic revision and returns effective state. */
  async updateSelector(
    organizationId: string,
    decisionKey: string,
    input: UpdateDecisionSelector,
    actorRef: string,
  ): Promise<DecisionSelectorStateDto> {
    await this.selectors.setMode(
      organizationId,
      decisionKey,
      input.scopeNodeId ?? null,
      input.environment,
      input.mode,
      input.canaryPercentage,
      input.comparisonSamplePercentage,
      actorRef,
      input.expectedRevision,
    );
    return this.selectorState(organizationId, decisionKey, input.environment, input.scopeNodeId ?? null);
  }

  /** Returns aggregate comparison counts without subjects, correlations, facts or outcomes. */
  async comparisonSummary(
    organizationId: string,
    query: DecisionComparisonSummaryQuery,
    authorizedScopeNodeIds: string[] | null,
  ): Promise<DecisionComparisonSummaryDto> {
    const since = query.sinceUtc ? new Date(query.sinceUtc) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (authorizedScopeNodeIds?.length === 0) {
      return { decisionKey: query.decisionKey, environment: query.environment, sinceUtc: since.toISOString(), total: 0, counts: [] };
    }
    const rows = await this.db.select({
      mode: domainDecisionComparison.mode,
      category: domainDecisionComparison.category,
      count: sql<number>`count(*)::int`,
    }).from(domainDecisionComparison).where(and(
      eq(domainDecisionComparison.organizationId, organizationId),
      eq(domainDecisionComparison.decisionKey, query.decisionKey),
      eq(domainDecisionComparison.environment, query.environment),
      gte(domainDecisionComparison.comparedAtUtc, since),
      authorizedScopeNodeIds ? inArray(domainDecisionComparison.requestedScopeNodeId, authorizedScopeNodeIds) : undefined,
    )).groupBy(domainDecisionComparison.mode, domainDecisionComparison.category);
    const counts = rows.map((row) => ({
      mode: row.mode as DecisionComparisonSummaryDto['counts'][number]['mode'],
      category: row.category,
      count: Number(row.count),
    }));
    return {
      decisionKey: query.decisionKey,
      environment: query.environment,
      sinceUtc: since.toISOString(),
      total: counts.reduce((sum, row) => sum + row.count, 0),
      counts,
    };
  }

  /** Deletes comparison evidence older than the configured observation window. */
  async comparisonOrganizationIds(): Promise<string[]> {
    const rows = await this.db.selectDistinct({ organizationId: domainDecisionComparison.organizationId })
      .from(domainDecisionComparison);
    return rows.map((row) => row.organizationId);
  }

  /** Deletes expired comparison evidence for exactly one organization. */
  async deleteComparisonsBefore(organizationId: string, cutoff: Date): Promise<number> {
    const rows = await this.db.delete(domainDecisionComparison)
      .where(and(
        eq(domainDecisionComparison.organizationId, organizationId),
        lt(domainDecisionComparison.comparedAtUtc, cutoff),
      ))
      .returning({ id: domainDecisionComparison.id });
    return rows.length;
  }

  /** Maps a persisted selector into the effective selector contract. */
  private toEffective(row: typeof domainDecisionSelector.$inferSelect): DecisionSelectorStateDto['effective'] {
    return {
      id: row.id,
      revision: row.revision,
      mode: row.mode as DecisionSelectorStateDto['effective']['mode'],
      canaryPercentage: row.canaryPercentage,
      comparisonSamplePercentage: row.comparisonSamplePercentage,
    };
  }
}