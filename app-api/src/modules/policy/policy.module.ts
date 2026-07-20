import { Module } from '@nestjs/common';
import { HealthService } from '../health/services/health.service';
import { PdpHealthController } from './controllers/pdp-health.controller';
import { PolicyController } from './controllers/policy.controller';
import { PolicyCoreModule } from './policy-core.module';
import { DecisionLogService } from './services/decision-log.service';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [PolicyCoreModule, PlatformModule],
  controllers: [PolicyController, PdpHealthController],
  providers: [DecisionLogService, HealthService],
})
export class PolicyModule {}
