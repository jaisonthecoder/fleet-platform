import { Module } from '@nestjs/common';

import { ReferenceModule } from '../reference/reference.module';

import { AiIntakeController } from './ai-intake.controller';
import { AiIntakeService } from './ai-intake.service';
import { GeminiIntakeClient } from './gemini-intake.client';
import { AiPricingService } from './pricing/ai-pricing.service';
import { GeminiClient } from './shared/gemini.client';

/**
 * Demo capability. Delete this folder and its one line in app.module to remove it.
 *
 * Two assistants, one transport. `AiPricingService` is exported rather than given
 * a controller of its own: the pricing module already knows which staff user may
 * touch which branch's quote, and a second route would have to re-answer that.
 */
@Module({
  imports: [ReferenceModule],
  controllers: [AiIntakeController],
  providers: [AiIntakeService, AiPricingService, GeminiIntakeClient, GeminiClient],
  exports: [AiPricingService],
})
export class AiIntakeModule {}
