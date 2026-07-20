import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { EntitlementsController } from './controllers/entitlements.controller';
import { EntitlementsRepository } from './repositories/entitlements.repository';
import { EntitlementService } from './services/entitlement.service';

/**
 * Dedicated-vehicle entitlements (M5). Imports the in-process PDP (eligibility +
 * approval chain), the workflow engine (Cluster-CEO chain) and Platform (audit);
 * `OutboxService` is global.
 */
@Module({
  imports: [PlatformModule, PolicyCoreModule, WorkflowModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsRepository, EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
