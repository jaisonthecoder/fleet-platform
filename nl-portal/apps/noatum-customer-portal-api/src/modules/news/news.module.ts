import { Module } from '@nestjs/common';

/**
 * Phase 1 module.
 *
 * Noatum-authored news: global items plus per-group targeting.
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
export class NewsModule {}
