import { Module } from '@nestjs/common';

/**
 * Platform module.
 *
 * customer_group, customer_account and master_org search.
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
export class TenancyModule {}
