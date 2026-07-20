import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../../common/auth/auth.decorators';
import type { Principal } from '../../../common/auth/principal';
import {
  ESCALATION_WORK_TYPE,
  EscalationService,
} from '../../../common/escalation/escalation.service';
import {
  PolicyEvaluationResponse,
  policyEvaluationRequestSchema,
} from '../../../contracts/policy-evaluation.contract';
import { FAIL_SAFE_ESCALATE_REASON } from '../internal/decision-table';
import { DecisionLogService } from '../services/decision-log.service';
import { PolicyEvaluatorService } from '../services/policy-evaluator.service';
import { HierarchyService } from '../../platform/services/hierarchy.service';

@Controller({ path: 'decisions', version: '1' })
export class PolicyController {
  constructor(
    private readonly evaluator: PolicyEvaluatorService,
    private readonly decisionLog: DecisionLogService,
    private readonly escalation: EscalationService,
    private readonly hierarchy: HierarchyService,
  ) {}

  /**
   * Validates and evaluates a policy decision request, logs the evaluation, and
   * — when the PDP fails safe (no active rule / outage) — enqueues a human
   * escalation. This is the "+ escalate" half of the fail-safe (P0-R2-2): a
   * DENY that a human must resolve is never silently dropped.
   */
  @Post('evaluate')
  async evaluate(
    @Body() body: unknown,
    @CurrentUser() principal: Principal,
  ): Promise<PolicyEvaluationResponse> {
    const parsed = policyEvaluationRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        title: 'Invalid policy context',
        reasons: parsed.error.issues.map((issue) => issue.message),
      });
    }
    const authorizedScopeNodeId = await this.hierarchy.resolveAuthorizedScope(
      principal,
      parsed.data.scopeNodeId,
    );
    const request = {
      ...parsed.data,
      organizationId: principal.organizationId,
      scopeNodeId: authorizedScopeNodeId,
    };
    const verdict = await this.evaluator.evaluate(request);
    await this.decisionLog.record(request, verdict);

    if (verdict.reasons.includes(FAIL_SAFE_ESCALATE_REASON)) {
      await this.escalation.escalate({
        workType: ESCALATION_WORK_TYPE.pdpFailSafe,
        subjectRef: `pdp:${parsed.data.ruleType}`,
        reason: verdict.reasons.join('; '),
      });
    }
    return verdict;
  }
}
