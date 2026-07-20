import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { workflowInstance, workflowStep } from '../../../common/database/schema';
import type { StepDecision, WorkflowStatus } from '../internal/chain';

/** Data access for the workflow engine (hides Drizzle from the service). */
@Injectable()
export class WorkflowRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Creates a Pending instance at step 0 and returns its id. */
  async createInstance(input: {
    workflowType: string;
    subjectRef: string;
  }): Promise<string> {
    const rows = await this.db
      .insert(workflowInstance)
      .values({ workflowType: input.workflowType, subjectRef: input.subjectRef })
      .returning({ id: workflowInstance.id });
    return rows[0]!.id;
  }

  /** Creates the ordered steps of a chain in one insert. */
  async createSteps(
    instanceId: string,
    steps: { assigneePersonId: string; slaDueAt: Date | null }[],
  ): Promise<void> {
    await this.db.insert(workflowStep).values(
      steps.map((step, index) => ({
        workflowInstanceId: instanceId,
        sequence: index,
        assigneePersonId: step.assigneePersonId,
        slaDueAt: step.slaDueAt,
      })),
    );
  }

  /** Loads one instance, or undefined. */
  async getInstance(id: string) {
    const rows = await this.db
      .select()
      .from(workflowInstance)
      .where(eq(workflowInstance.id, id))
      .limit(1);
    return rows[0];
  }

  /** Lists the steps of an instance in sequence order. */
  async listSteps(instanceId: string) {
    return this.db
      .select()
      .from(workflowStep)
      .where(eq(workflowStep.workflowInstanceId, instanceId))
      .orderBy(asc(workflowStep.sequence));
  }

  /** Records a decision (and optional on-behalf-of) on one step. */
  async recordStepDecision(
    stepId: string,
    input: {
      decidedByPersonId: string;
      onBehalfOfPersonId: string | null;
      decision: StepDecision;
      reason: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(workflowStep)
      .set({
        decidedByPersonId: input.decidedByPersonId,
        onBehalfOfPersonId: input.onBehalfOfPersonId,
        decision: input.decision,
        reason: input.reason,
        decidedAt: new Date(),
      })
      .where(eq(workflowStep.id, stepId));
  }

  /** Advances the instance pointer/status after a transition. */
  async updateInstance(
    id: string,
    input: { currentStep: number; status: WorkflowStatus },
  ): Promise<void> {
    await this.db
      .update(workflowInstance)
      .set({ currentStep: input.currentStep, status: input.status })
      .where(eq(workflowInstance.id, id));
  }

  /**
   * Pending, undecided steps whose SLA has elapsed (drives timeout escalation).
   * Joins to the instance so only still-Pending instances are returned.
   */
  async findOverduePendingSteps(now: Date) {
    return this.db
      .select({
        instanceId: workflowInstance.id,
        subjectRef: workflowInstance.subjectRef,
        stepSequence: workflowStep.sequence,
        slaDueAt: workflowStep.slaDueAt,
      })
      .from(workflowStep)
      .innerJoin(
        workflowInstance,
        eq(workflowInstance.id, workflowStep.workflowInstanceId),
      )
      .where(
        and(
          eq(workflowInstance.status, 'Pending'),
          eq(workflowInstance.currentStep, workflowStep.sequence),
          isNull(workflowStep.decision),
          isNotNull(workflowStep.slaDueAt),
          lt(workflowStep.slaDueAt, now),
        ),
      );
  }
}
