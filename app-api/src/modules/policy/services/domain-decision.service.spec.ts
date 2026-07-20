import type { DomainDecisionMode } from '../../../contracts/domain-decision.contract';
import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import { DomainDecisionService } from './domain-decision.service';

const legacy: PolicyEvaluationResponse = {
  decision: 'VALUE', reasons: ['legacy'], policyVersion: 'legacy-v1',
  scopeThatAnswered: 'pool', requestedScopeNodeId: 'a0000000-0000-4000-8000-000000000003',
  resolvedScopeNodeId: 'a0000000-0000-4000-8000-000000000003', value: 10,
};
const current: PolicyEvaluationResponse = {
  decision: 'VALUE', reasons: ['new'], policyVersion: 'new-v1',
  scopeThatAnswered: 'pool', requestedScopeNodeId: 'a0000000-0000-4000-8000-000000000003',
  resolvedScopeNodeId: 'a0000000-0000-4000-8000-000000000003', value: 20,
};

const request = (correlationId = 'corr-1') => ({
  consumer: 'test-consumer', subjectRef: 'employee:EMP-1', correlationId,
  environment: 'test',
  request: {
    organizationId: '00000000-0000-4000-8000-000000000001',
    scopeNodeId: 'a0000000-0000-4000-8000-000000000003',
    effectiveAtUtc: '2026-07-20T00:00:00.000Z', ruleType: 'test-rule',
    context: { secretEmployeeId: 'EMP-1', vehicleClass: 'pool' },
  },
});

describe('DomainDecisionService', () => {
  const comparisons: Array<Record<string, unknown>> = [];
  const db = {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: async () => { comparisons.push(value); },
      }),
    }),
  };
  const evaluator = { evaluate: jest.fn().mockResolvedValue(current) };

  const service = (
    mode: DomainDecisionMode,
    canaryPercentage = 100,
    comparisonSamplePercentage = 100,
  ) => new DomainDecisionService(
    evaluator as never,
    { config: jest.fn().mockResolvedValue({ id: null, revision: null, mode, canaryPercentage, comparisonSamplePercentage }) } as never,
    db as never,
  );

  beforeEach(() => {
    comparisons.length = 0;
    evaluator.evaluate.mockReset().mockResolvedValue(current);
  });

  it('returns persistence-ready legacy provenance in legacy-only mode', async () => {
    const result = await service('legacy-only').evaluate(request(), async () => legacy);
    expect(result.response.value).toBe(10);
    expect(result.provenance).toMatchObject({
      decisionKey: 'test-rule', mode: 'legacy-only', source: 'legacy',
      organizationId: '00000000-0000-4000-8000-000000000001',
      policyRuleId: null, policyVersionId: null, matchedRowId: null,
    });
    expect(result.provenance.factFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(comparisons).toHaveLength(0);
  });

  it.each([
    ['shadow', 10, 'legacy'],
    ['new-canary', 20, 'new'],
    ['new-primary-with-legacy-shadow', 20, 'new'],
  ] as const)('compares without raw facts/subjects/routes in %s mode', async (mode, value, source) => {
    const result = await service(mode).evaluate(request(), async () => legacy);
    expect(result.response.value).toBe(value);
    expect(result.provenance.source).toBe(source);
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]).toMatchObject({ category: 'OUTPUT_DIVERGENCE', mode });
    const stored = JSON.stringify(comparisons[0]);
    expect(stored).not.toContain('EMP-1');
    expect(stored).not.toContain('employee:');
  });

  it('supports new-only without invoking legacy', async () => {
    const legacyEvaluator = jest.fn().mockResolvedValue(legacy);
    const result = await service('new-only').evaluate(request(), legacyEvaluator);
    expect(result.response.value).toBe(20);
    expect(legacyEvaluator).not.toHaveBeenCalled();
  });

  it('samples comparisons without changing the selected primary result', async () => {
    const result = await service('shadow', 0, 0).evaluate(request(), async () => legacy);
    expect(result.response.value).toBe(10);
    expect(comparisons).toHaveLength(0);
  });

  it('records error divergence and preserves the configured primary failure', async () => {
    evaluator.evaluate.mockRejectedValue(new TypeError('secret downstream detail'));
    await expect(
      service('new-primary-with-legacy-shadow').evaluate(request(), async () => legacy),
    ).rejects.toBeInstanceOf(TypeError);
    expect(comparisons[0]).toMatchObject({ category: 'ERROR_DIVERGENCE', newErrorCode: 'TypeError' });
    expect(JSON.stringify(comparisons[0])).not.toContain('secret downstream detail');
  });
});
