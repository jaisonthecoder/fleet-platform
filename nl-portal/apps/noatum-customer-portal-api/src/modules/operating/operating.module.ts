import { Module } from '@nestjs/common';

import { OperatingController } from './operating.controller';
import { OperatingRepository } from './operating.repository';
import { OperatingService } from './operating.service';

/**
 * Noatum operating structure: regions and branches.
 *
 * Portal-owned reference data maintained by hand. File import and API discovery
 * are planned as additive, non-destructive follow-ups; neither is wired here yet.
 */
@Module({
  controllers: [OperatingController],
  providers: [OperatingRepository, OperatingService],
})
export class OperatingModule {}
