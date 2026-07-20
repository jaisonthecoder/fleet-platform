import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { decisionLog } from '../../../common/database/schema';
import type {
  PolicyEvaluationRequest,
  PolicyEvaluationResponse,
} from '../../../contracts/policy-evaluation.contract';

@Injectable()
export class DecisionLogService {
  private readonly logger = new Logger(DecisionLogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /**
   * Appends a minimized record of a PDP evaluation (FR-POL-05) so Internal
   * Audit can reconstruct why any transaction was allowed/denied/routed. Stores
   * a context fingerprint, never the raw context (PII minimization). Best-effort
   * — a logging failure never changes the decision the caller already has.
   */
  async record(
    request: PolicyEvaluationRequest,
    response: PolicyEvaluationResponse,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.db.insert(decisionLog).values({
        organizationId: request.organizationId,
        ruleType: request.ruleType,
        decision: response.decision,
        reasons: response.reasons,
        scopeThatAnswered: response.scopeThatAnswered,
        requestedScopeNodeId: response.requestedScopeNodeId ?? null,
        resolvedScopeNodeId: response.resolvedScopeNodeId ?? null,
        contextFingerprint: this.fingerprint(request.context),
        correlationId: correlationId ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `decision_log append failed for ${request.ruleType}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  /** SHA-256 over the sorted context keys+values (minimized, non-reversible-ish). */
  private fingerprint(context: Record<string, unknown>): string {
    const canonical = JSON.stringify(
      Object.keys(context)
        .sort()
        .map((k) => [k, context[k]]),
    );
    return createHash('sha256').update(canonical).digest('hex');
  }
}
