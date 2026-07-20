import { BadRequestException } from '@nestjs/common';
import type { EscalationService } from '../../../common/escalation/escalation.service';
import { failSafe } from '../internal/decision-table';
import type { DecisionLogService } from '../services/decision-log.service';
import type { PolicyEvaluatorService } from '../services/policy-evaluator.service';
import type { HierarchyService } from '../../platform/services/hierarchy.service';
import type { Principal } from '../../../common/auth/principal';
import { PolicyController } from './policy.controller';

describe('PolicyController', () => {
  const principal: Principal = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    userId: null,
    personId: 'person-1',
    entraObjectId: null,
    email: null,
    roles: [{ role: 'Employee', scopeNodeId: 'a0000000-0000-4000-8000-000000000003' }],
    isDevLogin: true,
  };
  const makeController = (verdict: ReturnType<typeof failSafe>) => {
    const evaluate = jest.fn().mockReturnValue(verdict);
    const record = jest.fn().mockResolvedValue(undefined);
    const escalate = jest.fn().mockResolvedValue('sw-1');
    const controller = new PolicyController(
      { evaluate } as unknown as PolicyEvaluatorService,
      { record } as unknown as DecisionLogService,
      { escalate } as unknown as EscalationService,
      { resolveAuthorizedScope: jest.fn().mockResolvedValue('a0000000-0000-4000-8000-000000000003') } as unknown as HierarchyService,
    );
    return { controller, evaluate, record, escalate };
  };

  it('logs the decision and does NOT escalate a normal verdict', async () => {
    const { controller, record, escalate } = makeController({
      decision: 'ALLOW',
      reasons: ['driver-eligible'],
      policyVersion: 'v1',
      scopeThatAnswered: 'group',
    });

    const result = await controller.evaluate(
      { ruleType: 'driver-eligibility', context: { eligible: true } },
      principal,
    );

    expect(result.decision).toBe('ALLOW');
    expect(record).toHaveBeenCalledTimes(1);
    expect(escalate).not.toHaveBeenCalled();
  });

  it('escalates the "+ escalate" half when the PDP fails safe (P0-R2-2)', async () => {
    const { controller, escalate } = makeController(failSafe('unregistered-rule'));

    const result = await controller.evaluate(
      { ruleType: 'unregistered-rule', context: {} },
      principal,
    );

    expect(result.decision).toBe('DENY');
    expect(escalate).toHaveBeenCalledTimes(1);
    expect(escalate.mock.calls[0]![0].workType).toBe('escalation:pdp-fail-safe');
    expect(escalate.mock.calls[0]![0].subjectRef).toBe('pdp:unregistered-rule');
  });

  it('rejects an invalid request body', async () => {
    const { controller } = makeController(failSafe('x'));
    await expect(controller.evaluate({ nope: true }, principal)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
