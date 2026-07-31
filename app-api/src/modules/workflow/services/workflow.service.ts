import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
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
import { DelegationService } from '../../platform/services/delegation.service';
import {
  type WorkflowExecutor,
  WorkflowRepository,
} from '../repositories/workflow.repository';

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
    private readonly delegations: DelegationService,
  ) {}

  /** Starts a chain within the caller's transaction when an executor is supplied. */
  async start(input: StartWorkflow, executor?: WorkflowExecutor): Promise<WorkflowView> {
    const snapshot = {
      workflowType: input.workflowType,
      steps: input.steps.map((step, index) => ({ stepKey: `step-${index + 1}`, assigneePersonId: step.assigneePersonId })),
      slaMinutes: input.slaMinutes ?? null,
    };
    const definitionDeploymentId = await this.repo.ensureDeployment({
      organizationId: input.organizationId,
      workflowType: input.workflowType,
      definitionKey: input.workflowType,
      snapshot,
      sha256: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
    }, executor);
    const instanceId = await this.repo.createInstance({
      organizationId: input.organizationId,
      workflowType: input.workflowType,
      subjectRef: input.subjectRef,
      definitionDeploymentId,
    }, executor);
    const slaDueAt = input.slaMinutes
      ? new Date(Date.now() + input.slaMinutes * 60_000)
      : null;
    await this.repo.createSteps(
      instanceId,
      input.steps.map((step) => ({
        assigneePersonId: step.assigneePersonId,
        slaDueAt,
      })),
      executor,
    );
    return this.view(instanceId, executor);
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
    if (onBehalfOf) {
      const activeDelegation = await this.delegations.activeForWorkflow({
        workflowInstanceId: instance.id,
        delegatorPersonId: onBehalfOf,
        delegatePersonId: input.actorPersonId,
        requestType: instance.workflowType,
        at: new Date(),
      });
      if (!activeDelegation) {
        throw new ForbiddenException({
          title: 'Delegation is not active for this workflow',
          reasons: ['workflow-delegation-not-active'],
        });
      }
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

  /** Applies one version-checked decision inside the caller's transaction. */
  async decideInTransaction(
    instanceId: string,
    input: DecideStep & { expectedStepVersion: number },
    executor: WorkflowExecutor,
  ): Promise<{ view: WorkflowView; decidedStepId: string }> {
    const instance = await this.repo.getInstanceForUpdate(instanceId, executor);
    if (!instance) throw new NotFoundException({ title: 'Unknown workflow', reasons: [`workflow-not-found:${instanceId}`] });
    if (instance.status !== 'Pending') throw new ConflictException({ title: 'Workflow already resolved', reasons: [`workflow-not-pending:${instance.status}`] });
    const current = await this.repo.getCurrentStepForUpdate(instanceId, instance.currentStep, executor);
    if (!current) throw new ConflictException({ title: 'Workflow step missing', reasons: [`workflow-current-step-missing:${instance.currentStep}`] });
    if (current.stateVersion !== input.expectedStepVersion) {
      throw new ConflictException({ title: 'Workflow step changed', reasons: ['workflow-version-conflict'] });
    }
    const onBehalfOf = input.onBehalfOfPersonId ?? null;
    const effectiveAssignee = onBehalfOf ?? input.actorPersonId;
    if (current.assigneePersonId !== effectiveAssignee) {
      throw new ForbiddenException({ title: 'Not the assigned approver', reasons: ['workflow-actor-not-assignee'] });
    }
    if (onBehalfOf) {
      const active = await this.delegations.activeForWorkflow({
        workflowInstanceId: instance.id,
        delegatorPersonId: onBehalfOf,
        delegatePersonId: input.actorPersonId,
        requestType: instance.workflowType,
        at: new Date(),
      });
      if (!active) throw new ForbiddenException({ title: 'Delegation is not active for this workflow', reasons: ['workflow-delegation-not-active'] });
    }
    const steps = await this.repo.listSteps(instanceId, executor);
    const transition = advanceChain(steps.length, instance.currentStep, input.decision);
    await this.repo.recordStepDecision(current.id, {
      decidedByPersonId: input.actorPersonId,
      onBehalfOfPersonId: onBehalfOf,
      decision: input.decision,
      reason: input.reason ?? null,
      stateVersion: current.stateVersion + 1,
    }, executor);
    await this.repo.updateInstance(instanceId, { currentStep: transition.currentStep, status: transition.status, stateVersion: instance.stateVersion + 1 }, executor);
    return { view: await this.view(instanceId, executor), decidedStepId: current.id };
  }

  /** Expires one still-pending workflow inside the caller's domain transaction. */
  async expireInTransaction(instanceId: string, executor: WorkflowExecutor): Promise<void> {
    const instance = await this.repo.getInstanceForUpdate(instanceId, executor);
    if (!instance) throw new NotFoundException({ title: 'Unknown workflow', reasons: [`workflow-not-found:${instanceId}`] });
    if (instance.status !== 'Pending') throw new ConflictException({ title: 'Workflow already resolved', reasons: [`workflow-not-pending:${instance.status}`] });
    await this.repo.updateInstance(instanceId, { currentStep: instance.currentStep, status: 'Expired', stateVersion: instance.stateVersion + 1 }, executor);
  }

  /**
   * Escalates every Pending step past its SLA (interim runner for the BullMQ
   * scheduler). Each overdue instance is moved to `Escalated` and a durable
   * escalation is enqueued. Returns the number escalated.
   */
  async escalateOverdue(now = new Date(), executor?: WorkflowExecutor): Promise<number> {
    const overdue = await this.repo.findOverduePendingSteps(now, executor);
    for (const row of overdue) {
      await this.escalation.escalate({
        workType: ESCALATION_WORK_TYPE.workflowSlaTimeout,
        subjectRef: row.subjectRef,
        reason: `step ${row.stepSequence} passed SLA (${row.slaDueAt?.toISOString() ?? 'n/a'})`,
      });
      await this.repo.updateInstance(row.instanceId, {
        currentStep: row.stepSequence,
        status: 'Escalated',
      }, executor);
    }
    return overdue.length;
  }

  /** Runs one advisory-lock-protected SLA escalation cycle. */
  runEscalationCycle(now = new Date()): Promise<number> {
    return this.repo.withEscalationLock((executor) => this.escalateOverdue(now, executor));
  }

  /** Reads an instance + steps into a view projection. */
  private async view(instanceId: string, executor?: WorkflowExecutor): Promise<WorkflowView> {
    const instance = await this.repo.getInstance(instanceId, executor);
    if (!instance) {
      throw new NotFoundException({
        title: 'Unknown workflow',
        reasons: [`workflow-not-found:${instanceId}`],
      });
    }
    const steps = await this.repo.listSteps(instanceId, executor);
    return {
      id: instance.id,
      workflowType: instance.workflowType,
      subjectRef: instance.subjectRef,
      currentStep: instance.currentStep,
      status: instance.status,
      definitionDeploymentId: instance.definitionDeploymentId!,
      stateVersion: instance.stateVersion,
      steps: steps.map((step) => ({
        id: step.id,
        sequence: step.sequence,
        assigneePersonId: step.assigneePersonId,
        decidedByPersonId: step.decidedByPersonId,
        onBehalfOfPersonId: step.onBehalfOfPersonId,
        decision: step.decision as WorkflowView['steps'][number]['decision'],
        reason: step.reason,
        stateVersion: step.stateVersion,
        slaDueAt: step.slaDueAt?.toISOString() ?? null,
      })),
    };
  }
}
