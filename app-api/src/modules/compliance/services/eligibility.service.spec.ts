import { EligibilityService } from './eligibility.service';
import type { ComplianceRepository } from '../repositories/compliance.repository';
import type { PolicyEvaluatorService } from '../../policy/services/policy-evaluator.service';
import type { DomainDecisionService } from '../../policy/services/domain-decision.service';
import { LegacyDriverEligibilityAdapter } from '../internal/legacy-driver-eligibility.adapter';

/** A compliant, bookable vehicle (no vehicle-side hard blocks). */
const bookableVehicle = {
  mulkiyaExpiry: '2030-01-01',
  insuranceExpiry: '2030-01-01',
  lifecycleStatus: 'Active',
  bookingPoolFlag: true,
};

/** A licensed, active driver whose record was last synced `agedMs` ago. */
const person = (agedMs: number) => ({
  updatedAtUtc: new Date(Date.now() - agedMs),
  lastHcmSyncedAt: new Date(Date.now() - agedMs),
  licenceNumber: 'L-1',
  licenceExpiry: '2030-01-01',
  licenceSource: 'manual',
  licenceVerified: true,
  employmentStatus: 'Active',
});

function makeService(
  enabled: boolean,
  freshnessSlaMinutes = 1440,
  licenceMissingBlock = false,
) {
  const repo = {
    findPerson: jest.fn(),
    findVehicle: jest.fn().mockResolvedValue(bookableVehicle),
    findVehicleScope: jest.fn().mockResolvedValue('10000000-0000-4000-8000-000000000001'),
    activeBlock: jest.fn().mockResolvedValue(null),
    insertEvaluation: jest.fn().mockResolvedValue(undefined),
  };
  const pdp = {
    evaluate: jest
      .fn()
      .mockResolvedValue({ decision: 'ALLOW', reasons: ['driver-eligible'], policyVersion: 'v1' }),
  };
  const decisions = {
    evaluate: jest.fn(async (input: { request: { ruleType: string } }, legacy: () => Promise<unknown>) => ({
      response: await legacy(),
      provenance: {
        decisionKey: input.request.ruleType,
        factFingerprint: 'a'.repeat(64),
        resolvedScopeNodeId: null,
        source: 'legacy',
        mode: 'legacy-only',
      },
    })),
  };
  const escalation = { escalate: jest.fn().mockResolvedValue('work-1') };
  const service = new EligibilityService(
    repo as unknown as ComplianceRepository,
    pdp as unknown as PolicyEvaluatorService,
    decisions as unknown as DomainDecisionService,
    new LegacyDriverEligibilityAdapter(),
    escalation as never,
    { enabled, freshnessSlaMinutes },
    { licenceMissingBlock },
  );
  return { service, repo, pdp, decisions, escalation };
}

describe('EligibilityService — HCM freshness gate', () => {
  const req = { driverPersonId: 'd1', vehicleId: 'v1' };
  const org = 'org1';
  const twoDaysMs = 48 * 60 * 60 * 1000;

  it('skips the staleness block when HCM is disabled (manual-data mode)', async () => {
    const { service, repo } = makeService(false);
    repo.findPerson.mockResolvedValue(person(twoDaysMs)); // 48h old
    const result = await service.evaluate(req, org);
    expect(result.decision).toBe('ALLOW');
    expect(result.reasons).not.toContain('hcm-data-stale');
  });

  it('blocks stale data when HCM is enabled and data exceeds the SLA', async () => {
    const { service, repo } = makeService(true, 1440);
    repo.findPerson.mockResolvedValue(person(twoDaysMs)); // 48h > 24h SLA
    const result = await service.evaluate(req, org);
    expect(result.decision).toBe('DENY');
    expect(result.reasons).toContain('hcm-data-stale');
  });

  it('allows fresh data when HCM is enabled', async () => {
    const { service, repo, escalation } = makeService(true, 1440);
    repo.findPerson.mockResolvedValue(person(60 * 60 * 1000)); // 1h old
    const result = await service.evaluate(req, org);
    expect(result.decision).toBe('ALLOW');
    expect(result.reasons).not.toContain('hcm-data-stale');
    expect(escalation.escalate).not.toHaveBeenCalled();
  });

  it('blocks a missing licence only when the flag is enabled', async () => {
    const noLicence = { ...person(60 * 60 * 1000), licenceExpiry: null };
    const off = makeService(false, 1440, false);
    off.repo.findPerson.mockResolvedValue(noLicence);
    expect((await off.service.evaluate(req, org)).reasons).not.toContain(
      'licence-missing',
    );

    const on = makeService(false, 1440, true);
    on.repo.findPerson.mockResolvedValue(noLicence);
    const blocked = await on.service.evaluate(req, org);
    expect(blocked.decision).toBe('DENY');
    expect(blocked.reasons).toContain('licence-missing');
  });

  it('fails closed and escalates once when the selected configurable path is unavailable', async () => {
    const { service, repo, decisions, escalation } = makeService(false);
    repo.findPerson.mockResolvedValue(person(60 * 60 * 1000));
    decisions.evaluate.mockRejectedValueOnce(new Error('new evaluator unavailable'));
    const result = await service.evaluate(req, org, { correlationId: 'eligibility-failure-1' });
    expect(result).toMatchObject({ decision: 'DENY', reasons: ['eligibility-policy-unavailable'] });
    expect(escalation.escalate).toHaveBeenCalledTimes(1);
    expect(escalation.escalate).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: org,
      workType: 'escalation:pdp-fail-safe',
      subjectRef: expect.stringMatching(/^eligibility:[a-f0-9]{64}$/),
    }));
  });

  it('does not invoke configurable decisions or escalation for a structural hard block', async () => {
    const { service, repo, decisions, escalation } = makeService(false);
    repo.findPerson.mockResolvedValue(person(60 * 60 * 1000));
    repo.findVehicle.mockResolvedValue({ ...bookableVehicle, insuranceExpiry: '2020-01-01' });
    const result = await service.evaluate(req, org);
    expect(result.reasons).toContain('hard-block-insurance-expired');
    expect(decisions.evaluate).not.toHaveBeenCalled();
    expect(escalation.escalate).not.toHaveBeenCalled();
  });
});
