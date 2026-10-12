import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { LookupsRepository } from './lookups.repository';
import { LookupsService } from './lookups.service';

/**
 * Reference-data administration.
 *
 * Read-only in this increment: the catalogue and its items are browsable, and
 * maintenance arrives once LM-D01 settles which datasets are portal-owned.
 * Customer-facing option projections are a separate surface and are not served
 * from here - these routes require an internal administration permission.
 */
@Module({
  controllers: [LookupsController],
  providers: [LookupsRepository, LookupsService],
})
export class LookupsModule {}
