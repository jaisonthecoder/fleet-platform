import { Injectable } from '@nestjs/common';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';

/** Facts accepted by the frozen pre-INT-2 Booking approval route. */
export interface LegacyBookingApprovalRouteFacts {
  durationHours: number;
  requestedScopeNodeId: string;
}

/** Side-effect-free frozen Booking route used only for parity and rollback. */
@Injectable()
export class LegacyBookingApprovalRouteAdapter {
  /** Reproduces the pre-migration duration route without calling the new PDP. */
  evaluate(facts: LegacyBookingApprovalRouteFacts): PolicyEvaluationResponse {
    if (facts.durationHours <= 4) {
      return this.response(facts, ['LineManager'], ['chain-line-manager']);
    }
    if (facts.durationHours >= 24) {
      return this.response(facts, ['LineManager', 'FleetManager'], ['chain-fleet-manager']);
    }
    return this.response(facts, ['LineManager'], ['chain-default-line-manager']);
  }

  /** Builds one stable legacy response with explicit scope and version evidence. */
  private response(
    facts: LegacyBookingApprovalRouteFacts,
    route: string[],
    reasons: string[],
  ): PolicyEvaluationResponse {
    return {
      decision: 'ROUTE_TO',
      route,
      reasons,
      policyVersion: 'legacy-booking-approval-v1',
      scopeThatAnswered: 'group',
      requestedScopeNodeId: facts.requestedScopeNodeId,
      resolvedScopeNodeId: null,
    };
  }
}