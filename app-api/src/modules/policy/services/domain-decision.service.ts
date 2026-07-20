import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { domainDecisionComparison, domainDecisionSelector, hierarchyNode } from '../../../common/database/schema';
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
import { AuditService } from '../../platform/services/audit.service';

export type LegacyDecisionEvaluator = () => Promise<PolicyEvaluationResponse>;

/** Central deterministic selector; persisted configuration replaces this map in cutover. */
@Injectable()
export class DomainDecisionSelectorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly audit: AuditService,
  ) {}

  async config(
    organizationId: string,
    decisionKey: string,
    scopeNodeId: string,
    environment = 'default',
  ): Promise<{ id: string | null; revision: number | null; mode: DomainDecisionMode; canaryPercentage: number; comparisonSamplePercentage: number }> {
    const target = await this.db
      .select({ path: hierarchyNode.path })
      .from(hierarchyNode)
      .where(and(eq(hierarchyNode.id, scopeNodeId), eq(hierarchyNode.organizationId, organizationId)))
      .limit(1);
    if (!target[0]) return { id: null, revision: null, mode: 'legacy-only', canaryPercentage: 0, comparisonSamplePercentage: 0 };
    const rows = await this.db
      .select({ selector: domainDecisionSelector, path: hierarchyNode.path })
      .from(domainDecisionSelector)
      .leftJoin(hierarchyNode, eq(hierarchyNode.id, domainDecisionSelector.scopeNodeId))
      .where(
        and(
          eq(domainDecisionSelector.organizationId, organizationId),
          eq(domainDecisionSelector.environment, environment),
          eq(domainDecisionSelector.decisionKey, decisionKey),
          or(
            isNull(domainDecisionSelector.scopeNodeId),
            sql`${hierarchyNode.path} @> ${target[0].path}::ltree`,
          ),
        ),
      )
      .orderBy(desc(sql`coalesce(nlevel(${hierarchyNode.path}), -1)`))
      .limit(1);
    const row = rows[0]?.selector;
    return row
      ? {
          id: row.id,
          revision: row.revision,
          mode: row.mode as DomainDecisionMode,
          canaryPercentage: row.canaryPercentage,
          comparisonSamplePercentage: row.comparisonSamplePercentage,
        }
      : { id: null, revision: null, mode: 'legacy-only', canaryPercentage: 0, comparisonSamplePercentage: 0 };
  }

  /** Persists a deterministic organization-default selector (audited API arrives in 8.10). */
  async setMode(
    organizationId: string,
    decisionKey: string,
    scopeNodeId: string | null,
    environment: string,
    mode: DomainDecisionMode,
    canaryPercentage = 0,
    comparisonSamplePercentage = 100,
    updatedBy?: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const predicate = and(
        eq(domainDecisionSelector.organizationId, organizationId),
        eq(domainDecisionSelector.environment, environment),
        eq(domainDecisionSelector.decisionKey, decisionKey),
        scopeNodeId ? eq(domainDecisionSelector.scopeNodeId, scopeNodeId) : isNull(domainDecisionSelector.scopeNodeId),
      );
      const existing = await tx.select().from(domainDecisionSelector).where(predicate).limit(1);
      const before = existing[0] ?? null;
      const rows = before
        ? await tx.update(domainDecisionSelector).set({ mode, canaryPercentage, comparisonSamplePercentage, updatedBy: updatedBy ?? null, revision: sql`${domainDecisionSelector.revision} + 1`, updatedAtUtc: new Date() }).where(eq(domainDecisionSelector.id, before.id)).returning()
        : await tx.insert(domainDecisionSelector).values({ organizationId, decisionKey, scopeNodeId, environment, mode, canaryPercentage, comparisonSamplePercentage, updatedBy: updatedBy ?? null }).returning();
      await this.audit.record(
        { organizationId, actorRef: updatedBy ?? 'system', action: 'DOMAIN_DECISION_SELECTOR_CHANGED', entityRef: `decision-selector:${rows[0].id}`, before, after: rows[0] },
        tx,
      );
    });
  }
}

/** Effect-free domain decision adapter with privacy-minimized shadow comparison. */
@Injectable()
export class DomainDecisionService {
  private readonly logger = new Logger(DomainDecisionService.name);
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
      input.environment ?? 'default',
    );
    const mode = selector.mode;
    const startedAt = Date.now();
    const fingerprint = this.fingerprint(input.request.context);
    const timeoutMs = input.timeoutMs ?? 500;
    const evaluateNew = () => this.withTimeout(
      this.evaluator.evaluate(input.request),
      timeoutMs,
    );

    if (mode === 'legacy-only') {
      if (!legacy) throw new Error(`legacy evaluator required:${input.request.ruleType}`);
      const response = await this.withTimeout(legacy(), timeoutMs);
      return this.result(input, selector, 'legacy', response, fingerprint);
    }

    if (mode === 'new-only') {
      return this.result(input, selector, 'new', await evaluateNew(), fingerprint);
    }

    if (!legacy) throw new Error(`legacy evaluator required for ${mode}:${input.request.ruleType}`);
    const [legacySettled, newSettled] = await Promise.allSettled([
      this.withTimeout(legacy(), timeoutMs),
      evaluateNew(),
    ]);
    const legacyResult = legacySettled.status === 'fulfilled' ? legacySettled.value : null;
    const newResult = newSettled.status === 'fulfilled' ? newSettled.value : null;
    const canaryUsesNew =
      mode === 'new-canary' &&
      this.bucket(input.correlationId) < selector.canaryPercentage;
    const primaryUsesNew =
      mode === 'new-primary-with-legacy-shadow' || canaryUsesNew;
    if (
      legacySettled.status === 'rejected' ||
      newSettled.status === 'rejected' ||
      this.bucket(`${input.correlationId}:comparison`) <
      selector.comparisonSamplePercentage
    ) {
      await this.recordComparison(
        input,
        mode,
        fingerprint,
        legacyResult,
        newResult,
        legacySettled.status === 'rejected' ? legacySettled.reason : null,
        newSettled.status === 'rejected' ? newSettled.reason : null,
      );
    }

    const primary = primaryUsesNew ? newResult : legacyResult;
    const primaryError = primaryUsesNew
      ? newSettled.status === 'rejected' && newSettled.reason
      : legacySettled.status === 'rejected' && legacySettled.reason;
    if (!primary) throw primaryError || new Error('primary decision unavailable');
    this.logger.log(
      `domain decision key=${input.request.ruleType} consumer=${input.consumer} mode=${mode} source=${primaryUsesNew ? 'new' : 'legacy'} durationMs=${Date.now() - startedAt}`,
    );
    return this.result(
      input,
      selector,
      primaryUsesNew ? 'new' : 'legacy',
      primary,
      fingerprint,
    );
  }

  private result(
    input: DomainDecisionRequest,
    selector: { id: string | null; revision: number | null; mode: DomainDecisionMode },
    source: 'legacy' | 'new',
    response: PolicyEvaluationResponse,
    factFingerprint: string,
  ): DomainDecisionResult {
    const provenance: DecisionProvenance = {
      decisionKey: input.request.ruleType,
      environment: input.environment ?? 'default',
      selectorId: selector.id,
      selectorRevision: selector.revision,
      deploymentId: response.policyRuleId ?? null,
      consumer: input.consumer,
      subjectRef: input.subjectRef,
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
      mode: selector.mode,
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
      environment: input.environment ?? 'default',
      consumer: input.consumer,
      subjectRef: this.fingerprint({ subjectRef: input.subjectRef }),
      correlationId: this.fingerprint({ correlationId: input.correlationId }),
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
    }).onConflictDoNothing();
  }

  private normalize(response: PolicyEvaluationResponse) {
    return {
      decision: response.decision,
      reasonFingerprints: response.reasons
        .map((reason) => this.fingerprint({ reason }))
        .sort(),
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

  /** Bounds pure decision evaluation so shadow/canary cannot hang domain work. */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('domain-decision-timeout')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private fingerprint(context: Record<string, unknown>): string {
    const canonical = JSON.stringify(this.canonicalize(context));
    return createHash('sha256').update(canonical).digest('hex');
  }

  /** Deep stable canonicalization: sorted object keys and omitted undefined values. */
  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }
    return value;
  }
}
