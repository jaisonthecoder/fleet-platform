import { Module } from '@nestjs/common';

import { IntegrationModule } from '../../integration/integration.module';

import { QuotesController } from './quotes.controller';
import { QuoteInsightsService } from './quote-insights.service';
import { QuotesService } from './quotes.service';

/**
 * Phase 1 module.
 *
 * Quote capture and synchronous rating via RateEngineAdapter.
 *
 * The concrete RateEngineAdapter comes from IntegrationModule, so nothing here knows
 * whether rates arrive from CW1 or the simulator.
 */
@Module({
  imports: [IntegrationModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteInsightsService],
  exports: [QuotesService],
})
export class QuotesModule {}
