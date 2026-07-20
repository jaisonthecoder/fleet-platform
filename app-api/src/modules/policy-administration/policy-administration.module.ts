import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { PolicyAdministrationController } from './controllers/policy-administration.controller';
import { PolicyDraftRepository } from './repositories/policy-draft.repository';
import { PolicyAdministrationService } from './services/policy-administration.service';

@Module({
  imports: [PlatformModule, PolicyCoreModule],
  controllers: [PolicyAdministrationController],
  providers: [PolicyDraftRepository, PolicyAdministrationService],
})
export class PolicyAdministrationModule {}
