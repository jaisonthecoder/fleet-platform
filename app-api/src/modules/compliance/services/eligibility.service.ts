import { Injectable } from '@nestjs/common';
import type { EligibilityRequest, EligibilityResult } from '../../../contracts/compliance.contract';
import { assessFreshness } from '../../platform/internal/hcm';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { hardBlockCheck } from '../internal/eligibility-rules';
import { ComplianceRepository } from '../repositories/compliance.repository';

/**
 * The single source of truth for "can this driver take this vehicle now?"
 * (FR-COMP-10). Runs the structural **hard blocks** (no override — expired
 * Mulkiya/insurance, active access block, expired licence, inactive employee,
 * non-bookable vehicle), then the PDP `driver-eligibility-gate`. Every check is
 * recorded append-only in `eligibility_evaluation`, with the "data as of"
 * freshness of the underlying HCM-synced person data surfaced to the caller.
 */
@Injectable()
export class EligibilityService {
  constructor(
    private readonly repo: ComplianceRepository,
    private readonly pdp: PolicyEvaluatorService,
  ) {}

  async evaluate(input: EligibilityRequest): Promise<EligibilityResult> {
    const person = await this.repo.findPerson(input.driverPersonId);
    const vehicle = await this.repo.findVehicle(input.vehicleId);
    if (!person) return this.record(input, 'DENY', ['driver-not-found'], null, null);
    if (!vehicle) return this.record(input, 'DENY', ['vehicle-not-found'], null, person.updatedAtUtc);

    // Fail-safe on stale HCM data: never allow an ineligible driver on stale
    // sync — block + surface "data as of" so a human can act (P1B-R2-2).
    if (!assessFreshness(person.updatedAtUtc).fresh) {
      return this.record(input, 'DENY', ['hcm-data-stale'], 'freshness', person.updatedAtUtc);
    }

    const block = await this.repo.activeBlock(input.driverPersonId);
    const hard = hardBlockCheck({
      today: new Date(),
      licenceExpiry: person.licenceExpiry,
      employmentStatus: person.employmentStatus,
      mulkiyaExpiry: vehicle.mulkiyaExpiry,
      insuranceExpiry: vehicle.insuranceExpiry,
      vehicleLifecycle: vehicle.lifecycleStatus,
      bookingPoolFlag: vehicle.bookingPoolFlag,
      hasActiveBlock: Boolean(block),
      blockReason: block?.reason ?? null,
    });

    if (hard.blocked) {
      return this.record(input, 'DENY', hard.reasons, 'hard-block', person.updatedAtUtc);
    }

    const verdict = await this.pdp.evaluate({
      ruleType: 'driver-eligibility-gate',
      context: { licenceValid: true, notBlocked: true, vehicleDocsValid: true },
    });
    const decision = verdict.decision === 'ALLOW' ? 'ALLOW' : 'DENY';
    return this.record(input, decision, verdict.reasons, verdict.policyVersion, person.updatedAtUtc);
  }

  private async record(
    input: EligibilityRequest,
    decision: 'ALLOW' | 'DENY',
    reasons: string[],
    policyVersion: string | null,
    dataAsOf: Date | null,
  ): Promise<EligibilityResult> {
    await this.repo.insertEvaluation({
      driverPersonId: input.driverPersonId,
      vehicleId: input.vehicleId,
      decision,
      reasons,
      policyVersion,
      dataAsOf,
    });
    return { decision, reasons, dataAsOf: dataAsOf ? dataAsOf.toISOString() : null, policyVersion };
  }
}
