import { Global, Module } from '@nestjs/common';
import { EscalationService } from './escalation.service';

/**
 * Global escalation module. Exposes the shared {@link EscalationService} to any
 * deployable (API, PDP) that needs to enqueue a durable human escalation.
 */
@Global()
@Module({
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
