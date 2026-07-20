import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PlatformModule } from '../platform/platform.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { ImportController } from './controllers/import.controller';
import { ImportRepository } from './repositories/import.repository';
import { ImportService } from './services/import.service';

/**
 * Bulk migration (M3): stage → validate → dedup → reconcile → steward sign-off
 * → commit to the vehicle master. Imports ConfigModule (lookup validation),
 * VehiclesModule (commit) and PlatformModule (audit).
 */
@Module({
  imports: [PlatformModule, ConfigModule, VehiclesModule],
  controllers: [ImportController],
  providers: [ImportRepository, ImportService],
  exports: [ImportService],
})
export class MigrationModule {}
