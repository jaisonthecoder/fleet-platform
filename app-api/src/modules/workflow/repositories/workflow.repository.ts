import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../common/database/database.constants';
import type { DrizzleDatabase } from '../../../common/database/database.module';
import { workflowDefinition, workflowDefinitionDeployment, workflowInstance, workflowStep } from '../../../common/database/schema';
import type { StepDecision, WorkflowStatus } from '../internal/chain';

export type WorkflowExecutor = Pick<DrizzleDatabase, 'insert' | 'select' | 'update'>;

/** Data access for the workflow engine (hides Drizzle from the service). */
@Injectable()
export class WorkflowRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  /** Serializes the hourly SLA escalation cycle across API replicas. */
  withEscalationLock<T>(work: (executor: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('workflow-sla-escalation'))`);
      return work(tx);
    });
  }

  /** Resolves or creates one immutable deployment for the canonical snapshot hash. */
  async ensureDeployment(input: {
    organizationId: string;
    workflowType: string;
    definitionKey: string;
    snapshot: unknown;
    sha256: string;
  }, executor: WorkflowExecutor = this.db): Promise<string> {
    await executor.insert(workflowDefinition).values({
      organizationId: input.organizationId,
      workflowType: input.workflowType,
      definitionKey: input.definitionKey,
    }).onConflictDoNothing();
    const [definition] = await executor.select().from(workflowDefinition)
      .where(and(eq(workflowDefinition.organizationId, input.organizationId), eq(workflowDefinition.workflowType, input.workflowType), eq(workflowDefinition.definitionKey, input.definitionKey)))
      .limit(1);
    if (!definition) throw new Error('workflow definition resolution failed');
    const [existing] = await executor.select().from(workflowDefinitionDeployment)
      .where(and(eq(workflowDefinitionDeployment.workflowDefinitionId, definition.id), eq(workflowDefinitionDeployment.definitionSha256, input.sha256)))
      .limit(1);
    if (existing) return existing.id;
    const [latest] = await executor.select({ version: workflowDefinitionDeployment.version })
      .from(workflowDefinitionDeployment)
      .where(eq(workflowDefinitionDeployment.workflowDefinitionId, definition.id))
      .orderBy(desc(workflowDefinitionDeployment.version)).limit(1);
    const rows = await executor.insert(workflowDefinitionDeployment).values({
      workflowDefinitionId: definition.id,
      version: (latest?.version ?? 0) + 1,
      definitionSnapshot: input.snapshot,
      definitionSha256: input.sha256,
    }).onConflictDoNothing().returning({ id: workflowDefinitionDeployment.id });
    if (rows[0]) return rows[0].id;
    const [raced] = await executor.select({ id: workflowDefinitionDeployment.id })
      .from(workflowDefinitionDeployment)
      .where(and(eq(workflowDefinitionDeployment.workflowDefinitionId, definition.id), eq(workflowDefinitionDeployment.definitionSha256, input.sha256))).limit(1);
    if (!raced) throw new Error('workflow deployment resolution failed');
    return raced.id;
  }

  /** Creates a Pending instance at step 0 and returns its id. */
  async createInstance(input: {
    organizationId: string;
    workflowType: string;
    subjectRef: string;
    definitionDeploymentId: string;
  }, executor: WorkflowExecutor = this.db): Promise<string> {
    const rows = await executor
      .insert(workflowInstance)
      .values({ organizationId: input.organizationId, workflowType: input.workflowType, subjectRef: input.subjectRef, definitionDeploymentId: input.definitionDeploymentId })
      .returning({ id: workflowInstance.id });
    return rows[0]!.id;
  }

  /** Creates the ordered steps of a chain in one insert. */
  async createSteps(
    instanceId: string,
    steps: { assigneePersonId: string; slaDueAt: Date | null }[],
    executor: WorkflowExecutor = this.db,
  ) {
    return executor.insert(workflowStep).values(
      steps.map((step, index) => ({
        workflowInstanceId: instanceId,
        sequence: index,
        assigneePersonId: step.assigneePersonId,
        slaDueAt: step.slaDueAt,
      })),
    ).returning();
  }

  /** Loads one instance, or undefined. */
  async getInstance(id: string, executor: WorkflowExecutor = this.db) {
    const rows = await executor
      .select()
      .from(workflowInstance)
      .where(eq(workflowInstance.id, id))
      .limit(1);
    return rows[0];
  }

  /** Locks one workflow instance for an atomic domain decision. */
  async getInstanceForUpdate(id: string, executor: WorkflowExecutor) {
    const rows = await executor.select().from(workflowInstance)
      .where(eq(workflowInstance.id, id)).limit(1).for('update');
    return rows[0];
  }

  /** Locks the current workflow step after the instance is locked. */
  async getCurrentStepForUpdate(instanceId: string, sequence: number, executor: WorkflowExecutor) {
    const rows = await executor.select().from(workflowStep)
      .where(and(eq(workflowStep.workflowInstanceId, instanceId), eq(workflowStep.sequence, sequence)))
      .limit(1).for('update');
    return rows[0];
  }

  /** Lists the steps of an instance in sequence order. */
  async listSteps(instanceId: string, executor: WorkflowExecutor = this.db) {
    return executor
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
      stateVersion?: number;
    },
    executor: WorkflowExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(workflowStep)
      .set({
        decidedByPersonId: input.decidedByPersonId,
        onBehalfOfPersonId: input.onBehalfOfPersonId,
        decision: input.decision,
        reason: input.reason,
        decidedAt: new Date(),
        ...(input.stateVersion ? { stateVersion: input.stateVersion } : {}),
      })
      .where(eq(workflowStep.id, stepId));
  }

  /** Advances the instance pointer/status after a transition. */
  async updateInstance(
    id: string,
    input: { currentStep: number; status: WorkflowStatus; stateVersion?: number },
    executor: WorkflowExecutor = this.db,
  ): Promise<void> {
    await executor
      .update(workflowInstance)
      .set({ currentStep: input.currentStep, status: input.status, ...(input.stateVersion ? { stateVersion: input.stateVersion } : {}) })
      .where(eq(workflowInstance.id, id));
  }

  /**
   * Pending, undecided steps whose SLA has elapsed (drives timeout escalation).
   * Joins to the instance so only still-Pending instances are returned.
   */
  async findOverduePendingSteps(now: Date, executor: WorkflowExecutor = this.db) {
    return executor
      .select({
        instanceId: workflowInstance.id,
        organizationId: workflowInstance.organizationId,
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
