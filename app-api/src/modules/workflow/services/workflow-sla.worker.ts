import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkflowService } from './workflow.service';

/** Escalates configured overdue workflow steps once per hour across replicas. */
@Injectable()
export class WorkflowSlaWorker {
  private readonly logger = new Logger(WorkflowSlaWorker.name);

  constructor(private readonly workflows: WorkflowService) {}

  /** Runs the advisory-lock-protected workflow SLA cycle. */
  @Cron(CronExpression.EVERY_HOUR)
  async escalateOverdueSteps(): Promise<void> {
    try {
      const escalated = await this.workflows.runEscalationCycle();
      if (escalated) this.logger.log({ event: 'workflow_sla_escalated', escalated });
    } catch (error) {
      this.logger.error('Workflow SLA escalation failed', error instanceof Error ? error.stack : String(error));
    }
  }
}