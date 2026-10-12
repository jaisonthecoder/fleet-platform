import { Module } from '@nestjs/common';

import { IntegrationModule } from '../../integration/integration.module';
import { AiIntakeModule } from '../ai-intake/ai-intake.module';
import { ReferenceModule } from '../reference/reference.module';

import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

// Publishing queues a notification and records the CargoWise copy, so this module
// needs JobsService and IntegrationMessageService - both exported by IntegrationModule.
// The pricing screen's carrier and charge-basis lists come from the lookups, which
// ReferenceModule exports. AiIntakeModule supplies the drafting assistant; this module
// keeps the authorisation, which is why the assistant has no controller of its own.
@Module({
  imports: [IntegrationModule, ReferenceModule, AiIntakeModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
