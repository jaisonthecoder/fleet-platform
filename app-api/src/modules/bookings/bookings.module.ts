import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ConsentAdministrationModule } from '../consent-administration/consent-administration.module';
import { BookingsController } from './controllers/bookings.controller';
import { BookingsRepository } from './repositories/bookings.repository';
import { BookingService } from './services/booking.service';
import {
  ConsentTemplateProvider,
  GovernedConsentTemplateProvider,
} from './services/consent-template.provider';

/**
 * Pool-vehicle booking (M4). The correctness-critical core loop: search →
 * consent → approve, with the double-book exclusion, consent atomicity, and the
 * compliance eligibility hard gate. Imports the eligibility gate (Compliance),
 * the in-process PDP (PolicyCore), the approval engine (Workflow) and audit
 * (Platform); `OutboxService` is global (MessagingModule).
 */
@Module({
  imports: [PlatformModule, ComplianceModule, PolicyCoreModule, WorkflowModule, ConsentAdministrationModule],
  controllers: [BookingsController],
  providers: [
    BookingsRepository,
    BookingService,
    {
      provide: ConsentTemplateProvider,
      useClass: GovernedConsentTemplateProvider,
    },
  ],
  exports: [BookingService],
})
export class BookingsModule {}
