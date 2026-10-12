import { Module } from '@nestjs/common';

/**
 * Phase 2 module.
 *
 * Shipment tracking and milestones, sourced from CW1.
 *
 * All customer data access goes through TenantRepository (provided globally by
 * CommonModule). Every controller endpoint carries @RequirePermission.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class ShipmentsModule {}
