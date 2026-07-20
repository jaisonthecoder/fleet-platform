import type { PolicyEvaluationResponse } from '../../../contracts/policy-evaluation.contract';
import {
  DomainDecisionSelectorService,
  DomainDecisionService,
} from './domain-decision.service';

const legacy: PolicyEvaluationResponse = {
  decision: 'VALUE',
  reasons: ['legacy'],
  policyVersion: 'legacy-v1',
  scopeThatAnswered: 'pool',
  requestedScopeNodeId: 'a0000000-0000-4000-8000-000000000003',
  resolvedScopeNodeId: 'a0000000-0000-4000-8000-000000000003',
  value: 10,
};
const current: PolicyEvaluationResponse = {
  decision: 'VALUE',
  reasons: ['new'],
  policyVersion: 'new-v1',
  scopeThatAnswered: 'pool',
  requestedScopeNodeId: 'a0000000-0000-4000-8000-000000000003',
  resolvedScopeNodeId: 'a0000000-0000-4000-8000-000000000003',
  value: 20,
};

const request = (mode?: 'legacy-only' | 'shadow' | 'new-canary' | 'new-primary-with-legacy-shadow' | 'new-only') => ({
  consumer: 'test-consumer',
  subjectRef: 'subject:1',
  correlationId: 'corr-1',
  mode,
  request: {
    organizationId: '00000000-0000-4000-8000-000000000001',
    scopeNodeId: 'a0000000-0000-4000-8000-000000000003',
    effectiveAtUtc: '2026-07-20T00:00:00.000Z',
    ruleType: 'test-rule',
    context: { secretEmployeeId: 'EMP-1', vehicleClass: 'pool' },
  },
});

describe('DomainDecisionService', () => {
  const comparisons: Array<Record<string, unknown>> = [];
  const db = {
    insert: () => ({ values: async (value: Record<string, unknown>) => comparisons.push(value) }),
  };
  const evaluator = { evaluate: jest.fn().mockResolvedValue(current) };
  let selector: DomainDecisionSelectorService;
  let service: DomainDecisionService;

  beforeEach(() => {
    comparisons.length = 0;
    evaluator.evaluate.mockClear();
    selector = new DomainDecisionSelectorService();
    service = new DomainDecisionService(evaluator as never, selector, db as never);
  });

  it('defaults to legacy-only and returns persistence-ready provenance', async () => {
    const result = await service.evaluate(request(), async () => legacy);
    expect(result.response.value).toBe(10);
    expect(result.provenance).toMatchObject({
      decisionKey: 'test-rule',
      mode: 'legacy-only',
      source: 'legacy',
      organizationId: '00000000-0000-4000-8000-000000000001',
    });
    expect(result.provenance.factFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(comparisons).toHaveLength(0);
  });

  it.each(['shadow', 'new-canary', 'new-primary-with-legacy-shadow'] as const)(
    'compares legacy/new without storing raw facts in %s mode',
    async (mode) => {
      const result = await service.evaluate(request(mode), async () => legacy);
      expect(result.response.value).toBe(mode === 'shadow' ? 10 : 20);
      expect(comparisons).toHaveLength(1);
      expect(comparisons[0]).toMatchObject({ category: 'OUTPUT_DIVERGENCE', mode });
      expect(JSON.stringify(comparisons[0])).not.toContain('EMP-1');
    },
  );

  it('supports new-only and instant selector rollback', async () => {
    selector.setMode('test-rule', 'new-only');
    expect((await service.evaluate(request(), async () => legacy)).response.value).toBe(20);
    selector.setMode('test-rule', 'legacy-only');
    expect((await service.evaluate(request(), async () => legacy)).response.value).toBe(10);
  });
});
