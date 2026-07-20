import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { DashboardsController } from './controllers/dashboards.controller';
import { DashboardsRepository } from './repositories/dashboards.repository';
import { DashboardsService } from './services/dashboards.service';

/**
 * Read models (M9) — role/scope cost-masked dashboards + the real operations
 * overview (retires the Phase-0 mock). Read-only; no new domain state or
 * migration. Imports Platform for hierarchy scope roll-up.
 */
@Module({
  imports: [PlatformModule],
  controllers: [DashboardsController],
  providers: [DashboardsRepository, DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
