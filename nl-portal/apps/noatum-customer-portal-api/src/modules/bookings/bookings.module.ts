import { Module } from '@nestjs/common';

/**
 * Phase 3 module.
 *
 * Booking creation and amendment against CW1.
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
export class BookingsModule {}
