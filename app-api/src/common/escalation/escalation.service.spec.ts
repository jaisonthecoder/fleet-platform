import type { DrizzleDatabase } from '../database/database.module';
import { EscalationService, ESCALATION_WORK_TYPE } from './escalation.service';

describe('EscalationService', () => {
  it('enqueues a durable scheduled_work row and returns its id', async () => {
    const captured: Record<string, unknown>[] = [];
    const db = {
      insert: () => ({
        values: (vals: Record<string, unknown>) => ({
          returning: async () => {
            captured.push(vals);
            return [{ id: 'sw-1' }];
          },
        }),
      }),
    } as unknown as DrizzleDatabase;

    const service = new EscalationService(db);
    const id = await service.escalate({
      workType: ESCALATION_WORK_TYPE.pdpFailSafe,
      subjectRef: 'pdp:driver-eligibility',
      reason: 'no active rule',
    });

    expect(id).toBe('sw-1');
    expect(captured).toHaveLength(1);
    expect(captured[0]!.workType).toBe(ESCALATION_WORK_TYPE.pdpFailSafe);
    expect(captured[0]!.subjectRef).toBe('pdp:driver-eligibility');
    expect(captured[0]!.status).toBe('Pending');
    expect(captured[0]!.dueAt).toBeInstanceOf(Date);
  });

  it('never throws back into the decision path (returns null on DB failure)', async () => {
    const db = {
      insert: () => {
        throw new Error('db down');
      },
    } as unknown as DrizzleDatabase;

    const service = new EscalationService(db);
    await expect(
      service.escalate({
        workType: ESCALATION_WORK_TYPE.workflowSlaTimeout,
        subjectRef: 'wf-1',
        reason: 'sla',
      }),
    ).resolves.toBeNull();
  });
});
