import { Module } from '@nestjs/common';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowService } from './services/workflow.service';

/**
 * Approval-workflow engine (P4). Internal — no HTTP surface in Phase 0; Block A
 * (booking/entitlement approvals) consumes {@link WorkflowService} directly.
 */
@Module({
  providers: [WorkflowRepository, WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
