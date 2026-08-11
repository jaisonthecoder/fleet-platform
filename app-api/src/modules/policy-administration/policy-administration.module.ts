import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { PolicyAdministrationController } from './controllers/policy-administration.controller';
import { DomainDecisionAdministrationController } from './controllers/domain-decision-administration.controller';
import { PolicyDraftRepository } from './repositories/policy-draft.repository';
import { PolicyAdministrationService } from './services/policy-administration.service';
import { DomainDecisionAdministrationService } from './services/domain-decision-administration.service';
import { DomainDecisionComparisonRetentionWorker } from './services/domain-decision-comparison-retention.worker';

@Module({
  imports: [PlatformModule, PolicyCoreModule],
  controllers: [PolicyAdministrationController, DomainDecisionAdministrationController],
  providers: [PolicyDraftRepository, PolicyAdministrationService, DomainDecisionAdministrationService, DomainDecisionComparisonRetentionWorker],
})
export class PolicyAdministrationModule {}
