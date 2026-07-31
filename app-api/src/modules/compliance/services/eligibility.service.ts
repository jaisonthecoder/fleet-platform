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

  async evaluate(input: EligibilityRequest, organizationId: string): Promise<EligibilityResult> {
    const person = await this.repo.findPerson(input.driverPersonId, organizationId);
    const vehicle = await this.repo.findVehicle(input.vehicleId, organizationId);
    if (!person) return { decision: 'DENY', reasons: ['driver-not-found'], dataAsOf: null, policyVersion: null };
    if (!vehicle) return { decision: 'DENY', reasons: ['vehicle-not-found'], dataAsOf: person.updatedAtUtc.toISOString(), policyVersion: null };

    // Fail-safe on stale HCM data: never allow an ineligible driver on stale
    // sync — block + surface "data as of" so a human can act (P1B-R2-2).
    if (!assessFreshness(person.updatedAtUtc).fresh) {
      return this.record(input, organizationId, 'DENY', ['hcm-data-stale'], 'freshness', person.updatedAtUtc);
    }

    const block = await this.repo.activeBlock(input.driverPersonId, organizationId);
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
      return this.record(input, organizationId, 'DENY', hard.reasons, 'hard-block', person.updatedAtUtc);
    }

    const verdict = await this.pdp.evaluate({
      ruleType: 'driver-eligibility-gate',
      context: { licenceValid: true, notBlocked: true, vehicleDocsValid: true },
    });
    const decision = verdict.decision === 'ALLOW' ? 'ALLOW' : 'DENY';
    return this.record(input, organizationId, decision, verdict.reasons, verdict.policyVersion, person.updatedAtUtc);
  }

  private async record(
    input: EligibilityRequest,
    organizationId: string,
    decision: 'ALLOW' | 'DENY',
    reasons: string[],
    policyVersion: string | null,
    dataAsOf: Date | null,
  ): Promise<EligibilityResult> {
    await this.repo.insertEvaluation({
      organizationId,
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
