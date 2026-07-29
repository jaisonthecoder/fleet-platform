import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PlatformModule } from '../platform/platform.module';
import { VendorController } from './controllers/vendor.controller';
import { IntegratedVendorProvider } from './providers/integrated-vendor.provider';
import { ManualVendorProvider } from './providers/manual-vendor.provider';
import { VENDOR_SOURCE_PROVIDERS } from './providers/vendor-source.provider';
import { VendorRepository } from './repositories/vendor.repository';
import { VendorSourceResolver } from './services/vendor-source.resolver';
import { VendorService } from './services/vendor.service';
import { VendorVehicleHealthWorker } from './services/vendor-vehicle-health.worker';

/**
 * Vendor master + lease contracts (S1/S2), designed to be plug-and-play across
 * organizations. `sourceMode` + the {@link VENDOR_SOURCE_PROVIDERS} strategy let
 * an org keep vendors as an in-app module, enter them manually, or (future
 * scope) mirror them from an external system — without changing the service.
 * Lookup-validated categories (ConfigModule), audit (PlatformModule) and
 * transactional outbox events (global MessagingModule) match the vehicle master.
 */
@Module({
  imports: [PlatformModule, ConfigModule],
  controllers: [VendorController],
  providers: [
    VendorRepository,
    VendorService,
    VendorVehicleHealthWorker,
    VendorSourceResolver,
    ManualVendorProvider,
    IntegratedVendorProvider,
    {
      provide: VENDOR_SOURCE_PROVIDERS,
      useFactory: (
        manual: ManualVendorProvider,
        integrated: IntegratedVendorProvider,
      ) => [manual, integrated],
      inject: [ManualVendorProvider, IntegratedVendorProvider],
    },
  ],
  exports: [VendorService],
})
export class VendorsModule {}
