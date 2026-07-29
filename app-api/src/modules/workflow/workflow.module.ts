import { Module } from '@nestjs/common';
import { WorkflowRepository } from './repositories/workflow.repository';
import { WorkflowService } from './services/workflow.service';
import { PlatformModule } from '../platform/platform.module';
import { WorkflowSlaWorker } from './services/workflow-sla.worker';

/**
 * Approval-workflow engine (P4). Internal — no HTTP surface in Phase 0; Block A
 * (booking/entitlement approvals) consumes {@link WorkflowService} directly.
 */
@Module({
  imports: [PlatformModule],
  providers: [WorkflowRepository, WorkflowService, WorkflowSlaWorker],
  exports: [WorkflowService],
})
export class WorkflowModule {}
