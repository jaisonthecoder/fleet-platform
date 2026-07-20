import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PlatformModule } from '../platform/platform.module';
import { VehicleController } from './controllers/vehicle.controller';
import { VehicleRepository } from './repositories/vehicle.repository';
import { DocumentVaultService } from './services/document-vault.service';
import { TransferService } from './services/transfer.service';
import { VehicleService } from './services/vehicle.service';

/**
 * Vehicle master (M2). CRUD + lifecycle transitions + document vault + transfer,
 * with lookup-validated classification (ConfigModule), audit (PlatformModule)
 * and transactional `VehicleChanged` events (MessagingModule is global).
 */
@Module({
  imports: [PlatformModule, ConfigModule],
  controllers: [VehicleController],
  providers: [VehicleRepository, VehicleService, DocumentVaultService, TransferService],
  exports: [VehicleService],
})
export class VehiclesModule {}
