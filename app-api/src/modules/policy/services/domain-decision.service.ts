import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { domainDecisionComparison } from '../../../common/database/schema';
import { domainDecisionSelector } from '../../../common/database/schema';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type {
  DecisionProvenance,
  DomainDecisionMode,
  DomainDecisionRequest,
  DomainDecisionResult,
} from '../../../contracts/domain-decision.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { FAIL_SAFE_ESCALATE_REASON } from '../internal/decision-table';
import { PolicyEvaluatorService } from './policy-evaluator.service';

export type LegacyDecisionEvaluator = () => Promise<PolicyEvaluationResponse>;

/** Central deterministic selector; persisted configuration replaces this map in cutover. */
@Injectable()
export class DomainDecisionSelectorService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async config(
    organizationId: string,
    decisionKey: string,
    scopeNodeId: string,
  ): Promise<{ mode: DomainDecisionMode; canaryPercentage: number }> {
    const rows = await this.db
      .select()
      .from(domainDecisionSelector)
      .where(
        and(
          eq(domainDecisionSelector.organizationId, organizationId),
          eq(domainDecisionSelector.decisionKey, decisionKey),
          or(
            eq(domainDecisionSelector.scopeNodeId, scopeNodeId),
            isNull(domainDecisionSelector.scopeNodeId),
          ),
        ),
      )
      .orderBy(desc(sql`CASE WHEN ${domainDecisionSelector.scopeNodeId} = ${scopeNodeId} THEN 1 ELSE 0 END`))
      .limit(1);
    const row = rows[0];
    return row
      ? {
          mode: row.mode as DomainDecisionMode,
          canaryPercentage: row.canaryPercentage,
        }
      : { mode: 'legacy-only', canaryPercentage: 0 };
  }

  /** Persists a deterministic organization-default selector (audited API arrives in 8.10). */
  async setMode(
    organizationId: string,
    decisionKey: string,
    scopeNodeId: string | null,
    mode: DomainDecisionMode,
    canaryPercentage = 0,
    updatedBy?: string,
  ): Promise<void> {
    const predicate = and(
      eq(domainDecisionSelector.organizationId, organizationId),
      eq(domainDecisionSelector.decisionKey, decisionKey),
      scopeNodeId
        ? eq(domainDecisionSelector.scopeNodeId, scopeNodeId)
        : isNull(domainDecisionSelector.scopeNodeId),
    );
    const existing = await this.db.select({ id: domainDecisionSelector.id }).from(domainDecisionSelector).where(predicate).limit(1);
    if (existing[0]) {
      await this.db.update(domainDecisionSelector).set({ mode, canaryPercentage, updatedBy: updatedBy ?? null, revision: sql`${domainDecisionSelector.revision} + 1`, updatedAtUtc: new Date() }).where(eq(domainDecisionSelector.id, existing[0].id));
    } else {
      await this.db.insert(domainDecisionSelector).values({ organizationId, decisionKey, scopeNodeId, mode, canaryPercentage, updatedBy: updatedBy ?? null });
    }
  }
}

/** Effect-free domain decision adapter with privacy-minimized shadow comparison. */
@Injectable()
export class DomainDecisionService {
  constructor(
    private readonly evaluator: PolicyEvaluatorService,
    private readonly selector: DomainDecisionSelectorService,
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
  ) {}

  async evaluate(
    input: DomainDecisionRequest,
    legacy?: LegacyDecisionEvaluator,
  ): Promise<DomainDecisionResult> {
    const selector = await this.selector.config(
      input.request.organizationId,
      input.request.ruleType,
      input.request.scopeNodeId,
    );
    const mode = selector.mode;
    const fingerprint = this.fingerprint(input.request.context);
    const evaluateNew = () => this.evaluator.evaluate(input.request);

    if (mode === 'legacy-only') {
      if (!legacy) throw new Error(`legacy evaluator required:${input.request.ruleType}`);
      const response = await legacy();
      return this.result(input, mode, 'legacy', response, fingerprint);
    }

    if (mode === 'new-only') {
      return this.result(input, mode, 'new', await evaluateNew(), fingerprint);
    }

    if (!legacy) throw new Error(`legacy evaluator required for ${mode}:${input.request.ruleType}`);
    const [legacySettled, newSettled] = await Promise.allSettled([
      legacy(),
      evaluateNew(),
    ]);
    const legacyResult = legacySettled.status === 'fulfilled' ? legacySettled.value : null;
    const newResult = newSettled.status === 'fulfilled' ? newSettled.value : null;
    const canaryUsesNew =
      mode === 'new-canary' &&
      this.bucket(input.correlationId) < selector.canaryPercentage;
    const primaryUsesNew =
      mode === 'new-primary-with-legacy-shadow' || canaryUsesNew;
    await this.recordComparison(
      input,
      mode,
      fingerprint,
      legacyResult,
      newResult,
      legacySettled.status === 'rejected' ? legacySettled.reason : null,
      newSettled.status === 'rejected' ? newSettled.reason : null,
    );

    const primary = primaryUsesNew ? newResult : legacyResult;
    const primaryError = primaryUsesNew
      ? newSettled.status === 'rejected' && newSettled.reason
      : legacySettled.status === 'rejected' && legacySettled.reason;
    if (!primary) throw primaryError || new Error('primary decision unavailable');
    return this.result(
      input,
      mode,
      primaryUsesNew ? 'new' : 'legacy',
      primary,
      fingerprint,
    );
  }

  private result(
    input: DomainDecisionRequest,
    mode: DomainDecisionMode,
    source: 'legacy' | 'new',
    response: PolicyEvaluationResponse,
    factFingerprint: string,
  ): DomainDecisionResult {
    const provenance: DecisionProvenance = {
      decisionKey: input.request.ruleType,
      consumer: input.consumer,
      subjectRef: this.fingerprint({ subjectRef: input.subjectRef }),
      correlationId: input.correlationId,
      organizationId: input.request.organizationId,
      requestedScopeNodeId: input.request.scopeNodeId,
      resolvedScopeNodeId: response.resolvedScopeNodeId ?? null,
      policyVersion: response.policyVersion,
      policyRuleId: response.policyRuleId ?? null,
      policyVersionId: response.policyVersionId ?? null,
      matchedRowId: response.matchedRowId ?? null,
      decision: response.decision,
      reasons: response.reasons,
      effectiveAtUtc: input.request.effectiveAtUtc,
      evaluatedAtUtc: new Date().toISOString(),
      factFingerprint,
      mode,
      source,
      degraded: response.reasons.includes(FAIL_SAFE_ESCALATE_REASON),
    };
    return { response, provenance };
  }

  private async recordComparison(
    input: DomainDecisionRequest,
    mode: DomainDecisionMode,
    factFingerprint: string,
    legacyResult: PolicyEvaluationResponse | null,
    newResult: PolicyEvaluationResponse | null,
    legacyError: unknown,
    newError: unknown,
  ): Promise<void> {
    const legacy = legacyResult ? this.normalize(legacyResult) : null;
    const current = newResult ? this.normalize(newResult) : null;
    const category = legacyError || newError
      ? 'ERROR_DIVERGENCE'
      : JSON.stringify(legacy) === JSON.stringify(current)
        ? 'MATCH'
        : 'OUTPUT_DIVERGENCE';
    await this.db.insert(domainDecisionComparison).values({
      organizationId: input.request.organizationId,
      decisionKey: input.request.ruleType,
      consumer: input.consumer,
      subjectRef: input.subjectRef,
      correlationId: input.correlationId,
      requestedScopeNodeId: input.request.scopeNodeId,
      resolvedScopeNodeId:
        newResult?.resolvedScopeNodeId ?? legacyResult?.resolvedScopeNodeId ?? null,
      mode,
      factFingerprint,
      legacyResult: legacy,
      newResult: current,
      category,
      legacyPolicyVersion: legacyResult?.policyVersion ?? null,
      newPolicyVersion: newResult?.policyVersion ?? null,
      legacyErrorCode: this.errorCode(legacyError),
      newErrorCode: this.errorCode(newError),
    });
  }

  private normalize(response: PolicyEvaluationResponse) {
    return {
      decision: response.decision,
      reasons: [...response.reasons].sort(),
      routeFingerprint: this.fingerprint({ route: response.route ?? null }),
      valueFingerprint: this.fingerprint({ value: response.value ?? null }),
      resolvedScopeNodeId: response.resolvedScopeNodeId ?? null,
      matchedRowId: response.matchedRowId ?? null,
    };
  }

  private errorCode(error: unknown): string | null {
    return error ? (error instanceof Error ? error.constructor.name : 'UnknownError') : null;
  }

  private bucket(correlationId: string): number {
    return Number.parseInt(
      createHash('sha256').update(correlationId).digest('hex').slice(0, 8),
      16,
    ) % 100;
  }

  private fingerprint(context: Record<string, unknown>): string {
    const canonical = JSON.stringify(
      Object.keys(context)
        .sort()
        .map((key) => [key, context[key]]),
    );
    return createHash('sha256').update(canonical).digest('hex');
  }
}
