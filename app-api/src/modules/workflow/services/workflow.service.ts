import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ESCALATION_WORK_TYPE,
  EscalationService,
} from '../../../common/escalation/escalation.service';
import type {
  DecideStep,
  StartWorkflow,
  WorkflowView,
} from '../../../contracts/workflow.contract';
import { advanceChain } from '../internal/chain';
import { WorkflowRepository } from '../repositories/workflow.repository';

/**
 * Approval-workflow engine (P4). One engine drives every approval chain
 * (booking, entitlement, …): chain execution, delegated decisions recorded
 * "on behalf of" (SoD-06), and SLA-timeout escalation onto the durable
 * `scheduled_work` ledger. Phase 0 is the skeleton the Block-A booking and
 * entitlement chains build on; a BullMQ scheduler will drive
 * {@link escalateOverdue} on a cadence.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly repo: WorkflowRepository,
    private readonly escalation: EscalationService,
  ) {}

  /** Starts a chain: creates the instance + ordered steps with per-step SLA. */
  async start(input: StartWorkflow): Promise<WorkflowView> {
    const instanceId = await this.repo.createInstance({
      workflowType: input.workflowType,
      subjectRef: input.subjectRef,
    });
    const slaDueAt = input.slaMinutes
      ? new Date(Date.now() + input.slaMinutes * 60_000)
      : null;
    await this.repo.createSteps(
      instanceId,
      input.steps.map((step) => ({
        assigneePersonId: step.assigneePersonId,
        slaDueAt,
      })),
    );
    return this.view(instanceId);
  }

  /** Records a decision on the current step and advances/terminates the chain. */
  async decide(instanceId: string, input: DecideStep): Promise<WorkflowView> {
    const instance = await this.repo.getInstance(instanceId);
    if (!instance) {
      throw new NotFoundException({
        title: 'Unknown workflow',
        reasons: [`workflow-not-found:${instanceId}`],
      });
    }
    if (instance.status !== 'Pending') {
      throw new ConflictException({
        title: 'Workflow already resolved',
        reasons: [`workflow-not-pending:${instance.status}`],
      });
    }

    const steps = await this.repo.listSteps(instanceId);
    const current = steps.find((step) => step.sequence === instance.currentStep);
    if (!current) {
      throw new ConflictException({
        title: 'Workflow step missing',
        reasons: [`workflow-current-step-missing:${instance.currentStep}`],
      });
    }

    // Authorization: the assignee decides, or a delegate decides on their behalf.
    const onBehalfOf = input.onBehalfOfPersonId ?? null;
    const effectiveAssignee = onBehalfOf ?? input.actorPersonId;
    if (current.assigneePersonId !== effectiveAssignee) {
      throw new ForbiddenException({
        title: 'Not the assigned approver',
        reasons: ['workflow-actor-not-assignee'],
      });
    }

    await this.repo.recordStepDecision(current.id, {
      decidedByPersonId: input.actorPersonId,
      onBehalfOfPersonId: onBehalfOf,
      decision: input.decision,
      reason: input.reason ?? null,
    });

    const transition = advanceChain(
      steps.length,
      instance.currentStep,
      input.decision,
    );
    await this.repo.updateInstance(instanceId, {
      currentStep: transition.currentStep,
      status: transition.status,
    });

    return this.view(instanceId);
  }

  /**
   * Escalates every Pending step past its SLA (interim runner for the BullMQ
   * scheduler). Each overdue instance is moved to `Escalated` and a durable
   * escalation is enqueued. Returns the number escalated.
   */
  async escalateOverdue(now = new Date()): Promise<number> {
    const overdue = await this.repo.findOverduePendingSteps(now);
    for (const row of overdue) {
      await this.escalation.escalate({
        workType: ESCALATION_WORK_TYPE.workflowSlaTimeout,
        subjectRef: row.subjectRef,
        reason: `step ${row.stepSequence} passed SLA (${row.slaDueAt?.toISOString() ?? 'n/a'})`,
      });
      await this.repo.updateInstance(row.instanceId, {
        currentStep: row.stepSequence,
        status: 'Escalated',
      });
    }
    return overdue.length;
  }

  /** Reads an instance + steps into a view projection. */
  private async view(instanceId: string): Promise<WorkflowView> {
    const instance = await this.repo.getInstance(instanceId);
    if (!instance) {
      throw new NotFoundException({
        title: 'Unknown workflow',
        reasons: [`workflow-not-found:${instanceId}`],
      });
    }
    const steps = await this.repo.listSteps(instanceId);
    return {
      id: instance.id,
      workflowType: instance.workflowType,
      subjectRef: instance.subjectRef,
      currentStep: instance.currentStep,
      status: instance.status,
      steps: steps.map((step) => ({
        sequence: step.sequence,
        assigneePersonId: step.assigneePersonId,
        decidedByPersonId: step.decidedByPersonId,
        onBehalfOfPersonId: step.onBehalfOfPersonId,
        decision: step.decision as WorkflowView['steps'][number]['decision'],
        reason: step.reason,
      })),
    };
  }
}
