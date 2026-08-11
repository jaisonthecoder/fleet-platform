import { Injectable } from '@nestjs/common';
import type { PolicyEvaluationRequest, PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { evaluateTableWithTrace, failSafe } from '../../policy/internal/decision-table';
import { PolicyRepository } from '../../policy/repositories/policy.repository';

/** Independent legacy evaluator for administrator-authored Dedicated eligibility tables. */
@Injectable()
export class LegacyDedicatedEligibilityAdapter {
  constructor(private readonly policies: PolicyRepository) {}

  /** Resolves the effective DB table directly and evaluates it without PolicyEvaluatorService/cache. */
  async evaluate(request: PolicyEvaluationRequest & { organizationId: string; scopeNodeId: string; effectiveAtUtc: string }): Promise<PolicyEvaluationResponse> {
    const resolved = await this.policies.loadActiveTable(
      'dedicated-vehicle-eligibility', request.organizationId, request.scopeNodeId, new Date(request.effectiveAtUtc),
    );
    if (!resolved) return failSafe('dedicated-vehicle-eligibility');
    const evaluated = evaluateTableWithTrace(resolved.table, request.context);
    return {
      ...evaluated.response,
      matchedRowId: evaluated.matchedRowId,
      policyRuleId: resolved.policyRuleId,
      policyVersionId: resolved.policyVersionId,
      requestedScopeNodeId: request.scopeNodeId,
      resolvedScopeNodeId: resolved.resolvedScopeNodeId,
    };
  }
}

/** Frozen pre-INT-2 Entitlement approval route used for parity and rollback. */
@Injectable()
export class LegacyEntitlementApprovalRouteAdapter {
  /** Reproduces the original request-type route without the new evaluator. */
  evaluate(requestType: string, requestedScopeNodeId: string): PolicyEvaluationResponse {
    const longTerm = requestType === 'LongTerm';
    return {
      decision: 'ROUTE_TO',
      reasons: [longTerm ? 'chain-long-term' : 'chain-entitlement-default'],
      route: longTerm
        ? ['LineManager', 'FleetManager', 'ClusterFleetLead', 'ClusterCEO']
        : ['LineManager', 'FleetManager', 'ClusterCEO'],
      policyVersion: 'legacy-entitlement-approval-v1',
      scopeThatAnswered: 'group',
      requestedScopeNodeId,
      resolvedScopeNodeId: null,
    };
  }
}