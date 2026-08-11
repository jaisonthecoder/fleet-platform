import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { ConfigType } from '@nestjs/config';
import type { EligibilityRequest, EligibilityResult } from '../../../contracts/compliance.contract';
import { complianceConfig } from '../../../common/config/compliance.config';
import { hcmConfig } from '../../../common/config/hcm.config';
import { assessFreshness } from '../../platform/internal/hcm';
import { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import { DomainDecisionService } from '../../policy/services/domain-decision.service';
import { hardBlockCheck } from '../internal/eligibility-rules';
import { LegacyDriverEligibilityAdapter } from '../internal/legacy-driver-eligibility.adapter';
import { ESCALATION_WORK_TYPE, EscalationService } from '../../../common/escalation/escalation.service';
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
    private readonly decisions: DomainDecisionService,
    private readonly legacyEligibility: LegacyDriverEligibilityAdapter,
    private readonly escalation: EscalationService,
    @Inject(hcmConfig.KEY) private readonly hcm: ConfigType<typeof hcmConfig>,
    @Inject(complianceConfig.KEY)
    private readonly compliance: ConfigType<typeof complianceConfig>,
  ) {}

  async evaluate(
    input: EligibilityRequest,
    organizationId: string,
    evaluation?: { correlationId?: string; effectiveAtUtc?: string },
  ): Promise<EligibilityResult> {
    const correlationId = evaluation?.correlationId ?? `eligibility:${randomUUID()}`;
    const effectiveAtUtc = evaluation?.effectiveAtUtc ?? new Date().toISOString();
    const effectiveAt = new Date(effectiveAtUtc);
    const person = await this.repo.findPerson(input.driverPersonId, organizationId);
    const vehicle = await this.repo.findVehicle(input.vehicleId, organizationId);
    if (!person) return { decision: 'DENY', reasons: ['driver-not-found'], dataAsOf: null, policyVersion: null };
    if (!vehicle) return { decision: 'DENY', reasons: ['vehicle-not-found'], dataAsOf: person.updatedAtUtc.toISOString(), policyVersion: null };
    const scopeNodeId = await this.repo.findVehicleScope(input.vehicleId, organizationId);
    const dataAsOf = this.hcm.enabled ? person.lastHcmSyncedAt : person.updatedAtUtc;
    if (!scopeNodeId) {
      return this.record(input, organizationId, 'DENY', ['vehicle-scope-missing'], null, dataAsOf, 'hard-block', correlationId, effectiveAt, null, null);
    }

    // Fail-safe on stale HCM data: never allow an ineligible driver on stale
    // sync — block + surface "data as of" so a human can act (P1B-R2-2). HCM is
    // optional: when it is disabled the platform runs on manually-maintained
    // data and this staleness gate is skipped (expiry/missing hard blocks still
    // apply). When enabled, the configurable SLA governs freshness.
    if (
      this.hcm.enabled &&
      (!dataAsOf || !assessFreshness(dataAsOf, this.hcm.freshnessSlaMinutes).fresh)
    ) {
      return this.record(input, organizationId, 'DENY', ['hcm-data-stale'], 'freshness', dataAsOf, 'freshness', correlationId, effectiveAt, scopeNodeId, null);
    }

    // Fail-close on a missing licence (opt-in). A driver with no licence on file
    // must not book; the message routes them to capture it. Structural expiry
    // blocks below still apply regardless of this flag.
    if (this.compliance.licenceMissingBlock && (!person.licenceNumber || !person.licenceExpiry)) {
      return this.record(
        input,
        organizationId,
        'DENY',
        ['licence-missing'],
        'hard-block',
        dataAsOf,
        'hard-block',
        correlationId,
        effectiveAt,
        scopeNodeId,
        null,
      );
    }

    const block = await this.repo.activeBlock(input.driverPersonId, organizationId);
    const hard = hardBlockCheck({
      today: effectiveAt,
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
      return this.record(input, organizationId, 'DENY', hard.reasons, 'hard-block', dataAsOf, 'hard-block', correlationId, effectiveAt, scopeNodeId, null);
    }

    const facts = {
      licenceValid: true,
      notBlocked: true,
      vehicleDocsValid: true,
      licenceSource: person.licenceSource ?? 'unknown',
      licenceVerified: person.licenceVerified,
      hcmEnabled: this.hcm.enabled,
      hcmFresh: !this.hcm.enabled || Boolean(dataAsOf && assessFreshness(dataAsOf, this.hcm.freshnessSlaMinutes).fresh),
    };
    const request = {
      organizationId,
      scopeNodeId,
      effectiveAtUtc,
      ruleType: 'driver-eligibility-gate',
      context: facts,
    };
    try {
      const result = await this.decisions.evaluate(
        { consumer: 'compliance', subjectRef: `driver:${input.driverPersonId}:vehicle:${input.vehicleId}`, correlationId, request },
        async () => this.legacyEligibility.evaluate({ ...facts, requestedScopeNodeId: scopeNodeId }),
      );
      const verdict = result.response;
      const decision = verdict.decision === 'ALLOW' ? 'ALLOW' : 'DENY';
      if (result.provenance.source === 'new' && result.provenance.degraded) {
        await this.escalation.escalate({
          organizationId,
          workType: ESCALATION_WORK_TYPE.pdpFailSafe,
          subjectRef: `eligibility:${this.correlationFingerprint(correlationId)}`,
          reason: verdict.reasons.join('; '),
          correlationId: this.correlationFingerprint(correlationId),
        });
      }
      return this.record(input, organizationId, decision, verdict.reasons, verdict.policyVersion, dataAsOf, 'configurable', correlationId, effectiveAt, scopeNodeId, result.provenance);
    } catch {
      await this.escalation.escalate({
        organizationId,
        workType: ESCALATION_WORK_TYPE.pdpFailSafe,
        subjectRef: `eligibility:${this.correlationFingerprint(correlationId)}`,
        reason: 'eligibility-policy-unavailable',
        correlationId: this.correlationFingerprint(correlationId),
      });
      return this.record(input, organizationId, 'DENY', ['eligibility-policy-unavailable'], null, dataAsOf, 'configurable', correlationId, effectiveAt, scopeNodeId, null);
    }
  }

  private async record(
    input: EligibilityRequest,
    organizationId: string,
    decision: 'ALLOW' | 'DENY',
    reasons: string[],
    policyVersion: string | null,
    dataAsOf: Date | null,
    sourceClassification: 'freshness' | 'hard-block' | 'configurable',
    correlationId: string,
    effectiveAt: Date,
    requestedScopeNodeId: string | null,
    provenance: Record<string, unknown> | null,
  ): Promise<EligibilityResult> {
    await this.repo.insertEvaluation({
      organizationId,
      driverPersonId: input.driverPersonId,
      vehicleId: input.vehicleId,
      decision,
      reasons,
      policyVersion,
      sourceClassification,
      decisionProvenance: provenance,
      correlationId,
      factFingerprint: typeof provenance?.factFingerprint === 'string' ? provenance.factFingerprint : null,
      requestedScopeNodeId,
      resolvedScopeNodeId: typeof provenance?.resolvedScopeNodeId === 'string' ? provenance.resolvedScopeNodeId : null,
      effectiveAtUtc: effectiveAt,
      dataAsOf,
    });
    return { decision, reasons, dataAsOf: dataAsOf ? dataAsOf.toISOString() : null, policyVersion };
  }

  /** Fingerprints correlation values before using them in operational work records. */
  private correlationFingerprint(correlationId: string): string {
    return createHash('sha256').update(correlationId).digest('hex');
  }
}
