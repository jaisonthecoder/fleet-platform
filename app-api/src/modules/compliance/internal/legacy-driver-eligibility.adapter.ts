import { Injectable } from '@nestjs/common';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';

export interface LegacyDriverEligibilityFacts {
  licenceValid: boolean;
  notBlocked: boolean;
  vehicleDocsValid: boolean;
  requestedScopeNodeId: string;
}

/** Frozen pre-INT-2 configurable eligibility rule used for parity and rollback. */
@Injectable()
export class LegacyDriverEligibilityAdapter {
  /** Evaluates the original three-boolean eligibility rule without the new PDP. */
  evaluate(facts: LegacyDriverEligibilityFacts): PolicyEvaluationResponse {
    const allowed = facts.licenceValid && facts.notBlocked && facts.vehicleDocsValid;
    return {
      decision: allowed ? 'ALLOW' : 'DENY',
      reasons: [allowed ? 'eligibility-gate-pass' : 'eligibility-gate-fail'],
      policyVersion: 'legacy-driver-eligibility-gate-v1',
      scopeThatAnswered: 'group',
      requestedScopeNodeId: facts.requestedScopeNodeId,
      resolvedScopeNodeId: null,
    };
  }
}