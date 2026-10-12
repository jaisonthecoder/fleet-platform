import { Module } from '@nestjs/common';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Phase 1 module.
 *
 * Aggregated tiles for the landing page. Read-only, cached per tenant.
 *
 * All customer data access goes through TenantRepository (provided globally by
 * CommonModule). Every controller endpoint carries @RequirePermission.
 */
@Module({
  imports: [],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
