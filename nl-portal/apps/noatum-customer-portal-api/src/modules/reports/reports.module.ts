import { Module } from '@nestjs/common';

/**
 * Cross-cutting module.
 *
 * Scheduled and ad-hoc reports, exported asynchronously.
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
export class ReportsModule {}
