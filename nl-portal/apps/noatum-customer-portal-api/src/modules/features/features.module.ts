import { Module } from '@nestjs/common';
import { FeaturesController } from './features.controller';
import { FeaturesRepository } from './features.repository';
import { FeaturesService } from './features.service';

/**
 * Platform feature management.
 *
 * Owns the administration surface for the switch catalogue. The catalogue itself
 * and the runtime lookup live in common/features so any module can read a switch
 * without importing this one.
 */
@Module({
  controllers: [FeaturesController],
  providers: [FeaturesRepository, FeaturesService],
})
export class FeaturesModule {}
