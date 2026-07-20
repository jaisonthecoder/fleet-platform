import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { HandoverController } from './controllers/handover.controller';
import { HandoverRepository } from './repositories/handover.repository';
import { HandoverService } from './services/handover.service';

/**
 * Vehicle handover & return (M6). Imports Bookings (verify booking + drive the
 * Approved → Active → Completed lifecycle), the in-process PDP (advisory
 * fuel-deviation threshold) and Platform (audit); `OutboxService` is global.
 */
@Module({
  imports: [PlatformModule, PolicyCoreModule, BookingsModule],
  controllers: [HandoverController],
  providers: [HandoverRepository, HandoverService],
  exports: [HandoverService],
})
export class HandoverModule {}
