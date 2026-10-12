import { Module } from '@nestjs/common';

/**
 * Platform module.
 *
 * Append-only audit trail, including impersonation events.
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
export class AuditModule {}
