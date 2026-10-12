import { Module } from '@nestjs/common';

/**
 * Cross-cutting module.
 *
 * Noatum-side administration: customers, accounts, flags, impersonation.
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
export class AdminModule {}
