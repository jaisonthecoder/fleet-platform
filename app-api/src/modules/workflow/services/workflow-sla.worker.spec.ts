import { WorkflowSlaWorker } from './workflow-sla.worker';

describe('WorkflowSlaWorker', () => {
  it('runs the advisory-lock-protected escalation cycle', async () => {
    const workflows = { runEscalationCycle: jest.fn().mockResolvedValue(2) };
    const worker = new WorkflowSlaWorker(workflows as never);

    await worker.escalateOverdueSteps();

    expect(workflows.runEscalationCycle).toHaveBeenCalledTimes(1);
  });

  it('contains failures so the next hourly cycle can retry', async () => {
    const workflows = { runEscalationCycle: jest.fn().mockRejectedValue(new Error('injected')) };
    const worker = new WorkflowSlaWorker(workflows as never);

    await expect(worker.escalateOverdueSteps()).resolves.toBeUndefined();
  });
});