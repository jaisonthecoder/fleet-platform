import { Module } from '@nestjs/common';

/**
 * Phase 2 module.
 *
 * Invoices, statements and payment status.
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
export class FinanceModule {}
