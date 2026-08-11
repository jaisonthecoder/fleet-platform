import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ConfigModule } from '../config/config.module';
import { ConsentAdministrationModule } from '../consent-administration/consent-administration.module';
import { EntitlementsController } from './controllers/entitlements.controller';
import { EntitlementsRepository } from './repositories/entitlements.repository';
import { EntitlementService } from './services/entitlement.service';
import { EntitlementConsentTemplateProvider, GovernedEntitlementConsentTemplateProvider } from './services/entitlement-consent-template.provider';
import { EntitlementBsdWorker } from './services/entitlement-bsd.worker';
import { EntitlementPreviewRetentionWorker } from './services/entitlement-preview-retention.worker';
import {
  LegacyDedicatedEligibilityAdapter,
  LegacyEntitlementApprovalRouteAdapter,
} from './internal/legacy-entitlement-decision.adapters';

/**
 * Dedicated-vehicle entitlements (M5). Imports the in-process PDP (eligibility +
 * approval chain), the workflow engine (Cluster-CEO chain) and Platform (audit);
 * `OutboxService` is global.
 */
@Module({
  imports: [PlatformModule, PolicyCoreModule, WorkflowModule, ConfigModule, ConsentAdministrationModule],
  controllers: [EntitlementsController],
  providers: [
    EntitlementsRepository,
    EntitlementService,
    LegacyDedicatedEligibilityAdapter,
    LegacyEntitlementApprovalRouteAdapter,
    EntitlementBsdWorker,
    EntitlementPreviewRetentionWorker,
    { provide: EntitlementConsentTemplateProvider, useClass: GovernedEntitlementConsentTemplateProvider },
  ],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
