import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { EscalationService } from '../../../common/escalation/escalation.service';
import type { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowService } from './workflow.service';

/** In-memory fake of WorkflowRepository (mirrors the DB semantics the service relies on). */
class FakeRepo {
  instances = new Map<
    string,
    { id: string; workflowType: string; subjectRef: string; currentStep: number; status: string }
  >();
  steps = new Map<
    string,
    {
      id: string;
      workflowInstanceId: string;
      sequence: number;
      assigneePersonId: string | null;
      decidedByPersonId: string | null;
      onBehalfOfPersonId: string | null;
      decision: string | null;
      reason: string | null;
      slaDueAt: Date | null;
    }
  >();
  private seq = 0;

  async createInstance(input: { workflowType: string; subjectRef: string }) {
    const id = `wf-${++this.seq}`;
    this.instances.set(id, {
      id,
      workflowType: input.workflowType,
      subjectRef: input.subjectRef,
      currentStep: 0,
      status: 'Pending',
    });
    return id;
  }

  async createSteps(instanceId: string, steps: { assigneePersonId: string; slaDueAt: Date | null }[]) {
    steps.forEach((step, index) => {
      const id = `st-${++this.seq}`;
      this.steps.set(id, {
        id,
        workflowInstanceId: instanceId,
        sequence: index,
        assigneePersonId: step.assigneePersonId,
        decidedByPersonId: null,
        onBehalfOfPersonId: null,
        decision: null,
        reason: null,
        slaDueAt: step.slaDueAt,
      });
    });
  }

  async getInstance(id: string) {
    return this.instances.get(id);
  }

  async listSteps(instanceId: string) {
    return [...this.steps.values()]
      .filter((step) => step.workflowInstanceId === instanceId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async recordStepDecision(
    stepId: string,
    input: { decidedByPersonId: string; onBehalfOfPersonId: string | null; decision: string; reason: string | null },
  ) {
    const step = this.steps.get(stepId)!;
    step.decidedByPersonId = input.decidedByPersonId;
    step.onBehalfOfPersonId = input.onBehalfOfPersonId;
    step.decision = input.decision;
    step.reason = input.reason;
  }

  async updateInstance(id: string, input: { currentStep: number; status: string }) {
    const instance = this.instances.get(id)!;
    instance.currentStep = input.currentStep;
    instance.status = input.status;
  }

  async findOverduePendingSteps(now: Date) {
    return [...this.steps.values()]
      .filter((step) => {
        const instance = this.instances.get(step.workflowInstanceId)!;
        return (
          instance.status === 'Pending' &&
          instance.currentStep === step.sequence &&
          step.decision === null &&
          step.slaDueAt !== null &&
          step.slaDueAt < now
        );
      })
      .map((step) => ({
        instanceId: step.workflowInstanceId,
        subjectRef: this.instances.get(step.workflowInstanceId)!.subjectRef,
        stepSequence: step.sequence,
        slaDueAt: step.slaDueAt,
      }));
  }
}

describe('WorkflowService', () => {
  const makeService = () => {
    const repo = new FakeRepo();
    const escalate = jest.fn().mockResolvedValue('sw-1');
    const escalation = { escalate } as unknown as EscalationService;
    const service = new WorkflowService(repo as unknown as WorkflowRepository, escalation);
    return { service, repo, escalate };
  };

  it('runs a two-step approval chain to completion', async () => {
    const { service } = makeService();
    const started = await service.start({
      workflowType: 'booking-approval',
      subjectRef: 'BK-1',
      steps: [{ assigneePersonId: 'mgr1' }, { assigneePersonId: 'ceo1' }],
      slaMinutes: 60,
    });
    expect(started.status).toBe('Pending');
    expect(started.currentStep).toBe(0);
    expect(started.steps).toHaveLength(2);

    const afterStep1 = await service.decide(started.id, {
      actorPersonId: 'mgr1',
      decision: 'APPROVED',
    });
    expect(afterStep1.status).toBe('Pending');
    expect(afterStep1.currentStep).toBe(1);

    const afterStep2 = await service.decide(started.id, {
      actorPersonId: 'ceo1',
      decision: 'APPROVED',
    });
    expect(afterStep2.status).toBe('Approved');
    expect(afterStep2.steps.every((step) => step.decision === 'APPROVED')).toBe(true);
  });

  it('rejects the whole chain on a rejection', async () => {
    const { service } = makeService();
    const started = await service.start({
      workflowType: 'booking-approval',
      subjectRef: 'BK-2',
      steps: [{ assigneePersonId: 'mgr1' }, { assigneePersonId: 'ceo1' }],
    });
    const result = await service.decide(started.id, {
      actorPersonId: 'mgr1',
      decision: 'REJECTED',
      reason: 'no budget',
    });
    expect(result.status).toBe('Rejected');
    expect(result.steps[0]!.reason).toBe('no budget');
  });

  it('records a delegated decision "on behalf of" the assignee (SoD-06)', async () => {
    const { service } = makeService();
    const started = await service.start({
      workflowType: 'entitlement-approval',
      subjectRef: 'ENT-1',
      steps: [{ assigneePersonId: 'mgr1' }],
    });
    const result = await service.decide(started.id, {
      actorPersonId: 'delegate1',
      decision: 'APPROVED',
      onBehalfOfPersonId: 'mgr1',
    });
    expect(result.status).toBe('Approved');
    expect(result.steps[0]!.decidedByPersonId).toBe('delegate1');
    expect(result.steps[0]!.onBehalfOfPersonId).toBe('mgr1');
  });

  it('forbids a decision by someone who is not the assignee', async () => {
    const { service } = makeService();
    const started = await service.start({
      workflowType: 'booking-approval',
      subjectRef: 'BK-3',
      steps: [{ assigneePersonId: 'mgr1' }],
    });
    await expect(
      service.decide(started.id, { actorPersonId: 'stranger', decision: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a decision on an already-resolved instance', async () => {
    const { service } = makeService();
    const started = await service.start({
      workflowType: 'booking-approval',
      subjectRef: 'BK-4',
      steps: [{ assigneePersonId: 'mgr1' }],
    });
    await service.decide(started.id, { actorPersonId: 'mgr1', decision: 'APPROVED' });
    await expect(
      service.decide(started.id, { actorPersonId: 'mgr1', decision: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('escalates a step that passed its SLA and marks the instance Escalated', async () => {
    const { service, repo, escalate } = makeService();
    const started = await service.start({
      workflowType: 'booking-approval',
      subjectRef: 'BK-5',
      steps: [{ assigneePersonId: 'mgr1' }],
      slaMinutes: 60,
    });
    const wellPastSla = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const count = await service.escalateOverdue(wellPastSla);

    expect(count).toBe(1);
    expect(escalate).toHaveBeenCalledTimes(1);
    expect(escalate.mock.calls[0]![0].workType).toBe('escalation:workflow-sla-timeout');
    expect(repo.instances.get(started.id)!.status).toBe('Escalated');
  });
});
