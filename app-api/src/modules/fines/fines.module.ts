import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { PlatformModule } from '../platform/platform.module';
import { PolicyCoreModule } from '../policy/policy-core.module';
import { FinesController } from './controllers/fines.controller';
import { FinesRepository } from './repositories/fines.repository';
import { FinesService } from './services/fines.service';

/**
 * Driver accountability — fines, black points, accidents, recovery, and the
 * substitution attribution model (M8). Imports Bookings (active-booking lookup
 * for attribution), Compliance (the shared platform-wide access block), the
 * in-process PDP (fines-HR threshold + black-point timeframe) and Platform
 * (audit); `OutboxService` is global.
 */
@Module({
  imports: [PlatformModule, PolicyCoreModule, BookingsModule, ComplianceModule],
  controllers: [FinesController],
  providers: [FinesRepository, FinesService],
  exports: [FinesService],
})
export class FinesModule {}
