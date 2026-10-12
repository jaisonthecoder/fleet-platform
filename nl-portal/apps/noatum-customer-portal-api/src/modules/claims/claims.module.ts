import { Module } from '@nestjs/common';

/**
 * Phase 3 module.
 *
 * Claim submission and status tracking.
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
export class ClaimsModule {}
